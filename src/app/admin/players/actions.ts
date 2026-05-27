"use server";

import db from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { getScopeFilters } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export interface PlayerInput {
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
  const scope = getScopeFilters(session);

  const clubFilter = scope.filters.club();
  const playerFilter = scope.filters.player();
  const seasonFilter = scope.filters.season();

  const [players, clubs, seasons, seasonAgeGroups] = await Promise.all([
    db.players.findMany({
      where: playerFilter,
      include: {
        clubs: true,
        season_players: {
          include: {
            season_age_groups: {
              include: {
                seasons: true,
                age_groups: true,
              },
            },
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

  return {
    players,
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
 * Creates a single player and handles optional initial division/age group assignment.
 */
export async function createPlayer(input: PlayerInput) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    // Security Check: Club Admin is restricted to their own club
    if (scope.isClubAdmin && input.club_id !== scope.clubId) {
      return { success: false, error: "Access Denied: Cannot create players outside your club." };
    }

    const birthDate = input.date_of_birth ? new Date(input.date_of_birth) : null;

    const newPlayer = await db.$transaction(async (tx) => {
      // 1. Create player in players table
      const player = await tx.players.create({
        data: {
          first_name: input.first_name,
          last_name: input.last_name,
          date_of_birth: birthDate,
          gender: input.gender,
          club_id: input.club_id,
        },
      });

      // 2. Map to Season Age Group if specified
      if (input.season_age_group_id) {
        await tx.season_players.create({
          data: {
            player_id: player.id,
            season_age_group_id: input.season_age_group_id,
            tryout_number: input.tryout_number || null,
            position: input.position || null,
            rating: Number(input.rating) || 0,
            player_status: "none",
          },
        });
      }

      return player;
    });

    revalidatePath("/admin/players");
    return { success: true, player: newPlayer };
  } catch (error: any) {
    console.error("createPlayer Error:", error);
    return { success: false, error: error.message || "Failed to create player." };
  }
}

/**
 * Bulk import players from parsed CSV data. Highly performant using Prisma transactions.
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

        // 1. Create player record
        const player = await tx.players.create({
          data: {
            first_name: p.first_name,
            last_name: p.last_name,
            date_of_birth: birthDate,
            gender: p.gender,
            club_id: p.club_id,
          },
        });

        // 2. Create association if age group selected
        if (p.season_age_group_id) {
          await tx.season_players.create({
            data: {
              player_id: player.id,
              season_age_group_id: p.season_age_group_id,
              tryout_number: p.tryout_number || null,
              position: p.position || null,
              rating: Number(p.rating) || 0,
              player_status: "none",
            },
          });
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
 * Deletes a player from the registry
 */
export async function deletePlayer(playerId: number) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    // Verify scope ownership before deletion
    const player = await db.players.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return { success: false, error: "Player not found." };
    }

    if (scope.isClubAdmin && player.club_id !== scope.clubId) {
      return { success: false, error: "Access Denied: Cannot delete players outside your club." };
    }

    await db.players.delete({
      where: { id: playerId },
    });

    revalidatePath("/admin/players");
    return { success: true };
  } catch (error: any) {
    console.error("deletePlayer Error:", error);
    return { success: false, error: error.message || "Failed to delete player." };
  }
}
