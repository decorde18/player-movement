"use server";

import db from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { getScopeFilters } from "@/lib/permissions";
import { getActiveClubId } from "@/lib/actions/clubs";
import { revalidatePath } from "next/cache";

export async function getTeamsForPlacement(seasonAgeGroupId?: number) {
  const sessionUser = await getServerAuthSession();
  const activeClubId = await getActiveClubId();
  const scope = getScopeFilters(sessionUser, activeClubId);

  // 1. Fetch available season age groups
  let ageGroupWhere: any = {};
  if (activeClubId) {
    ageGroupWhere = {
      seasons: {
        club_seasons: {
          some: { club_id: activeClubId }
        }
      }
    };
  }

  const seasonAgeGroups = await db.season_age_groups.findMany({
    where: ageGroupWhere,
    include: {
      age_groups: true,
    },
    orderBy: {
      name: "asc"
    }
  });

  const selectedAgeGroupId = seasonAgeGroupId || (seasonAgeGroups[0]?.id ?? 0);

  // 2. Fetch season teams for selected age group
  const seasonTeams = await db.season_teams.findMany({
    where: selectedAgeGroupId ? { season_age_group_id: selectedAgeGroupId } : {},
    include: {
      teams: true,
      season_age_groups: {
        include: { age_groups: true }
      }
    },
    orderBy: {
      teams: { name: "asc" }
    }
  });

  // 3. Fetch registered players for selected age group
  const seasonPlayers = await db.season_players.findMany({
    where: selectedAgeGroupId ? { season_age_group_id: selectedAgeGroupId } : {},
    include: {
      players: true,
      season_teams: {
        include: { teams: true }
      },
      season_age_groups: {
        include: { age_groups: true }
      }
    }
  });

  // 4. Fetch event rankings for players in this age group
  const playerIds = seasonPlayers.map(sp => sp.player_id);
  const rankings = await db.event_player_rankings.findMany({
    where: { player_id: { in: playerIds } },
    include: {
      events: true,
    },
    orderBy: { updated_at: "desc" }
  });

  const rankingsMap = new Map<number, typeof rankings[0]>();
  for (const r of rankings) {
    if (!rankingsMap.has(r.player_id)) {
      rankingsMap.set(r.player_id, r);
    }
  }

  const playersWithRankings = seasonPlayers.map(sp => {
    const rankRec = rankingsMap.get(sp.player_id);
    return {
      ...sp,
      eventRank: rankRec?.rank || null,
      eventTier: rankRec?.tier || null,
      eventName: rankRec?.events?.name || null,
    };
  });

  return {
    seasonAgeGroups,
    selectedAgeGroupId,
    seasonTeams,
    seasonPlayers: playersWithRankings
  };
}

export async function createTeamForAgeGroup(seasonAgeGroupId: number, teamName: string) {
  const sessionUser = await getServerAuthSession();
  if (!sessionUser) {
    return { success: false, error: "Unauthorized" };
  }

  const activeClubId = await getActiveClubId();
  const trimmedName = teamName.trim();
  if (!trimmedName) {
    return { success: false, error: "Team name cannot be empty." };
  }

  try {
    const team = await db.teams.create({
      data: {
        name: trimmedName,
        club_id: activeClubId,
      }
    });

    const seasonTeam = await db.season_teams.create({
      data: {
        team_id: team.id,
        season_age_group_id: seasonAgeGroupId,
      }
    });

    revalidatePath("/admin/teams/placement");
    return { success: true, seasonTeam };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create team." };
  }
}

export async function assignPlayerToTeam(seasonPlayerId: number, seasonTeamId: number | null) {
  const sessionUser = await getServerAuthSession();
  if (!sessionUser) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db.season_players.update({
      where: { id: seasonPlayerId },
      data: {
        season_team_id: seasonTeamId
      }
    });

    revalidatePath("/admin/teams/placement");
    revalidatePath("/admin/events");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to assign player to team." };
  }
}

export async function bulkAssignPlayersToTeam(seasonPlayerIds: number[], seasonTeamId: number | null) {
  const sessionUser = await getServerAuthSession();
  if (!sessionUser) {
    return { success: false, error: "Unauthorized" };
  }

  if (!seasonPlayerIds || seasonPlayerIds.length === 0) {
    return { success: false, error: "No players selected." };
  }

  try {
    await db.season_players.updateMany({
      where: {
        id: { in: seasonPlayerIds }
      },
      data: {
        season_team_id: seasonTeamId
      }
    });

    revalidatePath("/admin/teams/placement");
    revalidatePath("/admin/events");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to bulk assign players to team." };
  }
}
