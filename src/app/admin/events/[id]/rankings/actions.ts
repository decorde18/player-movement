"use server";

import db from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { getScopeFilters } from "@/lib/permissions";
import { getActiveClubId } from "@/lib/actions/clubs";
import { revalidatePath } from "next/cache";

export async function getEventRankings(eventId: number, targetCoachEmail?: string) {
  const sessionUser = await getServerAuthSession();
  const activeClubId = await getActiveClubId();
  const scope = getScopeFilters(sessionUser, activeClubId);

  const event = await db.events.findUnique({
    where: { id: eventId },
    include: {
      event_divisions: {
        include: {
          season_age_groups: {
            include: {
              age_groups: true,
            },
          },
        },
      },
    },
  });

  if (!event) {
    throw new Error("Event not found");
  }

  const coachEmail = sessionUser?.user?.email || "unknown_coach";
  const userRole = sessionUser?.user?.role || "coach";
  const isCoordinator =
    userRole === "system_admin" || userRole === "club_admin" || userRole === "age_group_admin";

  // If a specific coach ranking is targeted (and requestor is coordinator), use that, otherwise use own email
  const activeCoach = (isCoordinator && targetCoachEmail) ? targetCoachEmail : coachEmail;

  // 1. Fetch all event sessions to calculate average rating
  const sessions = await db.sessions.findMany({
    where: { event_id: eventId },
    include: {
      session_players: {
        where: { attendance_status: "present" },
        include: {
          session_player_ratings: true,
        },
      },
    },
  });

  // Calculate average rating per player across all session player ratings
  const playerRatingsMap = new Map<number, number[]>();
  for (const s of sessions) {
    for (const sp of s.session_players) {
      // Gather ratings
      const ratings = sp.session_player_ratings.map(r => r.rating);
      if (ratings.length > 0) {
        const existing = playerRatingsMap.get(sp.player_id) || [];
        playerRatingsMap.set(sp.player_id, [...existing, ...ratings]);
      }
    }
  }

  // 2. Fetch all registered players in the event divisions
  const divisionIds = event.event_divisions.map(ed => ed.season_age_group_id);
  const seasonPlayers = await db.season_players.findMany({
    where: {
      season_age_group_id: { in: divisionIds },
    },
    include: {
      players: true,
      season_age_groups: {
        include: {
          age_groups: true,
        },
      },
    },
  });

  // Deduplicate by player_id
  const playerMap = new Map<number, typeof seasonPlayers[0]>();
  for (const sp of seasonPlayers) {
    if (!playerMap.has(sp.player_id)) {
      playerMap.set(sp.player_id, sp);
    }
  }
  const players = Array.from(playerMap.values());

  // 3. Fetch existing rankings for activeCoach
  let existingRankings = await db.event_player_rankings.findMany({
    where: {
      event_id: eventId,
      coach_id: activeCoach,
    },
  });

  // If no rankings exist for this coach, compute and save initial ranks
  if (existingRankings.length === 0 && players.length > 0) {
    const computedList = players.map(sp => {
      const ratings = playerRatingsMap.get(sp.player_id) || [];
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

      // Tiering categories
      let tier = "Development";
      if (avgRating >= 8.5) tier = "Gold";
      else if (avgRating >= 7.0) tier = "Competitive";

      return {
        playerId: sp.player_id,
        rating: avgRating,
        tier,
      };
    });

    // Auto-rank sequentially within each tier (sorting descending by rating)
    const tiers = ["Gold", "Competitive", "Development"];
    const initialRankingsData: any[] = [];

    tiers.forEach(tName => {
      const tierPlayers = computedList
        .filter(p => p.tier === tName)
        .sort((a, b) => b.rating - a.rating);

      tierPlayers.forEach((p, idx) => {
        initialRankingsData.push({
          event_id: eventId,
          player_id: p.playerId,
          coach_id: activeCoach,
          rank: idx + 1,
          tier: p.tier,
          rating: p.rating,
        });
      });
    });

    // Bulk save in a transaction
    if (initialRankingsData.length > 0) {
      await db.$transaction(
        initialRankingsData.map(r =>
          db.event_player_rankings.upsert({
            where: {
              event_id_player_id_coach_id: {
                event_id: eventId,
                player_id: r.player_id,
                coach_id: r.coach_id,
              },
            },
            update: {
              rank: r.rank,
              tier: r.tier,
              rating: r.rating,
            },
            create: r,
          })
        )
      );
    }

    // Refresh list
    existingRankings = await db.event_player_rankings.findMany({
      where: {
        event_id: eventId,
        coach_id: activeCoach,
      },
    });
  }

  // Find other coaches who have saved rankings for this event
  const otherCoachesRecords = await db.event_player_rankings.findMany({
    where: {
      event_id: eventId,
    },
    select: {
      coach_id: true,
    },
    distinct: ["coach_id"],
  });
  const otherCoaches = otherCoachesRecords.map(c => c.coach_id);

  // Return combined output
  const rankingsMap = new Map(existingRankings.map(r => [r.player_id, r]));

  const data = players.map(sp => {
    const rankRec = rankingsMap.get(sp.player_id);
    const ratings = playerRatingsMap.get(sp.player_id) || [];
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    return {
      playerId: sp.player_id,
      firstName: sp.players.first_name,
      lastName: sp.players.last_name,
      tryoutNumber: sp.tryout_number,
      position: sp.position,
      ageGroupName: sp.season_age_groups?.age_groups?.name || "N/A",
      gender: sp.players.gender,
      rating: avgRating,
      rank: rankRec?.rank || 0,
      tier: rankRec?.tier || "Development",
    };
  });

  return {
    event,
    rankings: data,
    otherCoaches,
    activeCoach,
    isCoordinator,
    isFinalized: !!event.is_finalized,
    finalizedBy: event.finalized_by,
    finalizedAt: event.finalized_at,
  };
}

