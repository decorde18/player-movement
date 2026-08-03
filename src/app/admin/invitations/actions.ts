"use server";

import db from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { getActiveClubId } from "@/lib/actions/clubs";
import { revalidatePath } from "next/cache";

export async function getRosterInvitations(seasonAgeGroupId?: number, seasonTeamId?: number) {
  const sessionUser = await getServerAuthSession();
  const activeClubId = await getActiveClubId();

  // 1. Fetch available season age groups
  let ageGroupWhere: any = {};
  if (activeClubId) {
    ageGroupWhere = {
      seasons: {
        club_seasons: {
          some: { club_id: activeClubId }
        }
      }
    };
  }

  const seasonAgeGroups = await db.season_age_groups.findMany({
    where: ageGroupWhere,
    include: {
      age_groups: true,
    },
    orderBy: {
      name: "asc"
    }
  });

  const selectedAgeGroupId = seasonAgeGroupId || (seasonAgeGroups[0]?.id ?? 0);

  // 2. Fetch season teams for selected age group
  const seasonTeams = await db.season_teams.findMany({
    where: selectedAgeGroupId ? { season_age_group_id: selectedAgeGroupId } : {},
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

  // 3. Filter by season_team_id if provided
  let playerWhere: any = {};
  if (selectedAgeGroupId) {
    playerWhere.season_age_group_id = selectedAgeGroupId;
  }
  if (seasonTeamId) {
    playerWhere.season_team_id = seasonTeamId;
  }

  // 4. Fetch season players with invitations & uniform numbers
  const seasonPlayers = await db.season_players.findMany({
    where: playerWhere,
    include: {
      players: true,
      season_teams: {
        include: { teams: true }
      },
      season_age_groups: {
        include: { age_groups: true }
      },
      team_invitations: {
        include: {
          season_teams: {
            include: { teams: true }
          }
        },
        orderBy: { created_at: "desc" }
      }
    },
    orderBy: {
      players: { last_name: "asc" }
    }
  });

  // 5. Determine user edit rights
  const role = sessionUser?.user?.role || "coach";
  const userAssignedTeamId = (sessionUser?.user as any)?.assignedTeamId || null;
  const isCoordinator = role === "system_admin" || role === "club_admin" || role === "age_group_admin";

  return {
    seasonAgeGroups,
    selectedAgeGroupId,
    seasonTeams,
    seasonPlayers,
    userRole: role,
    userAssignedTeamId,
    isCoordinator
  };
}

export async function sendTeamInvitation(seasonPlayerId: number, seasonTeamId: number, notes?: string) {
  const sessionUser = await getServerAuthSession();
  if (!sessionUser) {
    return { success: false, error: "Unauthorized" };
  }

  // Enforce max 1 pending invitation per player
  const existingPending = await db.team_invitations.findFirst({
    where: {
      season_player_id: seasonPlayerId,
      status: "pending"
    }
  });

  if (existingPending) {
    return { 
      success: false, 
      error: "Player already has an active pending invitation. Please resolve or expire it before sending a new invitation." 
    };
  }

  try {
    // 1. Assign player to season_team_id if not already set
    await db.season_players.update({
      where: { id: seasonPlayerId },
      data: { season_team_id: seasonTeamId }
    });

    // 2. Create pending team invitation
    const invitation = await db.team_invitations.create({
      data: {
        season_player_id: seasonPlayerId,
        season_team_id: seasonTeamId,
        status: "pending",
        sent_at: new Date(),
        notes: notes?.trim() || null
      }
    });

    revalidatePath("/admin/invitations");
    revalidatePath("/admin/teams/placement");
    return { success: true, invitation };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to send team invitation." };
  }
}

export async function updateInvitationStatus(invitationId: number, status: string, notes?: string) {
  const sessionUser = await getServerAuthSession();
  if (!sessionUser) {
    return { success: false, error: "Unauthorized" };
  }

  const validStatuses = ["pending", "accepted", "declined", "expired"];
  if (!validStatuses.includes(status)) {
    return { success: false, error: "Invalid invitation status." };
  }

  try {
    const updated = await db.team_invitations.update({
      where: { id: invitationId },
      data: {
        status,
        responded_at: status !== "pending" ? new Date() : null,
        notes: notes !== undefined ? notes.trim() : undefined,
        updated_at: new Date()
      }
    });

    revalidatePath("/admin/invitations");
    revalidatePath("/admin/teams/placement");
    return { success: true, invitation: updated };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update invitation status." };
  }
}

export async function updateUniformNumber(seasonPlayerId: number, uniformNumber: string) {
  const sessionUser = await getServerAuthSession();
  if (!sessionUser) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await db.season_players.update({
      where: { id: seasonPlayerId },
      data: {
        uniform_number: uniformNumber.trim() || null
      }
    });

    revalidatePath("/admin/invitations");
    revalidatePath("/admin/teams/placement");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update uniform number." };
  }
}

export async function bulkSendInvitations(seasonPlayerIds: number[], seasonTeamId: number) {
  const sessionUser = await getServerAuthSession();
  if (!sessionUser) {
    return { success: false, error: "Unauthorized" };
  }

  let sentCount = 0;
  let skippedCount = 0;

  for (const pid of seasonPlayerIds) {
    const existingPending = await db.team_invitations.findFirst({
      where: {
        season_player_id: pid,
        status: "pending"
      }
    });

    if (existingPending) {
      skippedCount++;
      continue;
    }

    try {
      await db.season_players.update({
        where: { id: pid },
        data: { season_team_id: seasonTeamId }
      });

      await db.team_invitations.create({
        data: {
          season_player_id: pid,
          season_team_id: seasonTeamId,
          status: "pending",
          sent_at: new Date()
        }
      });

      sentCount++;
    } catch {
      skippedCount++;
    }
  }

  revalidatePath("/admin/invitations");
  revalidatePath("/admin/teams/placement");

  return {
    success: true,
    sentCount,
    skippedCount
  };
}
