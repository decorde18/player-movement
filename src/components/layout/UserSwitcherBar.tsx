"use client";

import React, { useEffect, useState, useTransition } from "react";
import { getUsersForImpersonation, setImpersonatedUser } from "@/lib/actions/impersonation";
import { X, Eye } from "lucide-react";
import { toast } from "sonner";

interface UserSwitcherBarProps {
  currentUser?: any;
}

export default function UserSwitcherBar({ currentUser }: UserSwitcherBarProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isImpersonating = currentUser?.isImpersonating || false;
  const showDevSwitcher =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ENABLE_DEV_USER_SWITCHER === "true";

  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsEmbedded(window.self !== window.top || window.location.search.includes("embedded=true"));
    }
  }, []);

  useEffect(() => {
    if (isEmbedded || (!showDevSwitcher && !isImpersonating)) return;

    async function loadUsers() {
      setLoading(true);
      try {
        const res = await getUsersForImpersonation();
        if (res.success) {
          setUsers(res.users || []);
        }
      } catch {
        // ignore fetch error
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, [showDevSwitcher, isImpersonating, isEmbedded]);

  if (isEmbedded || (!showDevSwitcher && !isImpersonating)) {
    return null;
  }



  const handleSelectUser = (userIdStr: string) => {
    const val = userIdStr === "reset" ? null : Number(userIdStr);

    startTransition(async () => {
      const res = await setImpersonatedUser(val);
      if (res.success) {
        toast.success(val === null ? "Stopped impersonating user." : "Switched impersonated user!");
        window.location.reload();
      } else {
        toast.error("Failed to switch user.");
      }
    });
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "system_admin": return "System Admin";
      case "club_admin": return "Club Admin";
      case "age_group_admin": return "Age Group Coordinator";
      case "coach": return "Team Coach";
      default: return role;
    }
  };

  return (
    <div className={`w-full py-1.5 px-4 text-xs font-bold transition-all flex flex-wrap items-center justify-between gap-3 ${
      isImpersonating
        ? "bg-amber-500/20 text-amber-900 border-b border-amber-500/40"
        : "bg-surface/90 text-text border-b border-border"
    }`}>
      <div className='flex items-center gap-2'>
        <span className={`flex items-center gap-1.5 font-extrabold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
          isImpersonating ? "bg-amber-500 text-slate-950" : "bg-primary/10 text-primary border border-primary/20"
        }`}>
          <Eye size={12} />
          {isImpersonating ? "Mimic Mode Active" : "Dev User Switcher"}
        </span>

        <span className='text-[11px] font-semibold text-muted hidden sm:inline'>
          {isImpersonating ? (
            <span>
              Mimicking: <strong className='text-amber-700 font-extrabold'>{currentUser?.name || currentUser?.email}</strong> ({getRoleLabel(currentUser?.role)})
            </span>
          ) : (
            <span>Switch user perspective to test role permissions:</span>
          )}
        </span>
      </div>

      <div className='flex items-center gap-2'>
        <select
          value={currentUser?.id || "reset"}
          onChange={(e) => handleSelectUser(e.target.value)}
          disabled={loading || isPending}
          className='text-xs font-bold bg-background border border-border rounded-lg px-2 py-1 text-text focus:outline-none cursor-pointer max-w-[220px] truncate'
        >
          <option value='reset'>-- Original Dev User --</option>
          {users.map((u: any) => {
            const teamName = u.season_teams?.teams?.name ? ` • Team: ${u.season_teams.teams.name}` : "";
            const ageName = u.age_groups?.name ? ` • Div: ${u.age_groups.name}` : "";
            return (
              <option key={u.id} value={u.id.toString()}>
                {u.name || u.email} ({getRoleLabel(u.role)}{teamName}{ageName})
              </option>
            );
          })}
        </select>

        {isImpersonating && (
          <button
            onClick={() => handleSelectUser("reset")}
            disabled={isPending}
            className='bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors'
            title='Stop Mimicking'
          >
            <X size={12} />
            <span>Stop</span>
          </button>
        )}
      </div>
    </div>
  );
}
