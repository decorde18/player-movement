"use client";

import { useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import type { Session } from "next-auth";
import { useRouter } from "next/navigation";

export default function useRequireAuth(options?: {
  redirectTo?: string;
  requireRole?: (roles: Session["user"]["roles"]) => boolean;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const redirectTo = options?.redirectTo ?? "/login";

  const bypass =
    process.env.NODE_ENV === "development" &&
    (process.env.AUTH_BYPASS_ENABLED === "true" ||
      process.env.NEXT_PUBLIC_AUTH_BYPASS_ENABLED === "true");

  useEffect(() => {
    if (bypass) return;
    if (status === "loading") return;
    if (!session) {
      // Initiate sign-in flow (client)
      signIn(undefined, { callbackUrl: redirectTo });
      return;
    }

    if (options?.requireRole && !options.requireRole(session.user?.roles)) {
      router.push(redirectTo);
    }
  }, [session, status, router, bypass, options, redirectTo]);

  if (bypass) {
    const devSession: Session = {
      user: {
        id: "1",
        name: "Dev User",
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
      },
      expires: "2099-12-31T23:59:59.999Z",
    };

    return {
      session: devSession,
      status: "authenticated",
    } as const;
  }

  return { session, status } as const;
}
