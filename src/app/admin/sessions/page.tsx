import { getServerAuthSession } from "@/lib/auth";
import { getScopeFilters } from "@/lib/permissions";
import db from "@/lib/db";
import { cookies } from "next/headers";
import Link from "next/link";
import { ClipboardCheck, Calendar, Clock, Users, ArrowRight, AlertCircle } from "lucide-react";

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDateLabel(date: Date | string) {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  d.setHours(0, 0, 0, 0);
  if (d.getTime() === today.getTime()) return "today";
  if (d.getTime() === tomorrow.getTime()) return "tomorrow";
  if (d.getTime() === yesterday.getTime()) return "yesterday";
  return null;
}

export default async function SessionsIndexPage() {
  const session = await getServerAuthSession();
  if (!session) return null;

  const scope = getScopeFilters(session);

  const cookieStore = await cookies();
  const activeSeasonId = cookieStore.get("activeSeasonId")?.value
    ? parseInt(cookieStore.get("activeSeasonId")!.value)
    : null;
  const activeAgeGroupId = cookieStore.get("activeAgeGroupId")?.value
    ? parseInt(cookieStore.get("activeAgeGroupId")!.value)
    : null;

  // Fetch recent + upcoming sessions scoped to the user
  const sessions = await (db.sessions.findMany({
    where: {
      ...(activeAgeGroupId ? { season_age_group_id: activeAgeGroupId } : {}),
      events: {
        ...(activeSeasonId ? { season_id: activeSeasonId } : {}),
        ...scope.filters.event(),
      },
    },
    include: {
      events: {
        select: { id: true, name: true, event_type: true },
      },
      _count: {
        select: { session_players: true },
      },
    },
    orderBy: { session_date: "desc" },
    take: 50,
  }) as any);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaySessions = sessions.filter((s: any) => {
    const d = new Date(s.session_date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  const upcomingSessions = sessions.filter((s: any) => {
    const d = new Date(s.session_date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() > today.getTime();
  });

  const pastSessions = sessions.filter((s: any) => {
    const d = new Date(s.session_date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  });

  const SessionCard = ({ s }: { s: any }) => {
    const dateLabel = getDateLabel(s.session_date);
    const isToday = dateLabel === "today";

    return (
      <Link
        href={`/admin/sessions/${s.id}`}
        className={`group flex items-center justify-between gap-4 px-5 py-4 rounded-xl border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
          isToday
            ? "bg-primary/5 border-primary/30 hover:border-primary/60"
            : "bg-surface border-border hover:border-primary/30 hover:bg-surface-hover/30"
        }`}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
              isToday ? "bg-primary/15 text-primary" : "bg-background text-muted border border-border"
            }`}
          >
            <ClipboardCheck size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-text truncate">{s.name}</span>
              {dateLabel && (
                <span
                  className={`text-[0.6rem] font-bold uppercase px-1.5 py-0.5 rounded border ${
                    isToday
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                  }`}
                >
                  {dateLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {formatDate(s.session_date)}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {s.events?.name}
              </span>
              {s.season_age_groups && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-background border border-border font-semibold text-[0.6rem]">
                  {s.season_age_groups.age_groups?.name} · {s.season_age_groups.gender}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <div className="flex items-center gap-1 text-xs text-muted justify-end">
              <Users size={11} />
              <span className="font-semibold">{s._count.session_players}</span>
              <span>players</span>
            </div>
            <span
              className={`text-[0.6rem] font-bold uppercase px-1.5 py-0.5 rounded border mt-1 inline-block ${
                s.events?.event_type === "tryout"
                  ? "bg-accent/10 text-accent border-accent/20"
                  : "bg-primary/10 text-primary border-primary/20"
              }`}
            >
              {s.events?.event_type}
            </span>
          </div>
          <ArrowRight
            size={16}
            className="text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all"
          />
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2.5">
            <ClipboardCheck size={24} className="text-primary" />
            Session Roster
          </h1>
          <p className="text-sm text-muted mt-1">
            Select a session to take attendance and manage your roster.
          </p>
        </div>
      </div>

      {sessions.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center bg-surface border border-border rounded-2xl">
          <AlertCircle size={36} className="text-muted/40" />
          <p className="font-bold text-muted">No sessions found for the active season/division.</p>
          <p className="text-xs text-muted/60">Sessions are created from the Events &amp; Sessions page.</p>
          <Link
            href="/admin/events"
            className="mt-2 text-xs font-bold text-primary hover:underline"
          >
            Go to Events &amp; Sessions →
          </Link>
        </div>
      )}

      {/* Today */}
      {todaySessions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
            Today
          </h2>
          <div className="space-y-2">
            {todaySessions.map((s: any) => (
              <SessionCard key={s.id} s={s} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcomingSessions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-2">
            <Calendar size={12} />
            Upcoming
          </h2>
          <div className="space-y-2">
            {upcomingSessions.map((s: any) => (
              <SessionCard key={s.id} s={s} />
            ))}
          </div>
        </section>
      )}

      {/* Past */}
      {pastSessions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted/60 flex items-center gap-2">
            <Clock size={12} />
            Past Sessions
          </h2>
          <div className="space-y-2">
            {pastSessions.map((s: any) => (
              <SessionCard key={s.id} s={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
