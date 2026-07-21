"use server";

import db from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { getScopeFilters } from "@/lib/permissions";
import { getActiveClubId } from "@/lib/actions/clubs";
import { revalidatePath } from "next/cache";

export interface PlayerInput {
  id?: number; // Optional ID for updates
  first_name: string;
  last_name: string;
  date_of_birth: string; // YYYY-MM-DD format
  gender: string;
  club_id: number;
  season_age_group_id?: number;
  tryout_number?: string;
  position?: string;
  rating?: number;
}

/**
 * Fetch all scope-filtered player registry data, clubs, seasons, and age groups
 */
export async function getPlayersData() {
  const session = await getServerAuthSession();
  const activeClubId = await getActiveClubId();
  const scope = getScopeFilters(session, activeClubId);

  const clubFilter = scope.filters.club();
  const playerFilter = scope.filters.player();
  const seasonFilter = scope.filters.season();

  const [players, clubs, seasons, seasonAgeGroups] = await Promise.all([
    db.players.findMany({
      where: playerFilter,
      include: {
        season_players: {
          include: {
            season_age_groups: {
              include: {
                seasons: true,
                age_groups: true,
              },
            },
            clubs: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    }),
    db.clubs.findMany({
      where: clubFilter,
      orderBy: { name: "asc" },
    }),
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
    db.season_age_groups.findMany({
      where: {
        seasons: seasonFilter,
      },
      include: {
        seasons: true,
        age_groups: true,
      },
      orderBy: [
        { seasons: { start_date: "desc" } },
        { age_groups: { name: "asc" } },
      ],
    }),
  ]);

  // Map players to retain compatibility with frontend components expecting `club_id` and `clubs` properties directly on the player object.
  const mappedPlayers = players.map((p) => {
    // If the user is a club admin, scope to their own club; otherwise, fall back to the first seasonal registration.
    const activeClubId = scope.isClubAdmin
      ? scope.clubId
      : p.season_players?.[0]?.club_id || null;

    const matchedSeasonPlayer = activeClubId
      ? p.season_players.find((sp) => sp.club_id === activeClubId)
      : p.season_players?.[0];

    return {
      ...p,
      club_id: activeClubId,
      clubs: matchedSeasonPlayer?.clubs || null,
    };
  });

  return {
    players: mappedPlayers,
    clubs,
    seasons,
    seasonAgeGroups,
    userScope: {
      role: scope.role,
      clubId: scope.clubId,
      isSystemAdmin: scope.isSystemAdmin,
    },
  };
}

/**
 * Creates or updates a player, handling global identity lookup and seasonal registrations.
 */
export async function createPlayer(input: PlayerInput) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    // Security Check: Club Admin is restricted to their own club scope
    if (scope.isClubAdmin && input.club_id !== scope.clubId) {
      return { success: false, error: "Access Denied: Cannot manage players outside your club." };
    }

    const birthDate = input.date_of_birth ? new Date(input.date_of_birth) : null;

    const updatedOrNewPlayer = await db.$transaction(async (tx) => {
      let player;

      if (input.id) {
        // 1. Update existing player details globally
        player = await tx.players.update({
          where: { id: input.id },
          data: {
            first_name: input.first_name,
            last_name: input.last_name,
            date_of_birth: birthDate,
            gender: input.gender,
          },
        });

        // 2. Update seasonal registration if specified
        if (input.season_age_group_id) {
          const existingSp = await tx.season_players.findFirst({
            where: {
              player_id: player.id,
              club_id: input.club_id,
            },
          });

          if (existingSp) {
            await tx.season_players.update({
              where: { id: existingSp.id },
              data: {
                season_age_group_id: input.season_age_group_id,
                tryout_number: input.tryout_number !== undefined ? input.tryout_number : existingSp.tryout_number,
                position: input.position !== undefined ? input.position : existingSp.position,
                rating: input.rating !== undefined ? Number(input.rating) : existingSp.rating,
              },
            });
          } else {
            await tx.season_players.create({
              data: {
                player_id: player.id,
                season_age_group_id: input.season_age_group_id,
                club_id: input.club_id,
                tryout_number: input.tryout_number || null,
                position: input.position || null,
                rating: Number(input.rating) || 0,
                player_status: "none",
              },
            });
          }
        }
      } else {
        // 1. Identity Deduplication: Try to find an existing physical player record globally
        const existingPlayer = await tx.players.findFirst({
          where: {
            first_name: input.first_name,
            last_name: input.last_name,
            date_of_birth: birthDate,
            gender: input.gender,
          },
        });

        if (existingPlayer) {
          player = existingPlayer;
        } else {
          // Create a new global physical player registry record
          player = await tx.players.create({
            data: {
              first_name: input.first_name,
              last_name: input.last_name,
              date_of_birth: birthDate,
              gender: input.gender,
            },
          });
        }

        // 2. Map to Season Age Group for this specific club
        if (input.season_age_group_id) {
          const existingSp = await tx.season_players.findFirst({
            where: {
              player_id: player.id,
              season_age_group_id: input.season_age_group_id,
              club_id: input.club_id,
            },
          });

          if (existingSp) {
            await tx.season_players.update({
              where: { id: existingSp.id },
              data: {
                tryout_number: input.tryout_number !== undefined ? input.tryout_number : existingSp.tryout_number,
                position: input.position !== undefined ? input.position : existingSp.position,
                rating: input.rating !== undefined ? Number(input.rating) : existingSp.rating,
              },
            });
          } else {
            await tx.season_players.create({
              data: {
                player_id: player.id,
                season_age_group_id: input.season_age_group_id,
                club_id: input.club_id,
                tryout_number: input.tryout_number || null,
                position: input.position || null,
                rating: Number(input.rating) || 0,
                player_status: "none",
              },
            });
          }
        }
      }

      return player;
    });

    revalidatePath("/admin/players");
    return { success: true, player: updatedOrNewPlayer };
  } catch (error: any) {
    console.error("createPlayer Error:", error);
    return { success: false, error: error.message || "Failed to save player." };
  }
}

/**
 * Bulk import players from parsed CSV data, using global deduplication.
 */
export async function bulkImportPlayers(playersList: PlayerInput[]) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    if (playersList.length === 0) {
      return { success: false, error: "Empty player list." };
    }

    // Security check for Club Admins
    if (scope.isClubAdmin) {
      const invalidClub = playersList.some(p => p.club_id !== scope.clubId);
      if (invalidClub) {
        return { success: false, error: "Access Denied: One or more players do not match your club scope." };
      }
    }

    const results = await db.$transaction(async (tx) => {
      const imported = [];

      for (const p of playersList) {
        const birthDate = p.date_of_birth ? new Date(p.date_of_birth) : null;

        // 1. Identity Deduplication: Try to find an existing physical player globally
        let player = await tx.players.findFirst({
          where: {
            first_name: p.first_name,
            last_name: p.last_name,
            date_of_birth: birthDate,
            gender: p.gender,
          },
        });

        if (!player) {
          player = await tx.players.create({
            data: {
              first_name: p.first_name,
              last_name: p.last_name,
              date_of_birth: birthDate,
              gender: p.gender,
            },
          });
        }

        // 2. Create/update seasonal registration
        if (p.season_age_group_id) {
          const existingSp = await tx.season_players.findFirst({
            where: {
              player_id: player.id,
              season_age_group_id: p.season_age_group_id,
              club_id: p.club_id,
            },
          });

          if (existingSp) {
            await tx.season_players.update({
              where: { id: existingSp.id },
              data: {
                tryout_number: p.tryout_number !== undefined ? p.tryout_number : existingSp.tryout_number,
                position: p.position !== undefined ? p.position : existingSp.position,
                rating: p.rating !== undefined ? Number(p.rating) : existingSp.rating,
              },
            });
          } else {
            await tx.season_players.create({
              data: {
                player_id: player.id,
                season_age_group_id: p.season_age_group_id,
                club_id: p.club_id,
                tryout_number: p.tryout_number || null,
                position: p.position || null,
                rating: Number(p.rating) || 0,
                player_status: "none",
              },
            });
          }
        }

        imported.push(player);
      }

      return imported;
    });

    revalidatePath("/admin/players");
    return { success: true, count: results.length };
  } catch (error: any) {
    console.error("bulkImportPlayers Error:", error);
    return { success: false, error: error.message || "Bulk import failed." };
  }
}

/**
 * Deletes a player registration. If they are in multiple clubs, deletes only the active club association.
 */
export async function deletePlayer(playerId: number) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    // Verify player existence
    const player = await db.players.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return { success: false, error: "Player not found." };
    }

    if (scope.isClubAdmin) {
      // Find this club's seasonal registration
      const assoc = await db.season_players.findFirst({
        where: {
          player_id: playerId,
          club_id: scope.clubId,
        },
      });

      if (!assoc) {
        return { success: false, error: "Access Denied: Player not registered in your club." };
      }

      // Delete the seasonal registration
      await db.season_players.delete({
        where: { id: assoc.id },
      });

      // If the player has no other club associations left, clean up the global player profile
      const remainingAssocs = await db.season_players.findFirst({
        where: { player_id: playerId },
      });

      if (!remainingAssocs) {
        await db.players.delete({
          where: { id: playerId },
        });
      }
    } else {
      // System admins can delete the player globally, cascading deletions to all associations
      await db.players.delete({
        where: { id: playerId },
      });
    }

    revalidatePath("/admin/players");
    return { success: true };
  } catch (error: any) {
    console.error("deletePlayer Error:", error);
    return { success: false, error: error.message || "Failed to delete player." };
  }
}
