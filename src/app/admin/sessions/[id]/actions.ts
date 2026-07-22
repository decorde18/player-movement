"use server";

import db from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { getScopeFilters } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

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
  const divisionIds = event.event_divisions.map((d) => d.season_age_group_id);

  if (divisionIds.length === 0) {
    return {
      session,
      event,
      roster: [],
      userScope: { role: scope.role, isSystemAdmin: scope.isSystemAdmin },
    };
  }

  // 2. Fetch all season_players in those divisions
  const seasonPlayers = await db.season_players.findMany({
    where: {
      season_age_group_id: { in: divisionIds },
      // Apply club filter if the user is a club admin
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

  // Unique players across the divisions
  const uniquePlayersMap = new Map<number, any>();
  for (const sp of seasonPlayers) {
    if (!uniquePlayersMap.has(sp.player_id)) {
      uniquePlayersMap.set(sp.player_id, {
        player: sp.players,
        club: sp.clubs,
        season_players: [sp],
      });
    } else {
      uniquePlayersMap.get(sp.player_id).season_players.push(sp);
    }
  }

  const playerIds = Array.from(uniquePlayersMap.keys());

  // 3. Fetch event_players availability
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

  // 4. Fetch session_players attendance
  const sessionPlayers = await db.session_players.findMany({
    where: {
      session_id: sessionId,
      player_id: { in: playerIds },
    },
  });

  const sessionAttendanceMap = new Map<number, string>();
  for (const sp of sessionPlayers) {
    sessionAttendanceMap.set(sp.player_id, sp.attendance_status || "present");
  }

  // Combine data
  const roster = Array.from(uniquePlayersMap.values()).map((pData) => {
    const pid = pData.player.id;
    return {
      player: pData.player,
      club: pData.club,
      seasonAssignments: pData.season_players,
      availability_status: eventAvailabilityMap.get(pid) || "available",
      attendance_status: sessionAttendanceMap.get(pid) || "present",
    };
  });

  // Sort alphabetically by last name, then first name
  roster.sort((a, b) => {
    const aName = `${a.player.last_name} ${a.player.first_name}`.toLowerCase();
    const bName = `${b.player.last_name} ${b.player.first_name}`.toLowerCase();
    return aName.localeCompare(bName);
  });

  return {
    session,
    event,
    roster,
    userScope: { role: scope.role, isSystemAdmin: scope.isSystemAdmin },
  };
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
