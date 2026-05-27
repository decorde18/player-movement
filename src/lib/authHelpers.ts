import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Server-side helper: Ensure a session exists or redirect to `/login`.
 * Use inside server components or server-side page handlers.
 */
export async function requireServerSession(redirectTo = "/login") {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect(redirectTo);
  }
  return session;
}

/**
 * Simple server-side role guard. Redirects to `redirectTo` when user lacks role.
 * `check` is a predicate that receives `session.user.roles`.
 */
export async function requireServerRole(
  check: (roles: any) => boolean,
  redirectTo = "/",
) {
  const session = await requireServerSession(redirectTo);
  if (!check((session as any).user?.roles)) {
    redirect(redirectTo);
  }
  return session;
}
