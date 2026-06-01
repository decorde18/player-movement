import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: "system_admin" | "club_admin" | "age_group_admin" | "coach";
      clubId: number | null;
      roles: {
        isSystemAdmin: boolean;
        isClubAdmin: boolean;
        isAgeGroupAdmin: boolean;
        isCoach: boolean;
        ageGroupIds: number[];
        coachTeamIds: number[];
        clubAdminTeamIds: number[];
      };
    };
  }

  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: "system_admin" | "club_admin" | "age_group_admin" | "coach";
    clubId?: number | null;
    roles?: {
      isSystemAdmin: boolean;
      isClubAdmin: boolean;
      isAgeGroupAdmin: boolean;
      isCoach: boolean;
      ageGroupIds: number[];
      coachTeamIds: number[];
      clubAdminTeamIds: number[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role?: "system_admin" | "club_admin" | "age_group_admin" | "coach";
    clubId?: number | null;
    roles?: {
      isSystemAdmin: boolean;
      isClubAdmin: boolean;
      isAgeGroupAdmin: boolean;
      isCoach: boolean;
      ageGroupIds: number[];
      coachTeamIds: number[];
      clubAdminTeamIds: number[];
    };
  }
}
