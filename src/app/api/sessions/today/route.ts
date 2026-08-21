import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { getScopeFilters } from "@/lib/permissions";
import db from "@/lib/db";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const session = await getServerAuthSession();
    if (!session) {
      return NextResponse.json({ sessions: [] });
    }

    const scope = getScopeFilters(session);

    const cookieStore = await cookies();
    const activeSeasonId = cookieStore.get("activeSeasonId")?.value
      ? parseInt(cookieStore.get("activeSeasonId")!.value)
      : null;
    const activeAgeGroupId = cookieStore.get("activeAgeGroupId")?.value
      ? parseInt(cookieStore.get("activeAgeGroupId")!.value)
      : null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaySessions = await (db.sessions.findMany({
      where: {
        session_date: {
          gte: today,
          lt: tomorrow,
        },
        ...(activeAgeGroupId ? { season_age_group_id: activeAgeGroupId } : {}),
        events: {
          ...(activeSeasonId ? { season_id: activeSeasonId } : {}),
          ...scope.filters.event(),
        },
      },
      include: {
        events: {
          select: { name: true, season_id: true },
        },
      },
      orderBy: { session_date: "asc" },
      take: 5,
    }) as any);

    return NextResponse.json({ sessions: todaySessions });
  } catch (error) {
    console.error("Error fetching today's sessions:", error);
    return NextResponse.json({ sessions: [] });
  }
}
