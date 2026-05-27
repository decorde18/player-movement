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

          if (user) {
            const match = await bcrypt.compare(
              credentials.password,
              user.passwordHash,
            );
            if (match) {
              return {
                id: user.id.toString(),
                name: user.name,
                email: user.email,
                roles: user.roles || { isAdmin: false },
              } as any;
            }
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
              roles: {
                isAdmin: true,
                coachTeamIds: [],
                managerTeamIds: [],
                playerTeamIds: [],
                parentTeamIds: [],
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
        token.roles = (user as any).roles ?? token.roles ?? { isAdmin: false };
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id as any;
        (session.user as any).roles = (token as any).roles ?? {
          isAdmin: false,
        };
      }
      return session;
    },
  },
};

export async function getServerAuthSession(): Promise<Session | null> {
  if (
    process.env.NODE_ENV === "development" &&
    process.env.AUTH_BYPASS_ENABLED === "true"
  ) {
    return {
      user: {
        id: process.env.BYPASS_USER_ID || "1",
        name: "Dev User",
        email: process.env.BYPASS_USER_EMAIL || "admin@example.com",
        roles: {
          isAdmin: true,
          coachTeamIds: [],
          managerTeamIds: [],
          playerTeamIds: [],
          parentTeamIds: [],
          clubAdminTeamIds: [],
        },
      },
      expires: new Date(Date.now() + 3600000).toISOString(),
    } as any;
  }
  return await getServerSession(authOptions as any);
}
