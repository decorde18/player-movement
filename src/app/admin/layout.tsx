import { Suspense, ReactNode } from "react";

// import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import NavBar from "@/components/layout/NavBar";
import HeaderSkeleton from "@/components/layout/HeaderSkeleton";
import NavBarSkeleton from "@/components/layout/NavBarSkeleton";
import { getServerAuthSession } from "@/lib/auth";
import db from "@/lib/db";
import { getActiveClubId } from "@/lib/actions/clubs";
import { getActiveSeasonId } from "@/lib/actions/season-actions";
import { getActiveAgeGroupId } from "@/lib/actions/active-age-group";

import UserSwitcherBar from "@/components/layout/UserSwitcherBar";

export default async function MainAppLayout({ children }: { children: ReactNode }) {
  const session = await getServerAuthSession();
  const user = session?.user;

  let clubs: any[] = [];
  if (user?.role === "system_admin") {
    clubs = await db.clubs.findMany({
      orderBy: { name: "asc" },
    });
  } else if ((user as any)?.clubId) {
    const userClub = await db.clubs.findUnique({
      where: { id: (user as any).clubId },
    });
    if (userClub) {
      clubs = [userClub];
    }
  }

  const activeClubId = await getActiveClubId();

  // Scope seasons list to what is relevant for this user
  const userRole = (user as any)?.role;
  const userClubId = (user as any)?.clubId;
  const userRoles = (user as any)?.roles || {};
  // Use the roles object (populated in both JWT and impersonation paths)
  const assignedAgeGroupId: number | null = userRoles.ageGroupIds?.[0] ?? null;
  const assignedTeamId: number | null = userRoles.coachTeamIds?.[0] ?? null;


  let seasons: any[] = [];
  if (userRole === "system_admin") {
    // System admin sees all seasons
    seasons = await db.seasons.findMany({ orderBy: { start_date: "desc" } });
  } else if (userRole === "club_admin" && userClubId) {
    // Club admin sees only seasons their club is part of
    seasons = await db.seasons.findMany({
      where: { club_seasons: { some: { club_id: userClubId } } },
      orderBy: { start_date: "desc" },
    });
  } else if (userRole === "age_group_admin" && assignedAgeGroupId) {
    // Coordinator sees seasons where their age group is active
    seasons = await db.seasons.findMany({
      where: {
        season_age_groups: { some: { age_group_id: assignedAgeGroupId } },
        ...(userClubId ? { club_seasons: { some: { club_id: userClubId } } } : {}),
      },
      orderBy: { start_date: "desc" },
    });
  } else if (userRole === "coach" && assignedTeamId) {
    // Coach sees seasons where their assigned team exists
    seasons = await db.seasons.findMany({
      where: {
        season_age_groups: {
          some: { season_teams: { some: { id: assignedTeamId } } },
        },
      },
      orderBy: { start_date: "desc" },
    });
  } else {
    // Fallback: all seasons (safe default for unscoped roles)
    seasons = await db.seasons.findMany({ orderBy: { start_date: "desc" } });
  }

  const activeSeasonId = await getActiveSeasonId();

  // Scope age groups to what is relevant for this user
  let ageGroupsWhere: any = activeSeasonId ? { season_id: activeSeasonId } : {};
  if (userRole === "age_group_admin" && assignedAgeGroupId) {
    ageGroupsWhere = {
      ...ageGroupsWhere,
      age_group_id: assignedAgeGroupId,
    };
  } else if (userRole === "coach" && assignedTeamId) {
    // Coach: show only age groups their team belongs to
    const coachTeam = await db.season_teams.findFirst({
      where: { id: assignedTeamId },
      select: { season_age_group_id: true },
    });
    if (coachTeam?.season_age_group_id) {
      ageGroupsWhere = {
        ...ageGroupsWhere,
        id: coachTeam.season_age_group_id,
      };
    }
  }

  const ageGroups = await db.season_age_groups.findMany({
    where: ageGroupsWhere,
    include: { age_groups: true },
    orderBy: { age_groups: { name: "asc" } },
  });
  const activeAgeGroupId = await getActiveAgeGroupId();

  return (
    <div className='layout'>
      <div className='main-body'>
        <Suspense fallback={<NavBarSkeleton />}>
          <NavBar 
            user={user} 
            clubs={clubs} 
            activeClubId={activeClubId || undefined} 
            seasons={seasons} 
            activeSeasonId={activeSeasonId || undefined} 
            ageGroups={ageGroups}
            activeAgeGroupId={activeAgeGroupId || undefined}
          />
        </Suspense>
        <div className='main-content'>
          <UserSwitcherBar currentUser={user} />
          <Suspense fallback={<HeaderSkeleton />}>
            <Header user={user as any} />
          </Suspense>
          <div className='p-4 md:p-6 w-full max-w-full min-w-0 flex-1 flex flex-col min-h-0 overflow-hidden'>{children}</div>
        </div>
      </div>
      {/* <Footer /> */}
    </div>
  );
}
