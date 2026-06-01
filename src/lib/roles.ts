export const Roles = {
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
  CLUB_ADMIN: "CLUB_ADMIN",
  AGE_GROUP_ADMIN: "AGE_GROUP_ADMIN",
  TEAM_ADMIN: "TEAM_ADMIN",
  COACH: "COACH",
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export function hasRole(userRoles: any, role: Role) {
  if (!userRoles) return false;
  if (role === Roles.SYSTEM_ADMIN) return !!userRoles.isSystemAdmin;
  if (role === Roles.CLUB_ADMIN) return !!userRoles.isClubAdmin;
  if (role === Roles.AGE_GROUP_ADMIN) return !!userRoles.isAgeGroupAdmin;

  switch (role) {
    case Roles.COACH:
      return (
        Array.isArray(userRoles.coachTeamIds) &&
        userRoles.coachTeamIds.length > 0
      );
    default:
      return false;
  }
}

export function getEffectiveRoles(userRoles: any): Role[] {
  const effectiveRoles: Role[] = [];

  if (hasRole(userRoles, Roles.SYSTEM_ADMIN)) {
    effectiveRoles.push(Roles.SYSTEM_ADMIN);
  }
  if (hasRole(userRoles, Roles.CLUB_ADMIN)) {
    effectiveRoles.push(Roles.CLUB_ADMIN);
  }
  if (hasRole(userRoles, Roles.AGE_GROUP_ADMIN)) {
    effectiveRoles.push(Roles.AGE_GROUP_ADMIN);
  }
  if (hasRole(userRoles, Roles.TEAM_ADMIN)) {
    effectiveRoles.push(Roles.TEAM_ADMIN);
  }
  if (hasRole(userRoles, Roles.COACH)) {
    effectiveRoles.push(Roles.COACH);
  }

  return [...new Set(effectiveRoles)];
}
