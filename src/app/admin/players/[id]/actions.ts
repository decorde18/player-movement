"use server";

import db from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { getActiveClubId } from "@/lib/actions/clubs";

export async function getPlayerDetailData(playerId: number) {
  const sessionUser = await getServerAuthSession();
  if (!sessionUser) {
    return { success: false, error: "Unauthorized" };
  }

  const activeClubId = await getActiveClubId();

  // 1. Fetch player bio
  const player = await db.players.findUnique({
    where: { id: playerId }
  });

  if (!player) {
    return { success: false, error: "Player not found." };
  }

  // 2. Fetch season player enrollments & team placements
  const seasonPlayers = await db.season_players.findMany({
    where: { 
      player_id: playerId,
      ...(activeClubId ? { club_id: activeClubId } : {})
    },
    include: {
      season_age_groups: {
        include: { age_groups: true, seasons: true }
      },
      season_teams: {
        include: { teams: true }
      },
      team_invitations: {
        include: {
          season_teams: {
            include: { teams: true }
          }
        },
        orderBy: { created_at: "desc" }
      }
    }
  });

  // 3. Fetch event rankings history
  const eventRankings = await db.event_player_rankings.findMany({
    where: { player_id: playerId },
    include: {
      events: true
    },
    orderBy: { created_at: "desc" }
  });

  // 4. Fetch coach notes feed
  const notes = await db.coach_notes.findMany({
    where: { player_id: playerId },
    include: {
      users: { select: { id: true, name: true, email: true, role: true } },
      events: { select: { id: true, name: true } },
      sessions: { select: { id: true, name: true } },
      invitations: { select: { id: true, status: true, season_teams: { include: { teams: true } } } }
    },
    orderBy: { created_at: "desc" }
  });

  return {
    success: true,
    player,
    seasonPlayers,
    eventRankings,
    notes,
    currentUser: sessionUser.user
  };
}
