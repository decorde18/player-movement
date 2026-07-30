import { Suspense, ReactNode } from "react";

import Header from "@/components/layout/Header";
import NavBar from "@/components/layout/NavBar";
import HeaderSkeleton from "@/components/layout/HeaderSkeleton";
import NavBarSkeleton from "@/components/layout/NavBarSkeleton";
import { getServerAuthSession } from "@/lib/auth";
import db from "@/lib/db";
import { getActiveClubId } from "@/lib/actions/clubs";
import { getActiveSeasonId } from "@/lib/actions/season-actions";
import { getActiveAgeGroupId } from "@/lib/actions/active-age-group";

export default async function MainAppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
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
  const seasons = await db.seasons.findMany({
    orderBy: { start_date: "desc" },
  });
  const activeSeasonId = await getActiveSeasonId();
  
  // Get configured age groups for active season
  const ageGroups = await db.season_age_groups.findMany({
    where: activeSeasonId ? { season_id: activeSeasonId } : {},
    include: {
      age_groups: true,
    },
    orderBy: {
      age_groups: {
        name: "asc",
      },
    },
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
          <Suspense fallback={<HeaderSkeleton />}>
            <Header user={user as any} />
          </Suspense>
          <div className='p-6 w-full max-w-[1600px] mx-auto min-h-0 flex flex-col'>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
