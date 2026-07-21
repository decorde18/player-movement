import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
];

export async function middleware(req: NextRequest) {

  // Dev mode bypass
  const devBypass =
    process.env.NODE_ENV === "development" &&
    (process.env.AUTH_BYPASS_ENABLED === "true" ||
      process.env.NEXT_PUBLIC_AUTH_BYPASS_ENABLED === "true");

  if (devBypass) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const authToken = token as unknown as {
    roles?: { isSystemAdmin?: boolean };
  };
 
  if (pathname.startsWith("/admin") && !authToken.roles?.isSystemAdmin) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|login|forgot-password|reset-password).*)"],
};
