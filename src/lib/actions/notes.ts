"use server";

import db from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface NoteInput {
  playerId: number;
  noteText: string;
  eventId?: number;
  sessionId?: number;
  invitationId?: number;
}

export async function addCoachNote(input: NoteInput) {
  const sessionUser = await getServerAuthSession();
  if (!sessionUser || !sessionUser.user) {
    return { success: false, error: "Unauthorized" };
  }

  const trimmedText = input.noteText.trim();
  if (!trimmedText) {
    return { success: false, error: "Note text cannot be empty." };
  }

  const coachUserId = Number(sessionUser.user.id);

  try {
    const note = await db.coach_notes.create({
      data: {
        coach_id: coachUserId,
        player_id: input.playerId,
        note_text: trimmedText,
        event_id: input.eventId || null,
        session_id: input.sessionId || null,
        invitation_id: input.invitationId || null
      },
      include: {
        users: { select: { id: true, name: true, email: true, role: true } },
        events: { select: { id: true, name: true } },
        sessions: { select: { id: true, name: true } },
        invitations: { select: { id: true, status: true, season_teams: { include: { teams: true } } } }
      }
    });

    revalidatePath("/admin/players");
    revalidatePath("/admin/invitations");
    revalidatePath("/admin/teams/placement");
    revalidatePath("/admin/events");

    return { success: true, note };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to add coach note." };
  }
}

export async function getPlayerNotes(playerId: number) {
  const sessionUser = await getServerAuthSession();
  if (!sessionUser) {
    return { success: false, error: "Unauthorized", notes: [] };
  }

  try {
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

    return { success: true, notes };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch notes.", notes: [] };
  }
}

export async function deleteCoachNote(noteId: number) {
  const sessionUser = await getServerAuthSession();
  if (!sessionUser || !sessionUser.user) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = Number(sessionUser.user.id);
  const role = sessionUser.user.role;
  const isCoordinator = role === "system_admin" || role === "club_admin" || role === "age_group_admin";

  try {
    const existingNote = await db.coach_notes.findUnique({
      where: { id: noteId }
    });

    if (!existingNote) {
      return { success: false, error: "Note not found." };
    }

    if (existingNote.coach_id !== userId && !isCoordinator) {
      return { success: false, error: "You do not have permission to delete this note." };
    }

    await db.coach_notes.delete({
      where: { id: noteId }
    });

    revalidatePath("/admin/players");
    revalidatePath("/admin/invitations");
    revalidatePath("/admin/teams/placement");

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to delete note." };
  }
}
