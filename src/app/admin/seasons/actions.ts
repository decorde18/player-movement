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
      orderBy: { name: "asc" },
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
          },
        });

        // Link to active club if scoped to a club
        if (scope.isClubAdmin && scope.clubId) {
          await tx.club_seasons.create({
            data: {
              club_id: scope.clubId,
              season_id: season.id,
            },
          });
        }

        // Cloning Logic: Duplicate divisions (season_age_groups) from source season
        if (input.clone_from_season_id) {
          const sourceSeasonId = Number(input.clone_from_season_id);

          // Fetch all season divisions from the source season
          const sourceDivisions = await tx.season_age_groups.findMany({
            where: { season_id: sourceSeasonId },
          });

          // Duplicate them under the newly created season
          // NOTE: We do NOT insert anything into season_players, leaving all rosters blank!
          for (const div of sourceDivisions) {
            await tx.season_age_groups.create({
              data: {
                season_id: season.id,
                age_group_id: div.age_group_id,
                gender: div.gender,
                name: div.name,
              },
            });
          }
        }

        return season;
      });

      revalidatePath("/admin/seasons");
      revalidatePath("/admin/players");
      return { success: true, season: newSeason };
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
