import prisma from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export interface UserRoles {
  isSystemAdmin: boolean;
  isClubAdmin: boolean;
  isAgeGroupAdmin?: boolean;
  isCoach: boolean;
  ageGroupIds: number[];
  coachTeamIds: number[];
  clubAdminTeamIds: number[];
}

interface PersonRow {
  system_admin: number;
}

interface VUserRow {
  system_admin: number;
  roles_json?: string;
  has_team_access: number;
}

interface TeamIdRow {
  team_id: number;
}

interface AppSessionUser {
  personId?: number;
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  clubId?: number | null;
  roles?: Partial<UserRoles>;
}

function parseRolesJson(rolesJson?: string): string[] {
  if (!rolesJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(rolesJson);
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item).toLowerCase())
      : [];
  } catch {
    return [];
  }
}

async function getUserRolesFromView(
  id: number,
): Promise<Partial<UserRoles> | null> {
  try {
    const rows = await prisma.$queryRaw<VUserRow[]>`
       SELECT
         system_admin,
         roles_json,
         has_team_access
       FROM v_users
       WHERE person_id = ${id}
       LIMIT 1
    `;

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const viewRoles = parseRolesJson(row.roles_json);
    return {
      isSystemAdmin: Boolean(row.system_admin),
      isClubAdmin: viewRoles.includes("club_admin"),
      isCoach: viewRoles.includes("coach"),
    };
  } catch (error) {
    console.error("Error reading v_users roles:", error);
    return null;
  }
}

export async function getUserRolesAndTeams(
  personId: number | string,
): Promise<UserRoles> {
  const roles: UserRoles = {
    isSystemAdmin: false,
    isClubAdmin: false,

    isAgeGroupAdmin: false,
    isCoach: false,

    ageGroupIds: [],
    coachTeamIds: [],

    clubAdminTeamIds: [],
  };

  try {
    const id = Number(personId);

    const viewRoleFlags = await getUserRolesFromView(id);
    if (viewRoleFlags) {
      roles.isSystemAdmin = viewRoleFlags.isSystemAdmin ?? false;
      roles.isClubAdmin = viewRoleFlags.isClubAdmin ?? false;

      roles.isCoach = viewRoleFlags.isCoach ?? false;
    } else {
      const peopleRows = await prisma.$queryRaw<PersonRow[]>`
         SELECT u.system_admin AS system_admin
         FROM users u
         JOIN people p ON u.person_id = p.id
         WHERE p.id = ${id}
         LIMIT 1
      `;
      if (peopleRows.length > 0 && peopleRows[0].system_admin) {
        roles.isSystemAdmin = true;
      }
    }

    const coachRows = await prisma.$queryRaw<TeamIdRow[]>`
       SELECT DISTINCT team_id FROM coaches WHERE person_id = ${id} AND is_active = 1
       UNION
       SELECT DISTINCT ts.team_id FROM team_staff staff
       JOIN team_seasons ts ON staff.team_season_id = ts.id
       WHERE staff.person_id = ${id} AND staff.role IN ('head_coach', 'assistant_coach') AND staff.is_active = 1
    `;
    roles.coachTeamIds = coachRows.map((r) => r.team_id);

    const clubAdminRows = await prisma.$queryRaw<TeamIdRow[]>`
       SELECT DISTINCT t.id AS team_id
       FROM club_staff cs
       JOIN teams t ON cs.club_id = t.club_id
       WHERE cs.person_id = ${id} AND cs.role = 'club_admin' AND cs.is_active = 1
    `;
    roles.clubAdminTeamIds = clubAdminRows.map((r) => r.team_id);

    roles.isCoach = roles.isCoach || roles.coachTeamIds.length > 0;

    roles.isClubAdmin = roles.isClubAdmin || roles.clubAdminTeamIds.length > 0;
  } catch (error) {
    console.error("Error fetching user roles:", error);
  }

  return roles;
}

export async function requireSession() {
  const session = await getServerAuthSession();
  if (!session || !session.user) {
    redirect("/login");
  }
  return session;
}

export async function verifyAdmin() {
  const session = await getServerAuthSession();
  if (!session?.user?.roles?.isSystemAdmin) {
    throw new Error("Unauthorized: Admin access required.");
  }
}

export async function verifyTeamAccess(teamId: number | string) {
  const session = await getServerAuthSession();
  if (!session || !session.user) {
    throw new Error("Unauthorized: Not logged in.");
  }

  const user = session.user as AppSessionUser;
  if (user.roles?.isSystemAdmin) return true;

  const targetPersonId = user.personId ?? Number(user.id);
  const roles = await getUserRolesAndTeams(targetPersonId);
  const tId = Number(teamId);
  const hasAccess =
    roles.coachTeamIds.includes(tId) || roles.clubAdminTeamIds.includes(tId);

  if (!hasAccess) {
    throw new Error("Forbidden: You do not have access to this team.");
  }

  return true;
}
