import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

const handler = NextAuth(authOptions as any);

async function authHandler(req: any, res: any) {
  const url = new URL(req.url);
  const devBypass =
    process.env.NODE_ENV === "development" &&
    (process.env.AUTH_BYPASS_ENABLED === "true" ||
      process.env.NEXT_PUBLIC_AUTH_BYPASS_ENABLED === "true");

  if (devBypass && url.pathname.endsWith("/api/auth/session")) {
    return NextResponse.json({
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
          managerTeamIds: [],
          playerTeamIds: [],
          parentTeamIds: [],
          clubAdminTeamIds: [],
        },
      },
      expires: new Date(Date.now() + 3600000).toISOString(),
    });
  }
  return handler(req, res);
}

export { authHandler as GET, authHandler as POST };
