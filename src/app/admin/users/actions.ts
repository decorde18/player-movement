"use server";

import db from "@/lib/db";
import { getServerAuthSession } from "@/lib/auth";
import { getScopeFilters } from "@/lib/permissions";
import { getActiveClubId } from "@/lib/actions/clubs";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

export interface UserInput {
  id?: number;
  name: string;
  email: string;
  password?: string;
  role: "system_admin" | "club_admin" | "age_group_admin" | "coach";
  club_id?: number | null;
  // Legacy single-field (kept for backward compat)
  assigned_age_group_id?: number | null;
  assigned_team_id?: number | null;
  // Multi-assignment arrays (new)
  age_group_ids?: number[];
  season_age_group_ids?: number[];
  season_team_ids?: number[];
}

/**
 * Fetch users, clubs, age groups, and season teams scoped by permissions
 */
export async function getUsersDashboardData() {
  const session = await getServerAuthSession();
  const activeClubId = await getActiveClubId();
  const scope = getScopeFilters(session, activeClubId);

  // Define User Filter
  const userFilter: any = {};
  if (scope.isClubAdmin && scope.clubId) {
    userFilter.club_id = scope.clubId;
    userFilter.role = { not: "system_admin" }; // Club admins cannot view system admins
  } else if (activeClubId) {
    userFilter.club_id = activeClubId;
  }

  const [users, clubs, ageGroups, seasonTeams, seasons] = await Promise.all([
    db.user.findMany({
      where: userFilter,
      include: {
        clubs: true,
        age_groups: {
          include: {
            season_age_groups: {
              select: {
                gender: true,
                name: true,
              },
            },
          },
        },
        season_teams: {
          include: {
            teams: true,
            season_age_groups: {
              include: {
                seasons: true,
                age_groups: true,
              },
            },
          },
        },
        user_age_groups: {
          include: {
            age_groups: {
              include: {
                season_age_groups: {
                  select: {
                    gender: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        user_season_age_groups: {
          include: {
            season_age_groups: {
              include: {
                age_groups: true,
                seasons: true,
              },
            },
          },
        },
        user_season_teams: {
          include: {
            season_teams: {
              include: {
                teams: true,
                season_age_groups: {
                  include: {
                    seasons: true,
                    age_groups: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { created_at: "desc" },
    }),
    db.clubs.findMany({
      orderBy: { name: "asc" },
    }),
    db.age_groups.findMany({
      include: {
        season_age_groups: {
          select: {
            gender: true,
            name: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.season_teams.findMany({
      include: {
        teams: true,
        season_age_groups: {
          include: {
            seasons: true,
            age_groups: true,
          },
        },
      },
      orderBy: [
        { season_age_groups: { age_groups: { name: "asc" } } },
        { sort_order: "asc" },
        { teams: { name: "asc" } },
      ],
    }),
    db.seasons.findMany({
      where: scope.filters.season(),
      orderBy: { start_date: "desc" },
    }),
  ]);

  // Fetch season_age_groups filtered to calendar year age groups for the active/latest season
  const activeSeasonId = seasons.length > 0 ? seasons[0].id : undefined;
  const seasonAgeGroups = await db.season_age_groups.findMany({
    where: {
      age_groups: {
        cutoff_type: "calendar",
      },
      ...(activeSeasonId ? { season_id: activeSeasonId } : {}),
    },
    include: {
      age_groups: true,
      seasons: true,
    },
    orderBy: [
      { age_groups: { name: "asc" } },
      { gender: "asc" },
    ],
  });

  return {
    users,
    clubs,
    ageGroups,
    seasonAgeGroups,
    seasonTeams,
    seasons,
    userScope: {
      role: scope.role,
      clubId: scope.clubId,
      isSystemAdmin: scope.isSystemAdmin,
    },
  };
}

/**
 * Create a new user/staff account
 */
export async function createUser(input: UserInput) {
  try {
    const session = await getServerAuthSession();
    const activeClubId = await getActiveClubId();
    const scope = getScopeFilters(session, activeClubId);

    // Security check
    if (scope.isClubAdmin && input.club_id !== scope.clubId) {
      return { success: false, error: "Access Denied: Cannot create staff outside your club scope." };
    }
    if (scope.isClubAdmin && input.role === "system_admin") {
      return { success: false, error: "Access Denied: Club administrators cannot create system admins." };
    }

    // Verify email uniqueness
    const existing = await db.user.findUnique({
      where: { email: input.email },
    });
    if (existing) {
      return { success: false, error: "Email is already registered." };
    }

    const rawPassword = input.password || "password";
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(rawPassword, salt);

    const newUser = await db.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: hash,
        role: input.role,
        club_id: input.role === "system_admin" ? null : input.club_id || null,
        assigned_age_group_id: null,
        assigned_team_id: null,
      },
    });

    // Write multi-assignment join rows
    const seasonAgeGroupIds = input.season_age_group_ids || [];
    const ageGroupIds = input.age_group_ids || [];
    const seasonTeamIds = input.season_team_ids || [];

    if (seasonAgeGroupIds.length > 0) {
      await db.user_season_age_groups.createMany({
        data: seasonAgeGroupIds.map((sagId) => ({ user_id: newUser.id, season_age_group_id: sagId })),
        skipDuplicates: true,
      });

      const sags = await db.season_age_groups.findMany({
        where: { id: { in: seasonAgeGroupIds } },
        select: { age_group_id: true },
      });
      const derivedAgIds = Array.from(new Set(sags.map((s) => s.age_group_id)));
      if (derivedAgIds.length > 0) {
        await db.user_age_groups.createMany({
          data: derivedAgIds.map((agId) => ({ user_id: newUser.id, age_group_id: agId })),
          skipDuplicates: true,
        });
      }
    } else if (ageGroupIds.length > 0) {
      await db.user_age_groups.createMany({
        data: ageGroupIds.map((agId) => ({ user_id: newUser.id, age_group_id: agId })),
        skipDuplicates: true,
      });
    }

    if (seasonTeamIds.length > 0) {
      await db.user_season_teams.createMany({
        data: seasonTeamIds.map((stId) => ({ user_id: newUser.id, season_team_id: stId })),
        skipDuplicates: true,
      });
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error: any) {
    console.error("createUser Error:", error);
    return { success: false, error: error.message || "Failed to create user." };
  }
}

/**
 * Update an existing user/staff account
 */
export async function updateUser(id: number, input: UserInput) {
  try {
    const session = await getServerAuthSession();
    const activeClubId = await getActiveClubId();
    const scope = getScopeFilters(session, activeClubId);

    // Retrieve original user details
    const targetUser = await db.user.findUnique({
      where: { id },
    });
    if (!targetUser) {
      return { success: false, error: "User not found." };
    }

    // Security check
    if (scope.isClubAdmin && targetUser.club_id !== scope.clubId) {
      return { success: false, error: "Access Denied: Cannot modify staff outside your club scope." };
    }
    if (scope.isClubAdmin && input.role === "system_admin") {
      return { success: false, error: "Access Denied: Cannot upgrade user to system administrator." };
    }

    // Verify email uniqueness if changed
    if (input.email !== targetUser.email) {
      const existing = await db.user.findUnique({
        where: { email: input.email },
      });
      if (existing) {
        return { success: false, error: "Email is already in use." };
      }
    }

    const dataToUpdate: any = {
      name: input.name,
      email: input.email,
      role: input.role,
      club_id: input.role === "system_admin" ? null : input.club_id || null,
      assigned_age_group_id: null,
      assigned_team_id: null,
    };

    if (input.password) {
      const salt = await bcrypt.genSalt(10);
      dataToUpdate.passwordHash = await bcrypt.hash(input.password, salt);
    }

    // Update user and replace join table rows atomically
    const seasonAgeGroupIds = input.season_age_group_ids || [];
    const ageGroupIds = input.age_group_ids || [];
    const seasonTeamIds = input.season_team_ids || [];

    let derivedAgIds: number[] = ageGroupIds;
    if (seasonAgeGroupIds.length > 0) {
      const sags = await db.season_age_groups.findMany({
        where: { id: { in: seasonAgeGroupIds } },
        select: { age_group_id: true },
      });
      derivedAgIds = Array.from(new Set([...ageGroupIds, ...sags.map((s) => s.age_group_id)]));
    }

    await db.$transaction([
      db.user.update({
        where: { id },
        data: dataToUpdate,
      }),
      // Replace season age group assignments
      db.user_season_age_groups.deleteMany({ where: { user_id: id } }),
      ...(seasonAgeGroupIds.length > 0
        ? [
            db.user_season_age_groups.createMany({
              data: seasonAgeGroupIds.map((sagId) => ({ user_id: id, season_age_group_id: sagId })),
              skipDuplicates: true,
            }),
          ]
        : []),
      // Replace age group assignments
      db.user_age_groups.deleteMany({ where: { user_id: id } }),
      ...(derivedAgIds.length > 0
        ? [
            db.user_age_groups.createMany({
              data: derivedAgIds.map((agId) => ({ user_id: id, age_group_id: agId })),
              skipDuplicates: true,
            }),
          ]
        : []),
      // Replace season team assignments
      db.user_season_teams.deleteMany({ where: { user_id: id } }),
      ...(seasonTeamIds.length > 0
        ? [
            db.user_season_teams.createMany({
              data: seasonTeamIds.map((stId) => ({ user_id: id, season_team_id: stId })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error: any) {
    console.error("updateUser Error:", error);
    return { success: false, error: error.message || "Failed to update user." };
  }
}

/**
 * Delete a user/staff account
 */
export async function deleteUser(id: number) {
  try {
    const session = await getServerAuthSession();
    const activeClubId = await getActiveClubId();
    const scope = getScopeFilters(session, activeClubId);

    const targetUser = await db.user.findUnique({
      where: { id },
    });
    if (!targetUser) {
      return { success: false, error: "User not found." };
    }

    // Security check
    if (scope.isClubAdmin && targetUser.club_id !== scope.clubId) {
      return { success: false, error: "Access Denied: Cannot delete staff outside your club scope." };
    }
    if (targetUser.role === "system_admin" && !scope.isSystemAdmin) {
      return { success: false, error: "Access Denied: Only system administrators can delete other system admins." };
    }

    await db.user.delete({
      where: { id },
    });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error: any) {
    console.error("deleteUser Error:", error);
    return { success: false, error: error.message || "Failed to delete user." };
  }
}
