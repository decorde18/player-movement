export const Roles = {
  ADMIN: "admin",
  COACH: "coach",
  MANAGER: "manager",
  PLAYER: "player",
  PARENT: "parent",
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export function hasRole(userRoles: any, role: Role) {
  if (!userRoles) return false;
  if (role === Roles.ADMIN) return !!userRoles.isAdmin;

  // Example: userRoles may contain arrays of team ids for roles
  switch (role) {
    case Roles.COACH:
      return (
        Array.isArray(userRoles.coachTeamIds) &&
        userRoles.coachTeamIds.length > 0
      );
    case Roles.MANAGER:
      return (
        Array.isArray(userRoles.managerTeamIds) &&
        userRoles.managerTeamIds.length > 0
      );
    case Roles.PLAYER:
      return (
        Array.isArray(userRoles.playerTeamIds) &&
        userRoles.playerTeamIds.length > 0
      );
    case Roles.PARENT:
      return (
        Array.isArray(userRoles.parentTeamIds) &&
        userRoles.parentTeamIds.length > 0
      );
    default:
      return false;
  }
}
