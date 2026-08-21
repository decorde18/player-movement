import { getServerAuthSession } from "@/lib/auth";
import { getScopeFilters } from "@/lib/permissions";
import db from "@/lib/db";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  Users,
  Calendar,
  Award,
  ClipboardCheck,
  TrendingUp,
  Building2,
  Layers,
  ArrowRight,
  Star,
  Clock,
} from "lucide-react";

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  href,
  accent = false,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  href?: string;
  accent?: boolean;
  sub?: string;
}) {
  const inner = (
    <div
      className={`group flex flex-col gap-3 p-5 rounded-2xl border transition-all duration-200 ${
        accent
          ? "bg-primary/5 border-primary/25 hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5"
          : "bg-surface border-border hover:border-primary/30 hover:shadow-sm hover:-translate-y-0.5"
      } ${href ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            accent ? "bg-primary/15 text-primary" : "bg-background text-muted border border-border"
          }`}
        >
          {icon}
        </div>
        {href && (
          <ArrowRight
            size={15}
            className="text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all"
          />
        )}
      </div>
      <div>
        <div className="text-3xl font-bold text-text">{value}</div>
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mt-0.5">{label}</div>
        {sub && <div className="text-xs text-muted/60 mt-1">{sub}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── Section Header ──────────────────────────────────────────────────────────
function SectionHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted">{title}</h2>
      {href && (
        <Link href={href} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
          {linkLabel || "View all"} <ArrowRight size={11} />
        </Link>
      )}
    </div>
  );
}

// ─── Upcoming Session Row ─────────────────────────────────────────────────────
function SessionRow({ s }: { s: any }) {
  const dateStr = new Date(s.session_date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const isToday =
    new Date(s.session_date).toDateString() === new Date().toDateString();

  return (
    <Link
      href={`/admin/sessions/${s.id}`}
      className="group flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary/30 bg-surface hover:bg-surface-hover/30 transition-all"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
            isToday ? "bg-primary/15 text-primary" : "bg-background text-muted border border-border"
          }`}
        >
          <ClipboardCheck size={14} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm text-text truncate">{s.name}</div>
          <div className="text-xs text-muted flex items-center gap-1.5">
            <Clock size={10} />
            {dateStr}
            {isToday && (
              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[0.6rem] font-bold uppercase border border-primary/20 ml-1">
                Today
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[0.6rem] font-bold uppercase px-1.5 py-0.5 rounded border bg-background border-border text-muted">
          {s.events?.name}
        </span>
        <ArrowRight
          size={14}
          className="text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all"
        />
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function AdminDashboardPage() {
  const session = await getServerAuthSession();
  if (!session) return null;

  const user = session.user as any;
  const userRole = user?.role;
  const scope = getScopeFilters(session);

  const cookieStore = await cookies();
  const activeSeasonId = cookieStore.get("activeSeasonId")?.value
    ? parseInt(cookieStore.get("activeSeasonId")!.value)
    : null;
  const activeAgeGroupId = cookieStore.get("activeAgeGroupId")?.value
    ? parseInt(cookieStore.get("activeAgeGroupId")!.value)
    : null;

  const roleLabels: Record<string, string> = {
    system_admin: "System Administrator",
    club_admin: "Club Administrator",
    age_group_admin: "Age Group Coordinator",
    coach: "Coach",
  };

  // ── Fetch stats based on role ──────────────────────────────────────────────

  // Upcoming / today's sessions
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7Days = new Date(today);
  in7Days.setDate(in7Days.getDate() + 7);

  const upcomingSessions = await db.sessions.findMany({
    where: {
      session_date: { gte: today, lte: in7Days },
      ...(activeAgeGroupId ? { season_age_group_id: activeAgeGroupId } : {}),
      events: {
        ...(activeSeasonId ? { season_id: activeSeasonId } : {}),
        ...scope.filters.event(),
      },
    },
    include: {
      events: { select: { name: true, event_type: true } },
    },
    orderBy: { session_date: "asc" },
    take: 5,
  }) as any[];

  // Role-specific stats
  let stats: { label: string; value: number; icon: React.ReactNode; href?: string; accent?: boolean; sub?: string }[] = [];

  if (userRole === "system_admin") {
    const [clubCount, playerCount, seasonCount, activeEventCount] = await Promise.all([
      db.clubs.count(),
      db.players.count(),
      db.seasons.count(),
      db.events.count({ where: activeSeasonId ? { season_id: activeSeasonId } : {} }),
    ]);
    stats = [
      { label: "Clubs", value: clubCount, icon: <Building2 size={18} />, href: "/admin/clubs" },
      { label: "Total Players", value: playerCount, icon: <Users size={18} />, href: "/admin/players", accent: true },
      { label: "Seasons", value: seasonCount, icon: <Calendar size={18} />, href: "/admin/seasons" },
      { label: "Events This Season", value: activeEventCount, icon: <Award size={18} />, href: "/admin/events" },
    ];
  } else if (userRole === "club_admin") {
    const clubId = user.clubId;
    const [playerCount, teamCount, eventCount] = await Promise.all([
      (db as any).season_players.count({
        where: {
          club_id: clubId,
          ...(activeSeasonId
            ? { season_age_groups: { is: { season_id: activeSeasonId } } }
            : {}),
        },
      }),
      (db as any).season_teams.count({
        where: {
          season_age_groups: {
            ...(activeSeasonId ? { season_id: activeSeasonId } : {}),
          },
          season_players: { some: { club_id: clubId } },
        },
      }),
      db.events.count({ where: activeSeasonId ? { season_id: activeSeasonId } : {} }),
    ]);
    stats = [
      { label: "Players This Season", value: playerCount, icon: <Users size={18} />, href: "/admin/players", accent: true },
      { label: "Active Teams", value: teamCount, icon: <Layers size={18} />, href: "/admin/teams" },
      { label: "Events This Season", value: eventCount, icon: <Award size={18} />, href: "/admin/events" },
    ];
  } else if (userRole === "age_group_admin") {
    const ageGroupIds = user.roles?.ageGroupIds || [];
    const [playerCount, teamCount, eventCount] = await Promise.all([
      db.season_players.count({
        where: {
          ...(ageGroupIds.length > 0 ? { season_age_group_id: { in: ageGroupIds } } : {}),
          ...(activeSeasonId ? { season_age_groups: { season_id: activeSeasonId } } : {}),
        },
      }),
      db.season_teams.count({
        where: {
          ...(ageGroupIds.length > 0 ? { season_age_group_id: { in: ageGroupIds } } : {}),
        },
      }),
      db.events.count({
        where: {
          ...(activeSeasonId ? { season_id: activeSeasonId } : {}),
          ...(ageGroupIds.length > 0
            ? { event_divisions: { some: { season_age_group_id: { in: ageGroupIds } } } }
            : {}),
        },
      }),
    ]);
    stats = [
      { label: "Players in Division", value: playerCount, icon: <Users size={18} />, href: "/admin/players", accent: true },
      { label: "Teams", value: teamCount, icon: <Layers size={18} />, href: "/admin/teams" },
      { label: "Events", value: eventCount, icon: <Award size={18} />, href: "/admin/events" },
      { label: "Sessions This Week", value: upcomingSessions.length, icon: <ClipboardCheck size={18} />, href: "/admin/sessions" },
    ];
  } else {
    // Coach
    const teamIds = user.roles?.coachTeamIds || [];
    const [rosterCount, ratingCount] = await Promise.all([
      db.season_players.count({
        where: teamIds.length > 0 ? { season_team_id: { in: teamIds } } : { id: -1 },
      }),
      // Count session_players rows this coach is associated with as a proxy for ratings entered
      db.session_players.count({
        where: {
          sessions: {
            events: scope.filters.event(),
          },
        },
      }),
    ]);
    stats = [
      { label: "My Team Roster", value: rosterCount, icon: <Users size={18} />, href: "/admin/players", accent: true },
      { label: "Ratings I've Entered", value: ratingCount, icon: <Star size={18} /> },
      { label: "Sessions This Week", value: upcomingSessions.length, icon: <ClipboardCheck size={18} />, href: "/admin/sessions" },
    ];
  }

  const userName = user?.name?.split(" ")[0] || "there";

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Welcome Header */}
      <div className="bg-surface border border-border rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text">
            Welcome back, {userName} 👋
          </h1>
          <p className="text-sm text-muted mt-0.5 flex items-center gap-1.5">
            <span className="inline-block px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[0.65rem] font-bold uppercase border border-primary/20">
              {roleLabels[userRole] || userRole}
            </span>
            <span>·</span>
            <span>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </p>
        </div>
        <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center text-primary text-xl font-bold flex-shrink-0">
          {user?.name
            ?.split(" ")
            .map((n: string) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() || "U"}
        </div>
      </div>

      {/* Stats Grid */}
      <section>
        <SectionHeader title="Overview" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s, i) => (
            <StatCard
              key={i}
              label={s.label}
              value={s.value}
              icon={s.icon}
              href={s.href}
              accent={s.accent}
              sub={s.sub}
            />
          ))}
        </div>
      </section>

      {/* Upcoming Sessions */}
      <section>
        <SectionHeader
          title="Sessions — Next 7 Days"
          href="/admin/sessions"
          linkLabel="All sessions"
        />
        <div className="space-y-2">
          {upcomingSessions.length === 0 ? (
            <div className="text-center py-10 bg-surface border border-border rounded-2xl text-muted text-sm">
              No sessions scheduled in the next 7 days.
            </div>
          ) : (
            upcomingSessions.map((s) => <SessionRow key={s.id} s={s} />)
          )}
        </div>
      </section>

      {/* Quick Links */}
      <section>
        <SectionHeader title="Quick Links" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { label: "Player Registry", href: "/admin/players", icon: <Users size={16} /> },
            { label: "Events & Sessions", href: "/admin/events", icon: <Award size={16} /> },
            { label: "Session Roster", href: "/admin/sessions", icon: <ClipboardCheck size={16} /> },
            { label: "Player Board", href: "/player-board", icon: <TrendingUp size={16} /> },
            ...(userRole !== "coach"
              ? [{ label: "Invitations", href: "/admin/invitations", icon: <Star size={16} /> }]
              : []),
            ...(userRole === "system_admin" || userRole === "club_admin"
              ? [{ label: "Staff Registry", href: "/admin/users", icon: <Building2 size={16} /> }]
              : []),
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border bg-surface hover:border-primary/30 hover:bg-surface-hover/30 transition-all text-sm font-semibold text-text"
            >
              <span className="text-muted group-hover:text-primary transition-colors">{link.icon}</span>
              {link.label}
              <ArrowRight size={13} className="ml-auto text-muted/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}