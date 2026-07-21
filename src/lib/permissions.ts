import { Session } from "next-auth";

export interface UserRolesJson {
  isSystemAdmin?: boolean;
  isClubAdmin?: boolean;
  isAgeGroupAdmin?: boolean;
  isCoach?: boolean;
  ageGroupIds?: number[];
  coachTeamIds?: number[];
  clubAdminTeamIds?: number[];
}

export interface AuthenticatedUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: "system_admin" | "club_admin" | "age_group_admin" | "coach";
  clubId: number | null;
  roles?: UserRolesJson;
}

/**
 * Build dynamic Prisma scope filters based on the user's role and tenant parameters.
 */
export function getScopeFilters(
  session: Session | null,
  clubIdOverride?: number | null,
) {
  if (!session || !session.user) {
    throw new Error("Unauthorized: Active session required.");
  }

  const user = session.user as unknown as AuthenticatedUser;
  const role = user.role;
  const clubId = clubIdOverride !== undefined && clubIdOverride !== null ? clubIdOverride : user.clubId;
  const customRoles = user.roles || {};

  // 1. System Admin - Full, unrestricted scope (unless clubIdOverride is provided)
  if (role === "system_admin") {
    if (clubIdOverride) {
      return {
        role,
        isSystemAdmin: true,
        isClubAdmin: false,
        isAgeGroupAdmin: false,
        isCoach: false,
        clubId: clubIdOverride,
        filters: {
          player: () => ({
            season_players: {
              some: {
                club_id: clubIdOverride,
              },
            },
          }),
          club: () => ({ id: clubIdOverride }),
          season: () => ({
            club_seasons: {
              some: {
                club_id: clubIdOverride,
              },
            },
          }),
          event: () => ({
            seasons: {
              club_seasons: {
                some: {
                  club_id: clubIdOverride,
                },
              },
            },
          }),
          session: () => ({
            events: {
              seasons: {
                club_seasons: {
                  some: {
                    club_id: clubIdOverride,
                  },
                },
              },
            },
          }),
          team: () => ({ club_id: clubIdOverride }),
        },
      };
    }

    return {
      role,
      isSystemAdmin: true,
      isClubAdmin: false,
      isAgeGroupAdmin: false,
      isCoach: false,
      clubId: null,
      filters: {
        player: () => ({}),
        club: () => ({}),
        season: () => ({}),
        event: () => ({}),
        session: () => ({}),
        team: () => ({}),
      },
    };
  }

  // 2. Club Admin - Scoped to their specific club
  if (role === "club_admin") {
    if (!clubId) {
      throw new Error(
        "Access Denied: Club Administrator is missing a valid club_id.",
      );
    }
    return {
      role,
      isSystemAdmin: false,
      isClubAdmin: true,
      isAgeGroupAdmin: false,
      isCoach: false,
      clubId,
      filters: {
        player: () => ({
          season_players: {
            some: {
              club_id: clubId,
            },
          },
        }),
        club: () => ({ id: clubId }),
        season: () => ({
          club_seasons: {
            some: {
              club_id: clubId,
            },
          },
        }),
        event: () => ({
          seasons: {
            club_seasons: {
              some: {
                club_id: clubId,
              },
            },
          },
        }),
        session: () => ({
          events: {
            seasons: {
              club_seasons: {
                some: {
                  club_id: clubId,
                },
              },
            },
          },
        }),
        team: () => ({ club_id: clubId }),
      },
    };
  }

  // 3. Age Group Admin / Coordinator (Check explicit role or custom JSON roles)
  const isAgeGroupAdmin =
    role === "age_group_admin" ||
    !!customRoles.isAgeGroupAdmin ||
    (Array.isArray(customRoles.ageGroupIds) &&
      customRoles.ageGroupIds.length > 0);
  if (isAgeGroupAdmin) {
    const allowedAgeGroupIds = customRoles.ageGroupIds || [];
    return {
      role: "age_group_admin",
      isSystemAdmin: false,
      isClubAdmin: false,
      isAgeGroupAdmin: true,
      isCoach: false,
      clubId,
      allowedAgeGroupIds,
      filters: {
        player: () => {
          const filter: any = {};
          if (allowedAgeGroupIds.length > 0) {
            filter.season_players = {
              some: {
                ...(clubId ? { club_id: clubId } : {}),
                season_age_group_id: { in: allowedAgeGroupIds },
              },
            };
          } else if (clubId) {
            filter.season_players = {
              some: {
                club_id: clubId,
              },
            };
          }
          return filter;
        },
        club: () => (clubId ? { id: clubId } : {}),
        season: () => {
          const filter: any = {};
          if (clubId) {
            filter.club_seasons = { some: { club_id: clubId } };
          }
          if (allowedAgeGroupIds.length > 0) {
            filter.season_age_groups = {
              some: { id: { in: allowedAgeGroupIds } },
            };
          }
          return filter;
        },
        event: () => {
          const filter: any = {};
          if (allowedAgeGroupIds.length > 0) {
            filter.event_divisions = {
              some: {
                season_age_group_id: { in: allowedAgeGroupIds },
              },
            };
          } else if (clubId) {
            filter.seasons = {
              club_seasons: { some: { club_id: clubId } },
            };
          }
          return filter;
        },
        session: () => {
          const filter: any = {};
          if (allowedAgeGroupIds.length > 0) {
            filter.events = {
              event_divisions: {
                some: {
                  season_age_group_id: { in: allowedAgeGroupIds },
                },
              },
            };
          } else if (clubId) {
            filter.events = {
              seasons: {
                club_seasons: { some: { club_id: clubId } },
              },
            };
          }
          return filter;
        },
        team: () => {
          const filter: any = {};
          if (clubId) filter.club_id = clubId;
          if (allowedAgeGroupIds.length > 0) {
            filter.season_age_group_id = { in: allowedAgeGroupIds };
          }
          return filter;
        },
      },
    };
  }

  // 4. Coach - Scoped specifically to teams they work with
  const allowedTeamIds = customRoles.coachTeamIds || [];
  return {
    role: "coach",
    isSystemAdmin: false,
    isClubAdmin: false,
    isAgeGroupAdmin: false,
    isCoach: true,
    clubId,
    allowedTeamIds,
    filters: {
      player: () => {
        const filter: any = {};
        if (allowedTeamIds.length > 0) {
          filter.season_players = {
            some: {
              ...(clubId ? { club_id: clubId } : {}),
              season_team_id: { in: allowedTeamIds },
            },
          };
        } else if (clubId) {
          filter.season_players = {
            some: {
              club_id: clubId,
            },
          };
        } else {
          // If no coach teams are assigned, return an impossible filter so they see nothing by default
          return { id: -1 };
        }
        return filter;
      },
      club: () => (clubId ? { id: clubId } : { id: -1 }),
      season: () => {
        const filter: any = {};
        if (clubId) filter.club_seasons = { some: { club_id: clubId } };
        if (allowedTeamIds.length > 0) {
          filter.season_age_groups = {
            some: {
              season_teams: {
                some: {
                  id: { in: allowedTeamIds },
                },
              },
            },
          };
        } else {
          return { id: -1 };
        }
        return filter;
      },
      event: () => {
        if (allowedTeamIds.length > 0) {
          return {
            event_divisions: {
              some: {
                season_age_groups: {
                  season_teams: {
                    some: {
                      id: { in: allowedTeamIds },
                    },
                  },
                },
              },
            },
          };
        }
        return { id: -1 };
      },
      session: () => {
        if (allowedTeamIds.length > 0) {
          return {
            events: {
              event_divisions: {
                some: {
                  season_age_groups: {
                    season_teams: {
                      some: {
                        id: { in: allowedTeamIds },
                      },
                    },
                  },
                },
              },
            },
          };
        }
        return { id: -1 };
      },
      team: () => {
        if (allowedTeamIds.length > 0) {
          return { id: { in: allowedTeamIds } };
        }
        return { id: -1 };
      },
    },
  };
}
