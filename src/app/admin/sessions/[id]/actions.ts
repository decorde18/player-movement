"use server";

import db from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { getScopeFilters } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function getSessionRoster(sessionId: number) {
  const sessionUser = await getServerAuthSession();
  const scope = getScopeFilters(sessionUser);

  // 1. Get the session, event, and divisions
  const session = await db.sessions.findUnique({
    where: { id: sessionId },
    include: {
      events: {
        include: {
          seasons: true,
          event_divisions: true,
        },
      },
    },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  const event = session.events;
  const divisionIds = session.season_age_group_id 
    ? [session.season_age_group_id]
    : event.event_divisions.map((d) => d.season_age_group_id);

  if (divisionIds.length === 0) {
    return {
      session,
      event,
      roster: [],
      userScope: { role: scope.role, isSystemAdmin: scope.isSystemAdmin },
    };
  }

  // 2. Fetch all season_players in target divisions
  const cookieStore = await cookies();
  const cookieActiveAgeGroupIdStr = cookieStore.get("activeAgeGroupId")?.value;
  const cookieActiveAgeGroupId = cookieActiveAgeGroupIdStr ? parseInt(cookieActiveAgeGroupIdStr) : null;

  const targetDivisionIds = cookieActiveAgeGroupId && divisionIds.includes(cookieActiveAgeGroupId)
    ? [cookieActiveAgeGroupId]
    : divisionIds;

  // 2. Fetch all season_players in target divisions OR playing up from adjacent younger age group
  const targetSags = await db.season_age_groups.findMany({
    where: { id: { in: targetDivisionIds } },
    include: { age_groups: true },
  });

  const seasonIds = [...new Set(targetSags.map((s) => s.season_id))];
  const genders = [...new Set(targetSags.map((s) => s.gender))];

  const candidateSags = await db.season_age_groups.findMany({
    where: {
      season_id: { in: seasonIds },
      gender: { in: genders },
    },
    include: { age_groups: true },
  });

  const targetDobStarts = targetSags
    .map((s) => s.age_groups?.dob_start)
    .filter(Boolean)
    .map((d) => new Date(d!).getTime());

  const minTargetDobStart = targetDobStarts.length > 0 ? Math.min(...targetDobStarts) : null;

  // Maximum gap of 1.5 years so players playing up only appear in the next 1-year older division (e.g. 2018 -> 2017), not 2-3 years older (e.g. 2018 -> 2015)
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  const MAX_PLAY_UP_GAP_MS = 1.5 * ONE_YEAR_MS;

  const playUpSagIds = candidateSags
    .filter((sag) => {
      if (!minTargetDobStart || !sag.age_groups?.dob_start) return false;
      const sagDobStart = new Date(sag.age_groups.dob_start).getTime();
      const gap = sagDobStart - minTargetDobStart;
      return gap > 0 && gap <= MAX_PLAY_UP_GAP_MS;
    })
    .map((sag) => sag.id);

  const seasonPlayers = await db.season_players.findMany({
    where: {
      OR: [
        { season_age_group_id: { in: targetDivisionIds } },
        {
          season_age_group_id: { in: playUpSagIds },
          playing_up: true,
        },
      ],
      ...(scope.isClubAdmin ? { club_id: scope.clubId } : {}),
    },
    include: {
      players: true,
      clubs: true,
      season_age_groups: {
        include: {
          age_groups: true,
        },
      },
      season_teams: {
        include: {
          teams: true,
        },
      },
    },
  });

  // 3. ALSO fetch any explicitly added session_players for this specific session (train-up / guest players)
  const explicitSessionPlayers = await db.session_players.findMany({
    where: { session_id: sessionId },
    select: { player_id: true },
  });

  const explicitPlayerIds = [...new Set(explicitSessionPlayers.map((sp) => sp.player_id))];

  let trainUpSeasonPlayers: any[] = [];
  if (explicitPlayerIds.length > 0) {
    trainUpSeasonPlayers = await db.season_players.findMany({
      where: {
        player_id: { in: explicitPlayerIds },
        season_age_groups: { season_id: event.season_id },
        ...(scope.isClubAdmin ? { club_id: scope.clubId } : {}),
      },
      include: {
        players: true,
        clubs: true,
        season_age_groups: {
          include: {
            age_groups: true,
          },
        },
        season_teams: {
          include: {
            teams: true,
          },
        },
      },
    });
  }

  const allSeasonPlayers = [...seasonPlayers, ...trainUpSeasonPlayers];

  // Unique players across divisions & train-up additions
  const uniquePlayersMap = new Map<number, any>();
  for (const sp of allSeasonPlayers) {
    if (!uniquePlayersMap.has(sp.player_id)) {
      uniquePlayersMap.set(sp.player_id, {
        player: sp.players,
        club: sp.clubs,
        season_players: [sp],
      });
    } else {
      const existing = uniquePlayersMap.get(sp.player_id).season_players;
      if (!existing.some((item: any) => item.season_age_group_id === sp.season_age_group_id)) {
        existing.push(sp);
      }
    }
  }

  const playerIds = Array.from(uniquePlayersMap.keys());

  // 4. Fetch event_players availability
  const eventPlayers = await db.event_players.findMany({
    where: {
      event_id: event.id,
      player_id: { in: playerIds },
    },
  });

  const eventAvailabilityMap = new Map<number, string>();
  for (const ep of eventPlayers) {
    eventAvailabilityMap.set(ep.player_id, ep.availability_status || "available");
  }

  // 5. Fetch session_players attendance (default to not_checked_in)
  const sessionPlayers = await db.session_players.findMany({
    where: {
      session_id: sessionId,
      player_id: { in: playerIds },
    },
  });

  const sessionAttendanceMap = new Map<number, string>();
  for (const sp of sessionPlayers) {
    sessionAttendanceMap.set(sp.player_id, sp.attendance_status || "not_checked_in");
  }

  // Fetch session age group info for train-up detection
  const sessionDivision = session.season_age_group_id
    ? await db.season_age_groups.findUnique({
        where: { id: session.season_age_group_id },
        include: { age_groups: true },
      })
    : null;

  const targetDobEnd = sessionDivision?.age_groups?.dob_end
    ? new Date(sessionDivision.age_groups.dob_end)
    : null;

  // Fetch all divisions associated with this session/event for UI filter tabs
  const sessionDivisions = await db.season_age_groups.findMany({
    where: { id: { in: divisionIds } },
    include: { age_groups: true },
    orderBy: { age_groups: { dob_start: "asc" } },
  });

  // Combine data
  const roster = Array.from(uniquePlayersMap.values()).map((pData) => {
    const pid = pData.player.id;
    const playerDob = pData.player.date_of_birth ? new Date(pData.player.date_of_birth) : null;
    
    // Player is training up if explicitly marked playing_up OR born after target division's DOB end (i.e. belongs to a younger birth year)
    const isTrainUp =
      pData.season_players.some((sp: any) => sp.playing_up === true) ||
      (targetDobEnd && playerDob && playerDob > targetDobEnd);

    return {
      player: pData.player,
      club: pData.club,
      seasonAssignments: pData.season_players,
      availability_status: eventAvailabilityMap.get(pid) || "available",
      attendance_status: sessionAttendanceMap.get(pid) || "not_checked_in",
      isTrainUp: !!isTrainUp,
    };
  });

  // Sort alphabetically by last name, then first name
  roster.sort((a, b) => {
    const aName = `${a.player.last_name} ${a.player.first_name}`.toLowerCase();
    const bName = `${b.player.last_name} ${b.player.first_name}`.toLowerCase();
    return aName.localeCompare(bName);
  });

  // Also fetch all available players in the club for the Train-Up Player picker
  const allClubPlayers = await db.players.findMany({
    where: {
      season_players: {
        some: {
          ...(scope.isClubAdmin ? { club_id: scope.clubId } : {}),
        },
      },
    },
    include: {
      season_players: {
        include: {
          season_age_groups: {
            include: { age_groups: true },
          },
        },
      },
    },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
  });

  return {
    session,
    event,
    roster,
    allClubPlayers,
    sessionDivisions,
    userScope: { role: scope.role, isSystemAdmin: scope.isSystemAdmin },
  };
}

/**
 * Adds an individual player (e.g. from a younger age group) to train up in a session.
 */
export async function addTrainUpPlayerToSession(sessionId: number, playerId: number) {
  const sessionUser = await getServerAuthSession();
  const scope = getScopeFilters(sessionUser);

  const session = await db.sessions.findUnique({
    where: { id: sessionId },
    include: { events: true },
  });

  if (!session) {
    return { success: false, error: "Session not found." };
  }

  // 1. Add to event_players (available)
  await db.event_players.upsert({
    where: {
      event_id_player_id: {
        event_id: session.event_id,
        player_id: playerId,
      },
    },
    update: { availability_status: "available" },
    create: {
      event_id: session.event_id,
      player_id: playerId,
      availability_status: "available",
    },
  });

  // 2. Add to session_players (present)
  await db.session_players.upsert({
    where: {
      session_id_player_id: {
        session_id: sessionId,
        player_id: playerId,
      },
    },
    update: { attendance_status: "present" },
    create: {
      session_id: sessionId,
      player_id: playerId,
      attendance_status: "present",
    },
  });

  // 3. Mark playing_up = true on the player's season_players registration if assigned
  if (session.season_age_group_id) {
    const sp = await db.season_players.findFirst({
      where: {
        player_id: playerId,
      },
    });
    if (sp) {
      await db.season_players.update({
        where: { id: sp.id },
        data: { playing_up: true },
      });
    }
  }

  revalidatePath(`/admin/sessions/${sessionId}`);
  return { success: true };
}

export async function updateEventAvailability(eventId: number, playerId: number, status: string) {
  const session = await getServerAuthSession();
  getScopeFilters(session); // verify auth

  await db.event_players.upsert({
    where: {
      event_id_player_id: {
        event_id: eventId,
        player_id: playerId,
      },
    },
    update: {
      availability_status: status as any,
    },
    create: {
      event_id: eventId,
      player_id: playerId,
      availability_status: status as any,
    },
  });

  // Revalidate so data is fresh next load (though we'll use optimistic updates in UI)
  revalidatePath(`/admin/sessions/[id]`, "page");
  return { success: true };
}

export async function updateSessionAttendance(sessionId: number, playerId: number, status: string) {
  const session = await getServerAuthSession();
  getScopeFilters(session); // verify auth

  await db.session_players.upsert({
    where: {
      session_id_player_id: {
        session_id: sessionId,
        player_id: playerId,
      },
    },
    update: {
      attendance_status: status as any,
    },
    create: {
      session_id: sessionId,
      player_id: playerId,
      attendance_status: status as any,
    },
  });

  revalidatePath(`/admin/sessions/[id]`, "page");
  return { success: true };
}

export async function updatePlayerTryoutNumber(seasonAgeGroupId: number, playerId: number, clubId: number | null, tryoutNumber: string) {
  const session = await getServerAuthSession();
  getScopeFilters(session); // verify auth

  // Query first to find existing record
  const existing = await db.season_players.findFirst({
    where: {
      player_id: playerId,
      season_age_group_id: seasonAgeGroupId,
      club_id: clubId,
    },
  });

  if (existing) {
    await db.season_players.update({
      where: { id: existing.id },
      data: {
        tryout_number: tryoutNumber || null,
      },
    });
  } else {
    await db.season_players.create({
      data: {
        player_id: playerId,
        season_age_group_id: seasonAgeGroupId,
        club_id: clubId,
        tryout_number: tryoutNumber || null,
      },
    });
  }

  revalidatePath(`/admin/sessions/[id]`, "page");
  return { success: true };
}

export async function updateSessionRosterBatch(
  sessionId: number,
  eventId: number,
  updates: {
    playerId: number;
    availabilityStatus?: string;
    attendanceStatus?: string;
    tryoutUpdates?: { seasonAgeGroupId: number; clubId: number | null; tryoutNumber: string }[];
  }[]
) {
  const session = await getServerAuthSession();
  getScopeFilters(session); // verify auth

  await db.$transaction(async (tx) => {
    for (const update of updates) {
      const pid = update.playerId;

      // 1. Update Availability
      if (update.availabilityStatus) {
        await tx.event_players.upsert({
          where: {
            event_id_player_id: {
              event_id: eventId,
              player_id: pid,
            },
          },
          update: {
            availability_status: update.availabilityStatus as any,
          },
          create: {
            event_id: eventId,
            player_id: pid,
            availability_status: update.availabilityStatus as any,
          },
        });
      }

      // 2. Update Attendance
      if (update.attendanceStatus) {
        await tx.session_players.upsert({
          where: {
            session_id_player_id: {
              session_id: sessionId,
              player_id: pid,
            },
          },
          update: {
            attendance_status: update.attendanceStatus as any,
          },
          create: {
            session_id: sessionId,
            player_id: pid,
            attendance_status: update.attendanceStatus as any,
          },
        });
      }

      // 3. Update Tryout Numbers
      if (update.tryoutUpdates) {
        for (const tu of update.tryoutUpdates) {
          const existing = await tx.season_players.findFirst({
            where: {
              player_id: pid,
              season_age_group_id: tu.seasonAgeGroupId,
              club_id: tu.clubId,
            },
          });

          if (existing) {
            await tx.season_players.update({
              where: { id: existing.id },
              data: {
                tryout_number: tu.tryoutNumber || null,
              },
            });
          } else {
            await tx.season_players.create({
              data: {
                player_id: pid,
                season_age_group_id: tu.seasonAgeGroupId,
                club_id: tu.clubId,
                tryout_number: tu.tryoutNumber || null,
              },
            });
          }
        }
      }
    }
  }, {
    maxWait: 10000,
    timeout: 30000,
  });

  revalidatePath(`/admin/sessions/[id]`, "page");
  return { success: true };
}
