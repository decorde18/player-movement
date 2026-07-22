"use server";

import db from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { getScopeFilters } from "@/lib/permissions";
import { getActiveClubId } from "@/lib/actions/clubs";
import { revalidatePath } from "next/cache";

export interface TeamInput {
  id?: number;
  name: string;
  club_id: number;
  season_age_group_id?: number;
}

export async function getTeamsData() {
  const session = await getServerAuthSession();
  const activeClubId = await getActiveClubId();
  const scope = getScopeFilters(session, activeClubId);

  const clubFilter = scope.filters.club();
  const seasonFilter = scope.filters.season();

  const [teams, clubs, seasonAgeGroups] = await Promise.all([
    db.teams.findMany({
      where: clubFilter,
      include: {
        clubs: true,
        season_teams: {
          include: {
            season_age_groups: {
              include: {
                seasons: true,
                age_groups: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.clubs.findMany({
      where: clubFilter,
      orderBy: { name: "asc" },
    }),
    db.season_age_groups.findMany({
      where: {
        seasons: seasonFilter,
      },
      include: {
        seasons: true,
        age_groups: true,
      },
      orderBy: [
        { seasons: { start_date: "desc" } },
        { age_groups: { name: "asc" } },
      ],
    }),
  ]);

  return {
    teams,
    clubs,
    seasonAgeGroups,
    userScope: {
      role: scope.role,
      clubId: scope.clubId,
      isSystemAdmin: scope.isSystemAdmin,
    },
  };
}

export async function createTeam(input: TeamInput) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    if (scope.isClubAdmin && input.club_id !== scope.clubId) {
      return { success: false, error: "Access Denied: Cannot manage teams outside your club." };
    }

    const updatedOrNewTeam = await db.$transaction(async (tx) => {
      let team;

      if (input.id) {
        team = await tx.teams.update({
          where: { id: input.id },
          data: {
            name: input.name,
            club_id: input.club_id,
          },
        });
      } else {
        team = await tx.teams.create({
          data: {
            name: input.name,
            club_id: input.club_id,
          },
        });
      }

      if (input.season_age_group_id) {
        // Find if this team is already linked to this season_age_group
        const existingSt = await tx.season_teams.findFirst({
          where: {
            team_id: team.id,
            season_age_group_id: input.season_age_group_id,
          },
        });

        if (!existingSt) {
          await tx.season_teams.create({
            data: {
              team_id: team.id,
              season_age_group_id: input.season_age_group_id,
            },
          });
        }
      }

      return team;
    });

    revalidatePath("/admin/teams");
    return { success: true, team: updatedOrNewTeam };
  } catch (error: any) {
    console.error("createTeam Error:", error);
    return { success: false, error: error.message || "Failed to save team." };
  }
}

export async function deleteTeam(teamId: number) {
  try {
    const session = await getServerAuthSession();
    const scope = getScopeFilters(session);

    const team = await db.teams.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      return { success: false, error: "Team not found." };
    }

    if (scope.isClubAdmin && team.club_id !== scope.clubId) {
      return { success: false, error: "Access Denied: Cannot delete teams outside your club." };
    }

    await db.teams.delete({
      where: { id: teamId },
    });

    revalidatePath("/admin/teams");
    return { success: true };
  } catch (error: any) {
    console.error("deleteTeam Error:", error);
    return { success: false, error: error.message || "Failed to delete team." };
  }
}
