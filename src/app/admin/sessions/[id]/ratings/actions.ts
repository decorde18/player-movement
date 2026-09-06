"use server";

import db from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { getScopeFilters } from "@/lib/permissions";
import { getActiveClubId } from "@/lib/actions/clubs";
import { revalidatePath } from "next/cache";

export async function getRatingsForSession(sessionId: number) {
  const sessionUser = await getServerAuthSession();
  const activeClubId = await getActiveClubId();
  const scope = getScopeFilters(sessionUser, activeClubId);

  const session = await db.sessions.findUnique({
    where: { id: sessionId },
    include: {
      events: {
        include: {
          event_divisions: true,
        },
      },
      session_fields: true,
      session_players: {
        where: {
          attendance_status: { in: ["present", "not_checked_in"] },
        },
        include: {
          players: {
            include: {
              season_players: {
                include: {
                  season_age_groups: {
                    include: {
                      age_groups: true,
                    },
                  },
                },
              },
            },
          },
          session_player_ratings: true,
        },
      },
    },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  // Fetch session age groups / divisions for filter tabs
  const divisionIds = session.season_age_group_id
    ? [session.season_age_group_id]
    : (session.events?.event_divisions.map((d) => d.season_age_group_id) || []);

  const sessionDivisions = await db.season_age_groups.findMany({
    where: { id: { in: divisionIds } },
    include: { age_groups: true },
    orderBy: { age_groups: { dob_start: "asc" } },
  });

  // Identify active coach
  const coachEmail = sessionUser?.user?.email || "unknown_coach";
  const coachName = sessionUser?.user?.name || coachEmail;

  return {
    session,
    sessionDivisions,
    coachEmail,
    coachName,
    userScope: {
      role: scope.role,
      isSystemAdmin: scope.isSystemAdmin,
    },
  };
}

export async function submitPlayerRating(
  sessionId: number,
  sessionPlayerId: number,
  ratingValue: number
) {
  const sessionUser = await getServerAuthSession();
  if (!sessionUser) {
    return { success: false, error: "Unauthorized" };
  }

  const coachEmail = sessionUser.user?.email || "unknown_coach";
  const coachName = sessionUser.user?.name || coachEmail;

  if (ratingValue < 0 || ratingValue > 10) {
    return { success: false, error: "Rating must be between 0 and 10." };
  }

  try {
    // 1. Upsert coach rating
    const ratingUpsert = await db.session_player_ratings.upsert({
      where: {
        session_player_id_coach_id: {
          session_player_id: sessionPlayerId,
          coach_id: coachEmail,
        },
      },
      update: {
        rating: ratingValue,
        coach_name: coachName,
        updated_at: new Date(),
      },
      create: {
        session_player_id: sessionPlayerId,
        coach_id: coachEmail,
        coach_name: coachName,
        rating: ratingValue,
      },
    });

    // 2. Fetch all ratings for this session player to calculate new average
    const allRatings = await db.session_player_ratings.findMany({
      where: { session_player_id: sessionPlayerId },
    });

    const sum = allRatings.reduce((acc, r) => acc + r.rating, 0);
    const avg = allRatings.length > 0 ? parseFloat((sum / allRatings.length).toFixed(2)) : 0;

    // 3. Save average to session_players.rating
    await db.session_players.update({
      where: { id: sessionPlayerId },
      data: { rating: avg },
    });

    revalidatePath(`/admin/sessions/${sessionId}/ratings`);
    return { success: true, newAverage: avg, userRating: ratingUpsert };
  } catch (err: any) {
    console.error("submitPlayerRating error:", err);
    return { success: false, error: err.message || "Failed to submit rating." };
  }
}

export async function carryForwardEventRatings(eventId: number) {
  const sessionUser = await getServerAuthSession();
  const activeClubId = await getActiveClubId();
  const scope = getScopeFilters(sessionUser, activeClubId);

  // Security: only admins/coordinators
  if (scope.role !== "admin" && scope.role !== "coordinator" && !scope.isSystemAdmin) {
    return { success: false, error: "Access Denied: Only coordinators can carry forward ratings." };
  }

  try {
    // Fetch all sessions inside this event
    const sessions = await db.sessions.findMany({
      where: { event_id: eventId },
      select: { id: true },
    });

    const sessionIds = sessions.map((s) => s.id);
    if (sessionIds.length === 0) {
      return { success: false, error: "No sessions found for this event." };
    }

    // Get all present session players and their average ratings
    const sessionPlayers = await db.session_players.findMany({
      where: {
        session_id: { in: sessionIds },
        attendance_status: "present",
        rating: { not: null },
      },
      select: {
        player_id: true,
        rating: true,
      },
    });

    // Group ratings by player_id
    const playerRatings: Record<number, number[]> = {};
    sessionPlayers.forEach((sp) => {
      if (sp.rating !== null) {
        if (!playerRatings[sp.player_id]) {
          playerRatings[sp.player_id] = [];
        }
        playerRatings[sp.player_id].push(sp.rating);
      }
    });

    // Update season_players for each player
    const updates = Object.entries(playerRatings).map(async ([playerIdStr, ratings]) => {
      const playerId = parseInt(playerIdStr, 10);
      const sum = ratings.reduce((a, b) => a + b, 0);
      const avg = Math.round(sum / ratings.length);

      // Find season_players record matching current active club scope
      const seasonPlayer = await db.season_players.findFirst({
        where: {
          player_id: playerId,
          ...(scope.isClubAdmin ? { club_id: scope.clubId } : {}),
        },
      });

      if (seasonPlayer) {
        return db.season_players.update({
          where: { id: seasonPlayer.id },
          data: { rating: avg },
        });
      }
    });

    await Promise.all(updates);

    return { success: true };
  } catch (err: any) {
    console.error("carryForwardEventRatings error:", err);
    return { success: false, error: err.message || "Failed to carry forward ratings." };
  }
}
