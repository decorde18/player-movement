"use server";

import db from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { getScopeFilters } from "@/lib/permissions";
import { getActiveClubId } from "@/lib/actions/clubs";
import { revalidatePath } from "next/cache";

export interface SeasonMutationInput {
  id?: number;
  name: string;
  start_date?: string;
  end_date?: string;
  cutoff_type?: string;
  clone_from_season_id?: string; // Optional parent season to clone divisions from
}

export interface SeasonAgeGroupMutationInput {
  id?: number;
  season_id: number;
  age_group_id: number;
  gender: string;
}

/**
 * Fetch all scoping-compliant Seasons, along with nested divisions and standard age groups.
 */
export async function getSeasonsDashboardData() {
  const session = await getServerAuthSession();
  const activeClubId = await getActiveClubId();
  const scope = getScopeFilters(session, activeClubId);
  const seasonFilter = scope.filters.season();

  const [seasons, ageGroups] = await Promise.all([
    db.seasons.findMany({
      where: seasonFilter,
      include: {
        season_age_groups: {
          include: {
            age_groups: true,
          },
        },
      },
      orderBy: { start_date: "desc" },
    }),
    db.age_groups.findMany({
      orderBy: [{ cutoff_type: "asc" }, { dob_start: "desc" }, { name: "asc" }],
    }),
  ]);

  return {
    seasons,
    ageGroups,
    userScope: {
      role: scope.role,
      clubId: scope.clubId,
      isSystemAdmin: scope.isSystemAdmin,
    },
  };
}

/**
 * Create or edit a Season. Implements multi-tenant club linking and division cloning.
 */
export async function saveSeason(input: SeasonMutationInput) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    const startDate = input.start_date ? new Date(input.start_date) : null;
    const endDate = input.end_date ? new Date(input.end_date) : null;
    const cutoffType = input.cutoff_type || "seasonal";

    if (input.id) {
      // 1. EDIT OPERATION
      // Verify scope ownership before edit
      const existing = await db.seasons.findFirst({
        where: {
          id: input.id,
          ...scope.filters.season(),
        },
      });

      if (!existing) {
        return { success: false, error: "Access Denied: Season not found or out of scope." };
      }

      const updated = await db.seasons.update({
        where: { id: input.id },
        data: {
          name: input.name,
          start_date: startDate,
          end_date: endDate,
          cutoff_type: cutoffType,
        },
      });

      revalidatePath("/admin/seasons");
      revalidatePath("/admin/players");
      return { success: true, season: updated };
    } else {
      // 2. CREATE OPERATION (With Scoping & Division Cloning Logic)
      const newSeason = await db.$transaction(async (tx) => {
        const season = await tx.seasons.create({
          data: {
            name: input.name,
            start_date: startDate,
            end_date: endDate,
            cutoff_type: cutoffType,
          },
        });

        // Link ALL clubs to this new season via club_seasons
        const allClubs = await tx.clubs.findMany({ select: { id: true } });
        if (allClubs.length > 0) {
          await tx.club_seasons.createMany({
            data: allClubs.map((club) => ({
              club_id: club.id,
              season_id: season.id,
            })),
            skipDuplicates: true,
          });
        }

        // Cloning Logic: Duplicate divisions (season_age_groups) from source season
        if (input.clone_from_season_id) {
          const sourceSeasonId = Number(input.clone_from_season_id);

          // Fetch all season divisions from the source season
          const sourceDivisions = await tx.season_age_groups.findMany({
            where: { season_id: sourceSeasonId },
          });

          // Map of sourceSeasonAgeGroupId -> newSeasonAgeGroupId
          const newDivisionsByAgeGroupGender: Record<string, number> = {};

          // Duplicate them under the newly created season
          for (const div of sourceDivisions) {
            const newDiv = await tx.season_age_groups.create({
              data: {
                season_id: season.id,
                age_group_id: div.age_group_id,
                gender: div.gender,
                name: div.name,
              },
            });
            // Key = "ageGroupId_gender" to look up the new division
            newDivisionsByAgeGroupGender[`${div.age_group_id}_${div.gender}`] = newDiv.id;
          }

          // Auto-register players from the previous season that qualify by DOB
          // 1. Fetch all players registered in the source season (with their season_age_group info)
          const sourcePlayers = await tx.season_players.findMany({
            where: { season_age_group_id: { in: sourceDivisions.map((d) => d.id) } },
            include: {
              players: { select: { id: true, date_of_birth: true } },
              season_age_groups: {
                include: { age_groups: true },
              },
            },
          });

          // 2. For each source player, find the matching new division by DOB range
          const newSeasonPlayerRows: { player_id: number; season_age_group_id: number; club_id?: number }[] = [];

          for (const sp of sourcePlayers) {
            const dob = sp.players?.date_of_birth;
            if (!dob) continue;

            const dobDate = new Date(dob);

            // Find a matching new division for this player's DOB
            for (const newDiv of sourceDivisions) {
              const ageGroup = (sp.season_age_groups?.age_groups) as any;
              if (!ageGroup) continue;

              const dobStart = ageGroup.dob_start ? new Date(ageGroup.dob_start) : null;
              const dobEnd = ageGroup.dob_end ? new Date(ageGroup.dob_end) : null;

              const inRange =
                (!dobStart || dobDate >= dobStart) &&
                (!dobEnd || dobDate <= dobEnd);

              if (inRange && newDiv.age_group_id === ageGroup.id && newDiv.gender === sp.season_age_groups?.gender) {
                const newDivId = newDivisionsByAgeGroupGender[`${newDiv.age_group_id}_${newDiv.gender}`];
                if (newDivId) {
                  newSeasonPlayerRows.push({
                    player_id: sp.player_id,
                    season_age_group_id: newDivId,
                    ...(sp.club_id ? { club_id: sp.club_id } : {}),
                  });
                }
                break;
              }
            }
          }

          if (newSeasonPlayerRows.length > 0) {
            await tx.season_players.createMany({
              data: newSeasonPlayerRows,
              skipDuplicates: true,
            });
          }

          // Store count for return
          (season as any)._autoRegisteredCount = newSeasonPlayerRows.length;
        }

        return season;
      });

      revalidatePath("/admin/seasons");
      revalidatePath("/admin/players");
      return {
        success: true,
        season: newSeason,
        autoRegisteredCount: (newSeason as any)._autoRegisteredCount ?? 0,
      };
    }
  } catch (error: any) {
    console.error("saveSeason Error:", error);
    return { success: false, error: error.message || "Failed to save season." };
  }
}

