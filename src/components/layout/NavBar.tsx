"use client";

import { 
  Menu, 
  X, 
  Building2, 
  Shield, 
  Users, 
  Calendar, 
  Layers, 
  Award, 
  ClipboardList, 
  LogOut, 
  LayoutDashboard,
  Kanban
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { setActiveClub } from "@/lib/actions/clubs";
import { setActiveSeason } from "@/lib/actions/season-actions";
import { setActiveAgeGroup } from "@/lib/actions/active-age-group";

interface NavBarProps {
  user?: any;
  clubs?: { id: number; name: string }[];
  activeClubId?: number;
  seasons?: { id: number; name: string }[];
  activeSeasonId?: number;
  ageGroups?: { id: number; gender: string; age_groups: { name: string } }[];
  activeAgeGroupId?: number;
}

function NavBar({ 
  user, 
  clubs = [], 
  activeClubId, 
  seasons = [], 
  activeSeasonId, 
  ageGroups = [], 
  activeAgeGroupId 
}: NavBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-manage sidebar visibility on desktop resize
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

  // Auto-close sidebar on route change (mobile only)
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [pathname]);

  const handleClubChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    startTransition(async () => {
      await setActiveClub(val);
      router.refresh();
    });
  };

  const handleSeasonChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    startTransition(async () => {
      await setActiveSeason(val);
      router.refresh();
    });
  };

  const handleAgeGroupChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    startTransition(async () => {
      await setActiveAgeGroup(val);
      router.refresh();
    });
  };

  // Get friendly role label
  const roleLabels: Record<string, string> = {
    system_admin: "System Admin",
    club_admin: "Club Admin",
    age_group_admin: "Age Group Coord.",
    coach: "Coach",
  };

  const userRole = user?.role || "coach";
  const userClubName = user?.clubId ? clubs.find(c => c.id === user.clubId)?.name || "Strikers FC" : "Global System";

  // Build dynamic navigation items based on user role
  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      path: "/admin",
      icon: <LayoutDashboard size={18} />,
      visible: true,
    },
    {
      id: "users",
      label: "Staff Registry",
      path: "/admin/users",
      icon: <Shield size={18} />,
      visible: userRole === "system_admin" || userRole === "club_admin",
    },
    {
      id: "clubs",
      label: "Clubs",
      path: "/admin/clubs",
      icon: <Building2 size={18} />,
      visible: userRole === "system_admin",
    },
    {
      id: "seasons",
      label: "Seasons",
      path: "/admin/seasons",
      icon: <Calendar size={18} />,
      visible: userRole === "system_admin" || userRole === "club_admin",
    },
    {
      id: "age-groups",
      label: "Age Groups",
      path: "/admin/age-groups",
      icon: <Layers size={18} />,
      visible: userRole === "system_admin" || userRole === "club_admin",
    },
    {
      id: "players",
      label: "Player Registry",
      path: "/admin/players",
      icon: <Users size={18} />,
      visible: userRole !== "coach", // visible to system_admin, club_admin, age_group_admin
    },
    {
      id: "events",
      label: "Events & Sessions",
      path: "/admin/events",
      icon: <Award size={18} />,
      visible: userRole !== "coach", // visible to system_admin, club_admin, age_group_admin
    },
    {
      id: "player-board",
      label: "Player Board",
      path: "/player-board",
      icon: <Kanban size={18} />,
      visible: true,
    },
    {
      id: "try",
      label: "Evaluation App",
      path: "/admin/try",
      icon: <ClipboardList size={18} />,
      visible: true,
    },
  ];

  return (
    <>
      {/* Mobile Hamburger Header */}
      <div className='lg:hidden fixed top-0 left-0 right-0 h-16 bg-surface border-b border-border flex items-center justify-between px-4 z-[1000]'>
        <span className='font-bold text-lg text-primary tracking-wide'>Soccer Movement</span>
        <button
          onClick={() => setSidebarOpen(true)}
          className='p-2 rounded-md hover:bg-surface-hover border border-border text-text cursor-pointer'
          aria-label='Open navigation sidebar'
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div
          className='lg:hidden fixed inset-0 bg-black/50 z-[1050] transition-opacity duration-300'
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-surface text-text border-r border-border z-[1100] transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:shadow-none flex flex-col
          ${sidebarOpen ? "translate-x-0 shadow-[4px_0_20px_rgba(0,0,0,0.1)]" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Sidebar Header */}
        <div className='flex-shrink-0 h-16 border-b border-border flex items-center justify-between px-6'>
          <h1 className='text-xl font-bold text-primary tracking-wide'>Soccer Movement</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className='lg:hidden p-1.5 rounded-md text-muted hover:bg-surface-hover hover:text-text cursor-pointer'
            aria-label='Close navigation sidebar'
          >
            <X size={20} />
          </button>
        </div>

        {/* Viewing Context Selector / Badge */}
        <div className='flex-shrink-0 border-b border-border bg-surface-hover/30 flex flex-col'>
          {userRole === "system_admin" ? (
            <div className='p-4 pb-2'>
              <label className='block text-[0.65rem] font-bold text-text-label uppercase tracking-widest mb-1.5'>
                Viewing Club Context {isPending && <span className='animate-pulse text-primary'>(Switching...)</span>}
              </label>
              <select
                value={activeClubId || ""}
                onChange={handleClubChange}
                disabled={isPending}
                className='w-full text-xs font-semibold bg-surface py-2 px-3 border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all disabled:opacity-50'
              >
                <option value=''>-- Global / All Clubs --</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className='p-4 pb-2 text-xs space-y-1.5'>
              <div className='flex items-center gap-1.5'>
                <span className='text-[0.65rem] font-bold text-text-label uppercase tracking-widest'>Viewing Role:</span>
                <span className='font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-[10px] uppercase'>
                  {roleLabels[userRole] || userRole}
                </span>
              </div>
              {user?.clubId && (
                <div className='flex items-center gap-1.5 text-muted'>
                  <Building2 size={12} className='text-muted/60' />
                  <span className='font-semibold text-text/80'>{userClubName}</span>
                </div>
              )}
            </div>
          )}

          <div className='p-4 pt-2 border-t border-border/40'>
            <label className='block text-[0.65rem] font-bold text-text-label uppercase tracking-widest mb-1.5'>
              Active Season Context
            </label>
            <select
              value={activeSeasonId || ""}
              onChange={handleSeasonChange}
              disabled={isPending}
              className='w-full text-xs font-semibold bg-surface py-2 px-3 border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all disabled:opacity-50'
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className='p-4 pt-2 border-t border-border/40'>
            <label className='block text-[0.65rem] font-bold text-text-label uppercase tracking-widest mb-1.5'>
              Active Division
            </label>
            <select
              value={activeAgeGroupId || ""}
              onChange={handleAgeGroupChange}
              disabled={isPending || ageGroups.length === 0}
              className='w-full text-xs font-semibold bg-surface py-2 px-3 border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all disabled:opacity-50'
            >
              {ageGroups.length === 0 ? (
                <option value=''>-- No divisions configured --</option>
              ) : (
                <>
                  <option value=''>-- Select Division --</option>
                  {ageGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.age_groups.name} ({g.gender})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className='flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar'>
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.id}
                  href={item.path}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition-all duration-200 rounded-lg ${
                    isActive
                      ? "bg-primary/10 text-primary font-bold shadow-sm"
                      : "bg-transparent text-text hover:bg-surface-hover hover:translate-x-1"
                  }`}
                >
                  {item.icon}
                  <span className='font-medium'>{item.label}</span>
                </Link>
              );
            })}
        </nav>

        {/* Sidebar Footer */}
        {user && (
          <div className='flex-shrink-0 p-4 border-t border-border bg-surface flex flex-col gap-2'>
            <div className='flex flex-col px-2 py-1 mb-1'>
              <span className='text-xs font-bold truncate'>{user.name || "Default User"}</span>
              <span className='text-[0.65rem] text-muted truncate'>{user.email}</span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className='w-full flex items-center justify-center gap-2 py-2 px-4 bg-red/10 text-red border border-red/20 font-bold rounded-lg text-sm hover:bg-red/20 transition-all cursor-pointer'
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        )}
      </aside>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(var(--primary-rgb), 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(var(--primary-rgb), 0.4);
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(var(--primary-rgb), 0.2) transparent;
        }
      `}</style>
    </>
  );
}

export default NavBar;
