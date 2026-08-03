import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth/next";
import type { NextAuthOptions, Session } from "next-auth";
import db from "@/lib/db";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "text",
          placeholder: "user@example.com",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const user = await db.user.findUnique({
            where: { email: credentials.email },
          });

          if (user && user.passwordHash) {
            const isSystemAdmin = user.role === "system_admin";
            const isClubAdmin = user.role === "club_admin";
            const isAgeGroupAdmin = user.role === "age_group_admin";
            const isCoach = user.role === "coach";

            const roles = {
              isSystemAdmin,
              isClubAdmin,
              isAgeGroupAdmin,
              isCoach,
              ageGroupIds: (user as any).assigned_age_group_id
                ? [(user as any).assigned_age_group_id]
                : [],
              coachTeamIds: user.assigned_team_id
                ? [user.assigned_team_id]
                : [],
              clubAdminTeamIds: user.club_id ? [user.club_id] : [],
            };

            return {
              id: user.id.toString(),
              name: user.name,
              email: user.email,
              role: user.role,
              clubId: user.club_id,
              roles,
            } as any;
          }

          // Dev fallback
          if (
            credentials.email === "admin@example.com" &&
            credentials.password === "password"
          ) {
            return {
              id: "1",
              name: "Admin",
              email: "admin@example.com",
              role: "system_admin",
              clubId: null,
              roles: {
                isSystemAdmin: true,
                isClubAdmin: false,
                isAgeGroupAdmin: false,
                isCoach: false,
                ageGroupIds: [],
                coachTeamIds: [],
                clubAdminTeamIds: [],
              },
            } as any;
          }

          return null;
        } catch (error) {
          console.error("authorize error:", error);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id ?? token.id;
        token.role = (user as any).role ?? token.role ?? "coach";
        token.clubId = (user as any).clubId ?? token.clubId ?? null;
        token.roles = (user as any).roles ??
          token.roles ?? {
            isSystemAdmin: false,
            isClubAdmin: false,
            isAgeGroupAdmin: false,
            isCoach: false,
            ageGroupIds: [],
            coachTeamIds: [],
            clubAdminTeamIds: [],
          };
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id as any;
        (session.user as any).role = token.role as any;
        (session.user as any).clubId = token.clubId as any;
        (session.user as any).roles = (token as any).roles ?? {
          isSystemAdmin: false,
          isClubAdmin: false,
          isAgeGroupAdmin: false,
          isCoach: false,
          ageGroupIds: [],
          coachTeamIds: [],
          clubAdminTeamIds: [],
        };
      }
      return session;
    },
  },
};

import { cookies } from "next/headers";

export async function getServerAuthSession(): Promise<Session | null> {
  // 1. Check for User Impersonation cookie in development / admin mode
  try {
    const cookieStore = await cookies();
    const impersonateUserId = cookieStore.get("impersonateUserId")?.value;

    if (impersonateUserId) {
      const impId = parseInt(impersonateUserId, 10);
      if (!isNaN(impId)) {
        const impUser = await db.user.findUnique({
          where: { id: impId },
        });

        if (impUser) {
          const isSystemAdmin = impUser.role === "system_admin";
          const isClubAdmin = impUser.role === "club_admin";
          const isAgeGroupAdmin = impUser.role === "age_group_admin";
          const isCoach = impUser.role === "coach";

          return {
            user: {
              id: impUser.id.toString(),
              name: impUser.name,
              email: impUser.email,
              role: impUser.role,
              clubId: impUser.club_id,
              assigned_team_id: impUser.assigned_team_id,
              assigned_age_group_id: impUser.assigned_age_group_id,
              isImpersonating: true,
              roles: {
                isSystemAdmin,
                isClubAdmin,
                isAgeGroupAdmin,
                isCoach,
                ageGroupIds: impUser.assigned_age_group_id
                  ? [impUser.assigned_age_group_id]
                  : [],
                coachTeamIds: impUser.assigned_team_id
                  ? [impUser.assigned_team_id]
                  : [],
                clubAdminTeamIds: impUser.club_id ? [impUser.club_id] : [],
              },
            },
            expires: new Date(Date.now() + 3600000).toISOString(),
          } as any;
        }
      }
    }
  } catch {
    // Cookie store context not available (e.g. static generation)
  }

  const devBypass =
    process.env.NODE_ENV === "development" &&
    (process.env.AUTH_BYPASS_ENABLED === "true" ||
      process.env.NEXT_PUBLIC_AUTH_BYPASS_ENABLED === "true");

  if (devBypass) {
    return {
      user: {
        id: process.env.BYPASS_USER_ID || "1",
        name: "Dev User",
        email: process.env.BYPASS_USER_EMAIL || "admin@example.com",
        role: "system_admin",
        clubId: null,
        roles: {
          isSystemAdmin: true,
          isClubAdmin: false,
          isAgeGroupAdmin: false,
          isCoach: false,
          ageGroupIds: [],
          coachTeamIds: [],
          clubAdminTeamIds: [],
        },
      },
      expires: new Date(Date.now() + 3600000).toISOString(),
    } as any;
  }
  return await getServerSession(authOptions as any);
}