/**
 * Deletes a Season from the database.
 */
export async function deleteSeason(seasonId: number) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    // Verify scope ownership before delete
    const existing = await db.seasons.findFirst({
      where: {
        id: seasonId,
        ...scope.filters.season(),
      },
    });

    if (!existing) {
      return { success: false, error: "Access Denied: Season not found or out of scope." };
    }

    await db.seasons.delete({
      where: { id: seasonId },
    });

    revalidatePath("/admin/seasons");
    revalidatePath("/admin/players");
    return { success: true };
  } catch (error: any) {
    console.error("deleteSeason Error:", error);
    return { success: false, error: error.message || "Failed to delete season." };
  }
}

/**
 * Adds or edits a Season Age Group (Division) under a specific Season.
 */
export async function saveSeasonAgeGroup(input: SeasonAgeGroupMutationInput, parentId: number) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    const targetSeasonId = parentId || input.season_id;

    // Security Check: Verify season ownership
    const season = await db.seasons.findFirst({
      where: {
        id: targetSeasonId,
        ...scope.filters.season(),
      },
    });

    if (!season) {
      return { success: false, error: "Access Denied: Target season is out of scope." };
    }

    // Check for duplicate division
    const duplicate = await db.season_age_groups.findFirst({
      where: {
        season_id: targetSeasonId,
        age_group_id: Number(input.age_group_id),
        gender: input.gender,
      },
    });

    if (duplicate) {
      return { success: false, error: "This age group division is already configured for this season." };
    }

    const ageGroup = await db.age_groups.findUnique({
      where: { id: Number(input.age_group_id) },
    });

    const division = await db.season_age_groups.create({
      data: {
        season_id: targetSeasonId,
        age_group_id: Number(input.age_group_id),
        gender: input.gender,
        name: ageGroup ? ageGroup.name : `Bracket ${input.age_group_id}`,
      },
    });

    revalidatePath("/admin/seasons");
    revalidatePath("/admin/players");
    return { success: true, division };
  } catch (error: any) {
    console.error("saveSeasonAgeGroup Error:", error);
    return { success: false, error: error.message || "Failed to configure season age group." };
  }
}

/**
 * Deletes a Season Age Group (Division) from a Season.
 */
export async function deleteSeasonAgeGroup(id: number) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    // Verify scope ownership before deleting division
    const division = await db.season_age_groups.findFirst({
      where: {
        id: id,
        seasons: scope.filters.season(),
      },
    });

    if (!division) {
      return { success: false, error: "Access Denied: Division not found or out of scope." };
    }

    await db.season_age_groups.delete({
      where: { id },
    });

    revalidatePath("/admin/seasons");
    revalidatePath("/admin/players");
    return { success: true };
  } catch (error: any) {
    console.error("deleteSeasonAgeGroup Error:", error);
    return { success: false, error: error.message || "Failed to remove division." };
  }
}
