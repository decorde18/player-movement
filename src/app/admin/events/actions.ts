"use server";

import db from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { getScopeFilters } from "@/lib/permissions";
import { getActiveClubId } from "@/lib/actions/clubs";
import { revalidatePath } from "next/cache";

export interface SeasonInput {
  name: string;
  start_date?: string;
  end_date?: string;
}

export interface EventInput {
  season_id: number;
  name: string;
  event_type: "tryout" | "ranking";
  season_age_group_ids?: number[];
  season_team_id?: number;
}

import { cookies } from "next/headers";

export interface SessionInput {
  event_id: number;
  name: string;
  session_date: string;
  season_age_group_ids?: number[];
}

/**
 * Fetch hierarchical data for Seasons, Events, and Sessions matching the scope.
 */
export async function getEventsDashboardData() {
  const session = await getServerAuthSession();
  const activeClubId = await getActiveClubId();
  const scope = getScopeFilters(session, activeClubId);
  const seasonFilter = scope.filters.season();

  const cookieStore = await cookies();
  const activeAgeGroupIdStr = cookieStore.get("activeAgeGroupId")?.value;
  const activeAgeGroupId = activeAgeGroupIdStr ? parseInt(activeAgeGroupIdStr, 10) : null;

  // Filter events by the active division if selected
  const eventWhereFilter = activeAgeGroupId
    ? {
        event_divisions: {
          some: {
            season_age_group_id: activeAgeGroupId,
          },
        },
      }
    : undefined;

  const seasons = await db.seasons.findMany({
    where: seasonFilter,
    include: {
      events: {
        where: eventWhereFilter,
        include: {
          sessions: {
            include: {
              season_age_groups: {
                include: {
                  age_groups: true,
                },
              },
            },
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
      },
      season_age_groups: {
        include: {
          age_groups: true,
        },
      },
    },
    orderBy: { start_date: "desc" },
  });

  const seasonTeams = await db.season_teams.findMany({
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

  return {
    seasons,
    seasonTeams,
    userScope: {
      role: scope.role,
      clubId: scope.clubId,
      isSystemAdmin: scope.isSystemAdmin,
    },
  };
}

/**
 * Creates a new Season. Under club scope, it also creates the club_seasons link.
 */
export async function createSeason(input: SeasonInput) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    const startDate = input.start_date ? new Date(input.start_date) : null;
    const endDate = input.end_date ? new Date(input.end_date) : null;

    const newSeason = await db.$transaction(async (tx) => {
      // 1. Create the Season record
      const season = await tx.seasons.create({
        data: {
          name: input.name,
          start_date: startDate,
          end_date: endDate,
        },
      });

      // 2. Link to Club if under Club Admin scope
      if (scope.isClubAdmin && scope.clubId) {
        await tx.club_seasons.create({
          data: {
            club_id: scope.clubId,
            season_id: season.id,
          },
        });
      }

      return season;
    });

    revalidatePath("/admin/events");
    return { success: true, season: newSeason };
  } catch (error: any) {
    console.error("createSeason Error:", error);
    return { success: false, error: error.message || "Failed to create season." };
  }
}

/**
 * Creates an Event inside an active Season.
 */
export async function createEvent(input: EventInput) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    // Security Check: Verify season exists and matches the user's scope
    const season = await db.seasons.findFirst({
      where: {
        id: input.season_id,
        ...scope.filters.season(),
      },
    });

    if (!season) {
      return { success: false, error: "Access Denied: Season not found or out of scope." };
    }

    let divisionIds = input.season_age_group_ids || [];

    // If season_team_id is provided for a Team-Level Event, resolve its season_age_group_id
    if (input.season_team_id) {
      const seasonTeam = await db.season_teams.findUnique({
        where: { id: input.season_team_id },
        select: { season_age_group_id: true }
      });
      if (seasonTeam && !divisionIds.includes(seasonTeam.season_age_group_id)) {
        divisionIds = [seasonTeam.season_age_group_id];
      }
    }

    const event = await db.$transaction(async (tx) => {
      // 1. Create the event
      const newEvent = await tx.events.create({
        data: {
          season_id: input.season_id,
          name: input.name,
          event_type: input.event_type,
        },
      });

      // 2. Insert event_divisions for each selected age group
      if (divisionIds.length > 0) {
        await tx.event_divisions.createMany({
          data: divisionIds.map((sagId) => ({
            event_id: newEvent.id,
            season_age_group_id: sagId,
          })),
          skipDuplicates: true,
        });

        // 3. Fetch season_players in these divisions (restricted to season_team_id if team event)
        let playerWhere: any = {
          season_age_group_id: { in: divisionIds },
          ...(scope.isClubAdmin ? { club_id: scope.clubId } : {}),
        };

        if (input.season_team_id) {
          playerWhere.season_team_id = input.season_team_id;
        }

        const eligiblePlayers = await tx.season_players.findMany({
          where: playerWhere,
          select: { player_id: true },
        });

        // Deduplicate player_ids
        const uniquePlayerIds = [...new Set(eligiblePlayers.map((sp) => sp.player_id))];

        // 4. Bulk-insert event_players with unavailable status
        if (uniquePlayerIds.length > 0) {
          await tx.event_players.createMany({
            data: uniquePlayerIds.map((pid) => ({
              event_id: newEvent.id,
              player_id: pid,
              availability_status: "unavailable" as const,
            })),
            skipDuplicates: true,
          });
        }
      }

      return newEvent;
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    revalidatePath("/admin/events");
    return { success: true, event };
  } catch (error: any) {
    console.error("createEvent Error:", error);
    return { success: false, error: error.message || "Failed to create event." };
  }
}

/**
 * Creates a Session inside an Event.
 */
export async function createSession(input: SessionInput) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    // Security Check: Verify event exists and matches user scope
    const event = await db.events.findFirst({
      where: {
        id: input.event_id,
        ...scope.filters.event(),
      },
    });

    if (!event) {
      return { success: false, error: "Access Denied: Event not found or out of scope." };
    }

    const date = input.session_date ? new Date(input.session_date) : new Date();
    const divisionIds = input.season_age_group_ids || [];

    if (divisionIds.length > 0) {
      const selectedDivisions = await db.season_age_groups.findMany({
        where: { id: { in: divisionIds } },
        include: { age_groups: true },
      });

      const createdSessions = [];
      for (const div of selectedDivisions) {
        const appendedName = `${input.name} - ${div.age_groups.name} (${div.gender})`;
        const newSession = await db.sessions.create({
          data: {
            event_id: input.event_id,
            season_age_group_id: div.id,
            name: appendedName,
            session_date: date,
          },
        });
        createdSessions.push(newSession);
      }

      revalidatePath("/admin/events");
      return { success: true, sessions: createdSessions };
    } else {
      const newSession = await db.sessions.create({
        data: {
          event_id: input.event_id,
          name: input.name,
          session_date: date,
        },
      });

      revalidatePath("/admin/events");
      return { success: true, session: newSession };
    }
  } catch (error: any) {
    console.error("createSession Error:", error);
    return { success: false, error: error.message || "Failed to create session." };
  }
}

/**
 * Deletes a Session record
 */
export async function deleteSession(sessionId: number) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    // Security Check
    const targetSession = await db.sessions.findFirst({
      where: {
        id: sessionId,
        events: scope.filters.event(),
      },
    });

    if (!targetSession) {
      return { success: false, error: "Access Denied: Session not found or out of scope." };
    }

    await db.sessions.delete({
      where: { id: sessionId },
    });

    revalidatePath("/admin/events");
    return { success: true };
  } catch (error: any) {
    console.error("deleteSession Error:", error);
    return { success: false, error: error.message || "Failed to delete session." };
  }
}

/**
 * Deletes an Event record
 */
export async function deleteEvent(eventId: number) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    // Security Check
    const event = await db.events.findFirst({
      where: {
        id: eventId,
        ...scope.filters.event(),
      },
    });

    if (!event) {
      return { success: false, error: "Access Denied: Event not found or out of scope." };
    }

    await db.events.delete({
      where: { id: eventId },
    });

    revalidatePath("/admin/events");
    return { success: true };
  } catch (error: any) {
    console.error("deleteEvent Error:", error);
    return { success: false, error: error.message || "Failed to delete event." };
  }
}
