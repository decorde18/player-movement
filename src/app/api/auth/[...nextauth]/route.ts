import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

const handler = NextAuth(authOptions as any);

async function authHandler(req: any, res: any) {
  const url = new URL(req.url);
  if (
    process.env.NODE_ENV === "development" &&
    process.env.AUTH_BYPASS_ENABLED === "true" &&
    url.pathname.endsWith("/api/auth/session")
  ) {
    return NextResponse.json({
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
    });
  }
  return handler(req, res);
}

export { authHandler as GET, authHandler as POST };
