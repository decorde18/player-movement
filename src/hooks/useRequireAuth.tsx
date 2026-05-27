"use client";

import { useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function useRequireAuth(options?: {
  redirectTo?: string;
  requireRole?: (roles: any) => boolean;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const redirectTo = options?.redirectTo ?? "/login";

  const bypass =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_AUTH_BYPASS_ENABLED === "true";

  useEffect(() => {
    if (bypass) return;
    if (status === "loading") return;
    if (!session) {
      // Initiate sign-in flow (client)
      signIn(undefined, { callbackUrl: redirectTo });
      return;
    }

    if (
      options?.requireRole &&
      !options.requireRole((session as any).user?.roles)
    ) {
      router.push(redirectTo);
    }
  }, [session, status, router, bypass]);

  if (bypass) {
    return {
      session: {
        user: {
          id: "1",
          name: "Dev User",
          email: "admin@example.com",
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
      },
      status: "authenticated",
    } as any;
  }

  return { session, status } as const;
}
