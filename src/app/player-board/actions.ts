"use server";

import db from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { getScopeFilters } from "@/lib/permissions";
import { getActiveClubId } from "@/lib/actions/clubs";
import { revalidatePath } from "next/cache";

/**
 * Fetch all dropdown options for selectors (Seasons, Events, Sessions, Divisions)
 */
export async function getSelectorData() {
  const session = await getServerAuthSession();
  const activeClubId = await getActiveClubId();
  const scope = getScopeFilters(session, activeClubId);

  const seasonFilter = scope.filters.season();
  const eventFilter = scope.filters.event();

  const [seasons, events] = await Promise.all([
    db.seasons.findMany({
      where: seasonFilter,
      orderBy: { start_date: "desc" },
    }),
    db.events.findMany({
      where: eventFilter,
      include: {
        seasons: true,
        sessions: {
          orderBy: { session_date: "asc" },
        },
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
      orderBy: { created_at: "desc" },
    }),
  ]);

  return {
    seasons,
    events: events.map(e => ({
      id: e.id,
      name: e.name,
      seasonId: e.season_id,
      sessions: e.sessions,
      divisions: e.event_divisions.map(ed => ({
        id: ed.season_age_groups.id,
        name: ed.season_age_groups.age_groups.name,
        gender: ed.season_age_groups.gender,
      })),
    })),
  };
}

/**
 * Fetch board data: fields, players and their placements
 */
export async function getBoardData(sessionId: number, divisionId?: number) {
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
    },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  // 1. Get divisions
  const event = session.events;
  const divisionIds = divisionId 
    ? [divisionId] 
    : (session.season_age_group_id
        ? [session.season_age_group_id]
        : event.event_divisions.map((d) => d.season_age_group_id));

  // 2. Fetch session fields
  const fields = await db.session_fields.findMany({
    where: { session_id: sessionId },
    orderBy: { id: "asc" },
  });

  if (divisionIds.length === 0) {
    return { session, fields, players: [] };
  }

  // 3. Fetch season_players in selected division(s)
  const seasonPlayers = await db.season_players.findMany({
    where: {
      season_age_group_id: { in: divisionIds },
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

  // Deduplicate season_players by player_id to prevent duplicate cards on the board
  const uniqueSeasonPlayersMap = new Map<number, typeof seasonPlayers[0]>();
  for (const sp of seasonPlayers) {
    if (!uniqueSeasonPlayersMap.has(sp.player_id)) {
      uniqueSeasonPlayersMap.set(sp.player_id, sp);
    }
  }
  const uniqueSeasonPlayers = Array.from(uniqueSeasonPlayersMap.values());

  const playerIds = uniqueSeasonPlayers.map(sp => sp.player_id);

  // 4. Fetch availability
  const eventPlayers = await db.event_players.findMany({
    where: {
      event_id: event.id,
      player_id: { in: playerIds },
    },
  });
  const availabilityMap = new Map(eventPlayers.map(ep => [ep.player_id, ep.availability_status]));

  // 5. Fetch session attendance & placement
  const sessionPlayers = await db.session_players.findMany({
    where: {
      session_id: sessionId,
      player_id: { in: playerIds },
    },
  });
  const sessionPlayerMap = new Map(sessionPlayers.map(sp => [sp.player_id, sp]));

  // 6. Combine player data
  const players = uniqueSeasonPlayers.map(sp => {
    const sPlayer = sessionPlayerMap.get(sp.player_id);
    return {
      id: sp.players.id,
      first_name: sp.players.first_name,
      last_name: sp.players.last_name,
      tryout_number: sp.tryout_number,
      position: sp.position,
      rating: sPlayer?.rating || sp.rating || 0,
      gender: sp.players.gender,
      clubName: sp.clubs?.name || "No Club",
      divisionName: sp.season_age_groups?.age_groups?.name || "N/A",
      divisionGender: sp.season_age_groups?.gender || "N/A",
      assignedTeamName: sp.season_teams?.teams?.name || "Unassigned",
      availability: availabilityMap.get(sp.player_id) || "available",
      attendance: sPlayer?.attendance_status || "present",
      fieldId: sPlayer?.field_id || null,
    };
  });

  return {
    session,
    fields,
    players,
  };
}

/**
 * Create a new field for a session
 */
export async function createField(sessionId: number, name: string) {
  const sessionUser = await getServerAuthSession();
  getScopeFilters(sessionUser); // auth check

  const field = await db.session_fields.create({
    data: {
      session_id: sessionId,
      name,
    },
  });

  revalidatePath("/player-board");
  return { success: true, field };
}

/**
 * Rename a field
 */
export async function renameField(fieldId: number, name: string) {
  const sessionUser = await getServerAuthSession();
  getScopeFilters(sessionUser); // auth check

  await db.session_fields.update({
    where: { id: fieldId },
    data: { name },
  });

  revalidatePath("/player-board");
  return { success: true };
}

/**
 * Delete a field and unassign any players inside it
 */
export async function deleteField(fieldId: number) {
  const sessionUser = await getServerAuthSession();
  getScopeFilters(sessionUser); // auth check

  await db.$transaction([
    db.session_players.updateMany({
      where: { field_id: fieldId },
      data: { field_id: null },
    }),
    db.session_fields.delete({
      where: { id: fieldId },
    }),
  ]);

  revalidatePath("/player-board");
  return { success: true };
}

/**
 * Assign/Move player to a field
 */
export async function movePlayer(sessionId: number, playerId: number, fieldId: number | null) {
  const sessionUser = await getServerAuthSession();
  getScopeFilters(sessionUser); // auth check

  await db.session_players.upsert({
    where: {
      session_id_player_id: {
        session_id: sessionId,
        player_id: playerId,
      },
    },
    update: {
      field_id: fieldId,
    },
    create: {
      session_id: sessionId,
      player_id: playerId,
      field_id: fieldId,
      attendance_status: "present",
    },
  });

  revalidatePath("/player-board");
  return { success: true };
}

/**
 * Carry over fields and player assignments from the previous session
 */
export async function carryOverPreviousSession(sessionId: number) {
  const sessionUser = await getServerAuthSession();
  getScopeFilters(sessionUser); // auth check

  // 1. Get current session details
  const currentSession = await db.sessions.findUnique({
    where: { id: sessionId },
  });
  if (!currentSession) throw new Error("Current session not found");

  // 2. Find the previous session of the same event
  const previousSession = await db.sessions.findFirst({
    where: {
      event_id: currentSession.event_id,
      session_date: { lt: currentSession.session_date },
    },
    orderBy: { session_date: "desc" },
  });

  if (!previousSession) {
    return { success: false, error: "No previous session found for this event." };
  }

  // 3. Clone fields and player assignments
  await db.$transaction(async (tx) => {
    // Get fields from previous session
    const prevFields = await tx.session_fields.findMany({
      where: { session_id: previousSession.id },
    });

    const newFieldMap = new Map<number, number>();

    // Copy fields
    for (const f of prevFields) {
      const newField = await tx.session_fields.create({
        data: {
          session_id: sessionId,
          name: f.name,
          sort_by: f.sort_by,
          sort_direction: f.sort_direction,
          filter_by: f.filter_by,
          rating_filter: f.rating_filter,
        },
      });
      newFieldMap.set(f.id, newField.id);
    }

    // Get previous player assignments
    const prevPlayers = await tx.session_players.findMany({
      where: {
        session_id: previousSession.id,
        field_id: { not: null },
      },
    });

    // Create assignments for current session with mapped fields
    for (const sp of prevPlayers) {
      if (!sp.field_id) continue;
      const newFieldId = newFieldMap.get(sp.field_id);
      if (!newFieldId) continue;

      await tx.session_players.upsert({
        where: {
          session_id_player_id: {
            session_id: sessionId,
            player_id: sp.player_id,
          },
        },
        update: {
          field_id: newFieldId,
        },
        create: {
          session_id: sessionId,
          player_id: sp.player_id,
          field_id: newFieldId,
          attendance_status: sp.attendance_status || "present",
        },
      });
    }
  });

  revalidatePath("/player-board");
  return { success: true };
}

/**
 * Batch update player field assignments
 */
export async function savePlacements(
  sessionId: number,
  placements: { playerId: number; fieldId: number | null }[]
) {
  const sessionUser = await getServerAuthSession();
  getScopeFilters(sessionUser); // auth check

  await db.$transaction(
    placements.map((p) =>
      db.session_players.upsert({
        where: {
          session_id_player_id: {
            session_id: sessionId,
            player_id: p.playerId,
          },
        },
        update: {
          field_id: p.fieldId,
        },
        create: {
          session_id: sessionId,
          player_id: p.playerId,
          field_id: p.fieldId,
          attendance_status: "present",
        },
      })
    )
  );

  revalidatePath("/player-board");
  return { success: true };
}

export async function getPlayerSessionHistory(eventId: number, playerId: number) {
  const sessionUser = await getServerAuthSession();
  getScopeFilters(sessionUser); // auth check

  const userRole = sessionUser?.user?.role;
  const userEmail = sessionUser?.user?.email;
  const isCoordinator = ["system_admin", "club_admin", "age_group_admin"].includes(userRole || "");

  // Find all sessions under the event
  const sessions = await db.sessions.findMany({
    where: { event_id: eventId },
    orderBy: { session_date: "asc" },
  });

  const sessionIds = sessions.map(s => s.id);

  // Find player's records in those sessions and notes
  const [sessionRecords, notes] = await Promise.all([
    db.session_players.findMany({
      where: {
        player_id: playerId,
        session_id: { in: sessionIds },
      },
    }),
    db.coach_notes.findMany({
      where: {
        player_id: playerId,
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    }),
  ]);

  const recordMap = new Map(sessionRecords.map(r => [r.session_id, r]));

  const history = sessions
    .filter((s) => recordMap.has(s.id))
    .map((s) => {
      const record = recordMap.get(s.id)!;
      return {
        sessionId: s.id,
        sessionName: s.name,
        sessionDate: s.session_date,
        attendance: record.attendance_status || "absent",
        rank: record.rank || 0,
        rating: record.rating || 0,
      };
    });

  const scopedNotes = notes.filter(n => {
    if (isCoordinator) return true;
    return n.users?.email === userEmail;
  });

  return {
    history,
    notes: scopedNotes.map(n => ({
      id: n.id,
      noteText: n.note_text,
      createdAt: n.created_at,
      authorName: n.users?.name || "Evaluator",
    })),
  };
}
