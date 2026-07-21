"use server";

import db from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { getScopeFilters } from "@/lib/permissions";
import { getActiveClubId } from "@/lib/actions/clubs";
import { revalidatePath } from "next/cache";

export interface NoteInput {
  note_text: string;
  event_id: number;
  session_id?: number | null;
}

/**
 * Fetch detailed profile data for a specific player, including seasons, team assignments, and notes
 */
export async function getPlayerData(playerId: number) {
  try {
    const session = await getServerAuthSession();
    const activeClubId = await getActiveClubId();
    const scope = getScopeFilters(session, activeClubId);

    // Enforce scoping filters
    const playerFilter = scope.filters.player();
    
    const player = await db.players.findFirst({
      where: {
        id: playerId,
        ...playerFilter,
      },
      include: {
        season_players: {
          include: {
            season_age_groups: {
              include: {
                seasons: true,
                age_groups: true,
              },
            },
            clubs: true,
            season_teams: {
              include: {
                teams: true,
              },
            },
          },
        },
        coach_notes: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
            events: {
              select: {
                id: true,
                name: true,
              },
            },
            sessions: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            created_at: "desc",
          },
        },
      },
    });

    if (!player) {
      return { success: false, error: "Player not found or access denied." };
    }

    // Retrieve allowed events for this coach/admin to attach notes to
    const eventFilter = scope.filters.event();
    const events = await db.events.findMany({
      where: eventFilter,
      include: {
        seasons: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return {
      success: true,
      player,
      events,
      currentUser: {
        id: Number(session?.user?.id),
        role: session?.user?.role,
      },
    };
  } catch (error: any) {
    console.error("getPlayerData Error:", error);
    return { success: false, error: error.message || "Failed to load player details." };
  }
}

/**
 * Create a new coach note for a player
 */
export async function createPlayerNote(playerId: number, input: NoteInput) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user) {
      return { success: false, error: "Unauthorized: Please log in." };
    }

    const currentUserId = Number(session.user.id);
    if (!currentUserId) {
      return { success: false, error: "Invalid user account session." };
    }

    if (!input.note_text.trim()) {
      return { success: false, error: "Note text cannot be empty." };
    }

    // Create the note record
    const note = await db.coach_notes.create({
      data: {
        coach_id: currentUserId,
        player_id: playerId,
        event_id: input.event_id,
        session_id: input.session_id || null,
        note_text: input.note_text.trim(),
      },
    });

    revalidatePath(`/admin/players/${playerId}`);
    return { success: true, note };
  } catch (error: any) {
    console.error("createPlayerNote Error:", error);
    return { success: false, error: error.message || "Failed to create note." };
  }
}

/**
 * Delete a coach note
 */
export async function deletePlayerNote(noteId: number, playerId: number) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user) {
      return { success: false, error: "Unauthorized: Please log in." };
    }

    const targetNote = await db.coach_notes.findUnique({
      where: { id: noteId },
    });

    if (!targetNote) {
      return { success: false, error: "Note not found." };
    }

    // Verify deletion rights: Author or System Admin
    const isAuthor = targetNote.coach_id === Number(session.user.id);
    const isSystemAdmin = session.user.role === "system_admin";

    if (!isAuthor && !isSystemAdmin) {
      return { success: false, error: "Access Denied: Only the author or system admin can delete this note." };
    }

    await db.coach_notes.delete({
      where: { id: noteId },
    });

    revalidatePath(`/admin/players/${playerId}`);
    return { success: true };
  } catch (error: any) {
    console.error("deletePlayerNote Error:", error);
    return { success: false, error: error.message || "Failed to delete note." };
  }
}
