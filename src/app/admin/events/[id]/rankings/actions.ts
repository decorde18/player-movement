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

  // Rating direction: "high_is_best" (default 10 high) or "low_is_best" (1 high)
  const ratingDirection = event.rating_direction || "high_is_best";

  // Custom tiers list
  let configuredTiers: string[] = ["Gold", "Competitive", "Development"];
  if (event.tiers) {
    try {
      const parsed = JSON.parse(event.tiers);
      if (Array.isArray(parsed) && parsed.length > 0) {
        configuredTiers = parsed;
      }
    } catch {
      configuredTiers = event.tiers.split(",").map(t => t.trim()).filter(Boolean);
    }
  }

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
      season_teams: {
        include: {
          teams: true,
        },
      },
      season_age_groups: {
        include: {
          age_groups: true,
        },
      },
    },
  });

  // Fetch available season teams for these divisions
  const availableSeasonTeams = await db.season_teams.findMany({
    where: {
      season_age_group_id: { in: divisionIds },
    },
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

  // Default tier name is the first configured tier
  const defaultTier = configuredTiers[0] || "Development";

  // If no rankings exist for this coach, compute and save initial ranks
  if (existingRankings.length === 0 && players.length > 0) {
    const computedList = players.map(sp => {
      const ratings = playerRatingsMap.get(sp.player_id) || [];
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

      // Assign initial tier based on thresholds or default tier
      let tier = defaultTier;
      if (configuredTiers.length >= 3) {
        if (ratingDirection === "high_is_best") {
          if (avgRating >= 8.5) tier = configuredTiers[0];
          else if (avgRating >= 7.0) tier = configuredTiers[1];
          else tier = configuredTiers[2];
        } else {
          // low_is_best (1 is best)
          if (avgRating > 0 && avgRating <= 3.0) tier = configuredTiers[0];
          else if (avgRating > 3.0 && avgRating <= 6.0) tier = configuredTiers[1];
          else tier = configuredTiers[2];
        }
      } else if (configuredTiers.length === 2) {
        if (ratingDirection === "high_is_best") {
          if (avgRating >= 7.5) tier = configuredTiers[0];
          else tier = configuredTiers[1];
        } else {
          if (avgRating > 0 && avgRating <= 5.0) tier = configuredTiers[0];
          else tier = configuredTiers[1];
        }
      }

      return {
        playerId: sp.player_id,
        rating: avgRating,
        tier,
      };
    });

    // Auto-rank sequentially within each tier
    const initialRankingsData: any[] = [];

    configuredTiers.forEach(tName => {
      const tierPlayers = computedList
        .filter(p => p.tier === tName)
        .sort((a, b) => {
          if (ratingDirection === "low_is_best") {
            // Lower number is better (ascending order)
            return (a.rating || 999) - (b.rating || 999);
          }
          // Higher number is better (descending order)
          return b.rating - a.rating;
        });

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
      seasonPlayerId: sp.id,
      firstName: sp.players.first_name,
      lastName: sp.players.last_name,
      tryoutNumber: sp.tryout_number,
      position: sp.position,
      ageGroupName: sp.season_age_groups?.age_groups?.name || "N/A",
      gender: sp.players.gender,
      rating: avgRating,
      rank: rankRec?.rank || 0,
      tier: rankRec?.tier || "Unassigned",
      seasonTeamId: sp.season_team_id || null,
      teamName: sp.season_teams?.teams?.name || null,
    };
  });

  return {
    event,
    eventTiers: configuredTiers,
    ratingDirection,
    rankings: data,
    seasonTeams: availableSeasonTeams,
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
      db.event_player_rankings.upsert({
        where: {
          event_id_player_id_coach_id: {
            event_id: eventId,
            player_id: r.playerId,
            coach_id: targetCoach,
          },
        },
        update: {
          rank: r.rank,
          tier: r.tier,
        },
        create: {
          event_id: eventId,
          player_id: r.playerId,
          coach_id: targetCoach,
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

export async function unlockRankings(eventId: number) {
  const sessionUser = await getServerAuthSession();
  const userRole = sessionUser?.user?.role || "coach";
  const isCoordinator =
    userRole === "system_admin" || userRole === "club_admin" || userRole === "age_group_admin";

  if (!isCoordinator) {
    return { success: false, error: "Unauthorized. Only coordinators can unlock rankings." };
  }

  await db.events.update({
    where: { id: eventId },
    data: {
      is_finalized: false,
      finalized_by: null,
      finalized_at: null,
    },
  });

  revalidatePath(`/admin/events/${eventId}/rankings`);
  return { success: true };
}

export async function updateEventRankingSettings(
  eventId: number,
  ratingDirection: "high_is_best" | "low_is_best",
  tiers: string[]
) {
  const sessionUser = await getServerAuthSession();
  const userRole = sessionUser?.user?.role || "coach";
  const isCoordinator =
    userRole === "system_admin" || userRole === "club_admin" || userRole === "age_group_admin";

  if (!isCoordinator) {
    return { success: false, error: "Unauthorized. Only coordinators can edit event settings." };
  }

  await db.events.update({
    where: { id: eventId },
    data: {
      rating_direction: ratingDirection,
      tiers: JSON.stringify(tiers),
    },
  });

  revalidatePath(`/admin/events/${eventId}/rankings`);
  return { success: true };
}

export async function assignEventPlayerToTeam(
  eventId: number,
  seasonPlayerId: number,
  seasonTeamId: number | null
) {
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

    revalidatePath(`/admin/events/${eventId}/rankings`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to assign player to team." };
  }
}

export async function bulkAssignEventPlayersToTeam(
  eventId: number,
  seasonPlayerIds: number[],
  seasonTeamId: number | null
) {
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

    revalidatePath(`/admin/events/${eventId}/rankings`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to bulk assign players to team." };
  }
}