export async function updateRankings(
  eventId: number,
  rankings: { playerId: number; rank: number; tier: string }[],
  coachEmailOverride?: string
) {
  const sessionUser = await getServerAuthSession();
  const coachEmail = sessionUser?.user?.email || "unknown_coach";
  const userRole = sessionUser?.user?.role || "coach";
  const isCoordinator =
    userRole === "system_admin" || userRole === "club_admin" || userRole === "age_group_admin";

  const targetCoach = (isCoordinator && coachEmailOverride) ? coachEmailOverride : coachEmail;

  // Confirm not finalized
  const event = await db.events.findUnique({ where: { id: eventId } });
  if (event?.is_finalized) {
    return { success: false, error: "Event rankings are finalized and locked." };
  }

  await db.$transaction(
    rankings.map(r =>
      db.event_player_rankings.update({
        where: {
          event_id_player_id_coach_id: {
            event_id: eventId,
            player_id: r.playerId,
            coach_id: targetCoach,
          },
        },
        data: {
          rank: r.rank,
          tier: r.tier,
        },
      })
    )
  );

  revalidatePath(`/admin/events/${eventId}/rankings`);
  return { success: true };
}

export async function finalizeRankings(eventId: number) {
  const sessionUser = await getServerAuthSession();
  const userRole = sessionUser?.user?.role || "coach";
  const isCoordinator =
    userRole === "system_admin" || userRole === "club_admin" || userRole === "age_group_admin";

  if (!isCoordinator) {
    return { success: false, error: "Unauthorized. Only coordinators can finalize rankings." };
  }

  const coachEmail = sessionUser?.user?.email || "unknown_coach";

  await db.events.update({
    where: { id: eventId },
    data: {
      is_finalized: true,
      finalized_by: coachEmail,
      finalized_at: new Date(),
    },
  });

  revalidatePath(`/admin/events/${eventId}/rankings`);
  return { success: true };
}
