"use client";
import { Menu, X, ChevronDown, ChevronRight, Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

// import { useNavigationStore } from "@/stores/navigationStore";
// import {
//   buildCompleteNavigation,
//   getRoleBadgeInfo,
// } from "@/lib/navigationUtils";
import LogoutButton from "../ui/LogoutButton";
import Select from "../ui/Select";

const DEV_USERS = [
  {
    value: "admin",
    label: "Admin User",
    user: {
      name: "Admin User",
      roles: { isAdmin: true },
      first_name: "Admin",
      last_name: "User",
    },
  },
  {
    value: "coach",
    label: "Coach User",
    user: {
      name: "Coach User",
      roles: { isAdmin: false },
      first_name: "Coach",
      last_name: "User",
    },
  },
  {
    value: "player",
    label: "Player User",
    user: {
      name: "Player User",
      roles: { isAdmin: false },
      first_name: "Player",
      last_name: "User",
    },
  },
];

function NavBar({ user }: { user?: NavBarUser }) {
  const { data: session } = useSession();
  // user = 
  // name: 'David Cordero de Jesus',
  // email: 'decorde@yahoo.com',
  // id: '17',
  // personId: 17,
  // roles: {
  //   isAdmin: true,
  //   clubAdmin: false,
  //   teamAdmin: false,
  //   coach: false,
  //   player: false,
  //   parent: false,
  //   coachTeamIds: [],
  //   teamAdminTeamIds: [],
  //   playerTeamIds: [],
  //   parentTeamIds: [],
  //   clubAdminTeamIds: []
  // }

  // const { myTeams, myClubs, activeClubId, setActiveClubId } =
  //   useNavigationStore();
  const [myTeams, myClubs, activeClubId, setActiveClubId] = [[1, 2], [1], 1, () => console.log("set")]
  const pathname = usePathname();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Record<number, boolean>>(
    {},
  );
  const [devUserMode, setDevUserMode] = useState<string>("");

  const devUserOverride = DEV_USERS.find(u => u.value === devUserMode)?.user;
  // const user = devUserOverride ?? session?.user;

  // Initialize active club when data loads
  useEffect(() => {
    if (!activeClubId && myClubs && myClubs.length > 0) {
      const first = myClubs[0];
      const initialClubId: number | null =
        typeof first.club_id === "number" ? first.club_id : null;
      setActiveClubId(initialClubId);
    }
  }, [myClubs, activeClubId, setActiveClubId]);

  // Auto-open on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto-close sidebar when route changes (mobile only)
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [pathname]);

  // Auto-expand the club/team that contains the current route
  useEffect(() => {
    const teamMatch = pathname?.match(/\/teams\/(\d+)/);
    if (teamMatch && myTeams.length > 0) {
      const teamSeasonId = parseInt(teamMatch[1]);
      const team = myTeams.find((t) => t.team_season_id === teamSeasonId);

      if (team) {
        const clubIdToSet: number | null =
          typeof team.club_id === "number" ? team.club_id : null;
        setActiveClubId(clubIdToSet);
        setExpandedTeams((prev) => ({ ...prev, [teamSeasonId]: true }));
      }
    }
  }, [pathname, myTeams]);

  const handleClubChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveClubId(Number(e.target.value));
  };

  const toggleTeam = (teamSeasonId: number) => {
    setExpandedTeams((prev) => ({
      ...prev,
      [teamSeasonId]: !prev[teamSeasonId],
    }));
  };

  // const sections = buildCompleteNavigation(
  //   user,
  //   myTeams,
  //   myClubs,
  //   activeClubId,
  // ) as any[];
  const sections = []
  const NavButton = ({ item, indent = 0 }: { item: any; indent?: number }) => {
    const isActive = pathname === item.path;

    return (
      <Link
        href={item.path}
        className={`w-full flex items-center gap-3 py-2.5 text-sm cursor-pointer transition-all duration-200 rounded-lg ${isActive
          ? "bg-primary/10 text-primary font-semibold shadow-sm"
          : "bg-transparent text-text hover:bg-surface-hover hover:translate-x-1"
          }`}
        style={{ paddingLeft: `${16 + indent * 12}px` }}
      >
        <div className='flex items-center gap-3 w-full'>
          {item.icon && <span className='text-base'>{item.icon}</span>}
          <span className='font-medium flex-1 text-left'>{item.label}</span>
          {item.badge && (
            <span className='text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary'>
              {item.badge}
            </span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <>
      {/* Hamburger Button - Hidden on desktop */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className='lg:hidden fixed top-3 left-4 z-[1200] bg-surface p-1.5 rounded-md shadow-sm border border-border text-text cursor-pointer transition-transform hover:scale-105'
          aria-label='Open menu'
        >
          <Menu size={24} />
        </button>
      )}

      {/* Backdrop - Hidden on desktop */}
      <div
        className={`lg:hidden fixed inset-0 bg-black/50 z-[1000] transition-opacity duration-300 ${sidebarOpen
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
          }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-surface text-text border-r border-border z-[1100] transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:shadow-none ${sidebarOpen
          ? "translate-x-0 shadow-[4px_0_20px_rgba(0,0,0,0.1)]"
          : "-translate-x-full"
          }`}
      >
        <div className='flex flex-col h-full'>
          {/* Header */}
          <div className='flex-shrink-0 p-6 border-b border-border flex items-center justify-between'>
            <h1 className='text-2xl font-bold mb-1 text-primary'>
              Soccer Stats
            </h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className='lg:hidden p-1 rounded-md text-muted hover:bg-surface-hover'
              aria-label='Close menu'
            >
              <X size={24} />
            </button>
          </div>

          {/* Dev User Select */}
          {process.env.NODE_ENV === "development" && (
            <div className='p-4 border-b border-border'>
              <Select
                label='View As (Dev)'
                options={[{ value: "", label: "Real User" }, ...DEV_USERS]}
                value={devUserMode}
                onChange={(e: any) => setDevUserMode(e.target.value)}
                width="full"
                showPlaceholder={false}
              />
            </div>
          )}

          {/* Club Selector */}
          {myClubs.length > 0 && (
            <div className='p-4 border-b border-border'>
              <Select
                label='Current Club'
                value={activeClubId || ""}
                onChange={handleClubChange}
                options={myClubs.map((club: any) => ({ value: club.club_id, label: club.club_name }))}
                width="full"
                showPlaceholder={false}
              />
            </div>
          )}

          {/* Team Selector */}
          {myTeams.length > 0 && (
            <div className='p-4 border-b border-border'>
              <Select
                label='Current Team'
                options={[{ value: "", label: "Select Team..." }, ...myTeams.map((team: any) => ({ value: team.team_season_id, label: team.team_name }))]}
                onChange={(e: any) => {
                  if (e.target.value) router.push(`/teams/${e.target.value}`);
                }}
                width="full"
                showPlaceholder={false}
              />
            </div>
          )}

          {/* Navigation */}
          <nav className='flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar'>
            {sections.map((section) => (
              <div key={section.id}>
                {/* Section Header */}
                <div className='text-xs font-semibold text-muted uppercase tracking-wider mb-3 px-4'>
                  {section.label}
                </div>

                {/* Simple list items */}
                {section.items && (
                  <div className='space-y-1'>
                    {section.items.map((item: any) => (
                      <NavButton key={item.id} item={item} />
                    ))}
                  </div>
                )}

                {/* Hierarchical structure (clubs > teams > routes) */}
                {section.type === "hierarchical" && section.clubs && (
                  <div className='space-y-1'>
                    {section.clubs.map((club: any) => (
                      <div key={club.club_id}>
                        {/* Club Header (Removed - Managed by Select) */}

                        {/* Teams under this club */}
                        <div className='space-y-1 mt-1'>
                          {club.teams.map((team: any) => {
                            const badge = getRoleBadgeInfo(team.role);

                            return (
                              <div key={team.team_season_id}>
                                {/* Team Header */}
                                <div className='w-full flex items-center gap-2 px-2 py-2'>
                                  <button
                                    onClick={() =>
                                      toggleTeam(team.team_season_id)
                                    }
                                    className='hover:bg-primary/5 text-muted rounded p-1'
                                  >
                                    {expandedTeams[team.team_season_id] ? (
                                      <ChevronDown size={16} />
                                    ) : (
                                      <ChevronRight size={16} />
                                    )}
                                  </button>

                                  <Link
                                    href={`/teams/${team.team_season_id}`}
                                    className='flex-1 flex items-center gap-2 text-sm text-text hover:bg-surface-hover rounded-lg transition-all py-2 px-2'
                                  >
                                    <span className='flex-1 text-left font-medium truncate'>
                                      {team.team_name}
                                    </span>
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded-full ${badge.color}`}
                                    >
                                      {badge.text}
                                    </span>
                                  </Link>
                                </div>

                                {/* Team Navigation */}
                                {expandedTeams[team.team_season_id] && (
                                  <div className='space-y-1 mt-1 ml-4 border-l border-border pl-2'>
                                    {team.navigation
                                      .filter(
                                        (nav: any) => nav.type !== "divider",
                                      )
                                      .map((navItem: any) => (
                                        <NavButton
                                          key={navItem.id}
                                          item={navItem}
                                          indent={0}
                                        />
                                      ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Footer Actions */}
          {user && (
            <div className='flex-shrink-0 p-4 border-t border-border space-y-2 bg-surface'>
              <LogoutButton />
            </div>
          )}
        </div>

        {/* Custom Scrollbar Styles */}
        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }

          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            margin: 8px 0;
          }

          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            transition: background 0.2s;
          }

          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
          }

          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
          }
        `}</style>
      </aside>
    </>
  );
}

export default NavBar;
