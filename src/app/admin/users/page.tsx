"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getUsersDashboardData, createUser, updateUser, deleteUser } from "./actions";
import {
  Shield,
  Loader2,
  Check,
  Users,
  UserCheck,
  UserPlus,
  Search,
  Filter,
  Building2,
  KeyRound,
  X,
  Edit2,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgeGroup {
  id: number;
  name: string;
}

interface SeasonTeam {
  id: number;
  teams: { name: string } | null;
  season_age_groups: {
    gender: string;
    age_group_id: number;
    age_groups: { name: string } | null;
    seasons: { name: string } | null;
  } | null;
}

interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: string;
  club_id: number | null;
  clubs: { name: string } | null;
  age_groups: { name: string } | null;
  season_teams: any | null;
  user_age_groups: { age_group_id: number; age_groups: { name: string } | null }[];
  user_season_teams: {
    season_team_id: number;
    season_teams: {
      teams: { name: string } | null;
      season_age_groups: {
        gender: string;
        age_groups: { name: string } | null;
        seasons: { name: string } | null;
      } | null;
    } | null;
  }[];
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

const roleLabels: Record<string, string> = {
  system_admin: "System Administrator",
  club_admin: "Club Administrator",
  age_group_admin: "Age Group Coordinator",
  coach: "Coach",
};

const roleBadgeClass = (role: string) => {
  if (role === "system_admin") return "bg-red/10 text-red border-red/20";
  if (role === "club_admin") return "bg-primary/10 text-primary border-primary/20";
  if (role === "age_group_admin") return "bg-purple/10 text-purple border-purple/20";
  return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
};

// ─── Multi-select chip component ──────────────────────────────────────────────

function MultiSelectList<T extends { id: number; label: string }>({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: T[];
  selected: number[];
  onChange: (ids: number[]) => void;
  placeholder: string;
}) {
  const toggle = (id: number) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden max-h-44 overflow-y-auto bg-surface">
      {options.length === 0 ? (
        <div className="px-3 py-3 text-xs text-muted/50 italic">{placeholder}</div>
      ) : (
        options.map((opt) => {
          const isSelected = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-primary/5 transition-colors border-b border-border/50 last:border-0 ${
                isSelected ? "bg-primary/10 font-semibold text-primary" : "text-text"
              }`}
            >
              <span
                className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                  isSelected ? "bg-primary border-primary" : "border-border"
                }`}
              >
                {isSelected && <Check size={10} className="text-white" />}
              </span>
              {opt.label}
            </button>
          );
        })
      )}
    </div>
  );
}

// ─── User Create / Edit Modal ─────────────────────────────────────────────────

function StaffModal({
  user,
  clubs,
  ageGroups,
  seasonTeams,
  seasons,
  onClose,
  onSave,
}: {
  user: UserRecord | null;
  clubs: { id: number; name: string }[];
  ageGroups: AgeGroup[];
  seasonTeams: SeasonTeam[];
  seasons: { id: number; name: string }[];
  onClose: () => void;
  onSave: (form: any) => Promise<{ success: boolean; error?: string }>;
}) {
  const [selectedSeasonFilter, setSelectedSeasonFilter] = useState<string>("all");
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
    role: user?.role || "coach",
    club_id: user?.club_id?.toString() || "",
    age_group_ids: user?.user_age_groups?.map((r) => r.age_group_id) || [],
    season_team_ids: user?.user_season_teams?.map((r) => r.season_team_id) || [],
  });
  const [saving, setSaving] = useState(false);

  // Teams filtered by selected age groups & season
  const filteredTeams: (SeasonTeam & { label: string })[] = seasonTeams
    .filter((st) => {
      const matchesAgeGroup =
        form.age_group_ids.length === 0 ||
        (st.season_age_groups && form.age_group_ids.includes(st.season_age_groups.age_group_id));
      const matchesSeason =
        selectedSeasonFilter === "all" ||
        st.season_age_groups?.seasons?.name === selectedSeasonFilter ||
        (seasons.find((s) => s.id === Number(selectedSeasonFilter))?.name === st.season_age_groups?.seasons?.name);

      return matchesAgeGroup && matchesSeason;
    })
    .map((st) => ({
      ...st,
      label: `[${st.season_age_groups?.seasons?.name || "Season"}] ${st.teams?.name} (${st.season_age_groups?.gender})`,
    }));

  const handleAgeGroupChange = (ids: number[]) => {
    const filteredTeamIds = seasonTeams
      .filter(
        (st) => ids.length === 0 || (st.season_age_groups && ids.includes(st.season_age_groups.age_group_id))
      )
      .map((st) => st.id);
    setForm((prev) => ({
      ...prev,
      age_group_ids: ids,
      season_team_ids: prev.season_team_ids.filter((id) => filteredTeamIds.includes(id)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await onSave({ ...form, id: user?.id });
    setSaving(false);
    if (res.success) {
      onClose();
    } else {
      toast.error(res.error || "Failed to save user.");
    }
  };

  const ageGroupOptions = ageGroups.map((ag) => ({ ...ag, label: ag.name }));

  return (
    <Modal isOpen onClose={onClose} title={user ? `Edit User: ${user.name}` : "Create New User"} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        {/* Basic info */}
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-bold text-text-label mb-1">Full Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full text-sm bg-surface py-2 px-3 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Jane Smith"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-label mb-1">Email Address *</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="w-full text-sm bg-surface py-2 px-3 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="jane@club.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-label mb-1">
              Password {user ? "(leave blank to keep current)" : "*(default: 'password')"}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              className="w-full text-sm bg-surface py-2 px-3 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={user ? "Leave blank to keep current password" : "Password (default: password)"}
            />
          </div>
        </div>

        {/* Role & Club */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-text-label mb-1">Role *</label>
            <select
              required
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              className="w-full text-sm bg-surface font-semibold py-2 px-3 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="system_admin">System Administrator</option>
              <option value="club_admin">Club Administrator</option>
              <option value="age_group_admin">Age Group Coordinator</option>
              <option value="coach">Coach</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-label mb-1">Club Scope</label>
            <select
              value={form.club_id}
              onChange={(e) => setForm((p) => ({ ...p, club_id: e.target.value }))}
              className="w-full text-sm bg-surface font-semibold py-2 px-3 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">-- None / Global --</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Multi-assign Age Groups */}
        <div>
          <label className="block text-xs font-bold text-text-label mb-1">
            Assigned Age Groups
            {form.age_group_ids.length > 0 && (
              <span className="ml-2 text-primary font-normal">({form.age_group_ids.length} selected)</span>
            )}
          </label>
          <MultiSelectList
            options={ageGroupOptions}
            selected={form.age_group_ids}
            onChange={handleAgeGroupChange}
            placeholder="No age groups available"
          />
        </div>

        {/* Multi-assign Season Teams */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-text-label">
              Assigned Teams
              {form.season_team_ids.length > 0 && (
                <span className="ml-2 text-primary font-normal">({form.season_team_ids.length} selected)</span>
              )}
            </label>
            {seasons && seasons.length > 0 && (
              <select
                value={selectedSeasonFilter}
                onChange={(e) => setSelectedSeasonFilter(e.target.value)}
                className="text-[0.65rem] font-bold bg-background border border-border rounded px-1.5 py-0.5"
              >
                <option value="all">All Seasons</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    Season: {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {filteredTeams.length === 0 ? (
            <div className="border border-border rounded-lg px-3 py-3 text-xs text-muted/50 italic bg-surface">
              No teams found for the selected age group(s) / season filter.
            </div>
          ) : (
            <MultiSelectList
              options={filteredTeams}
              selected={form.season_team_ids}
              onChange={(ids) => setForm((p) => ({ ...p, season_team_ids: ids }))}
              placeholder="No teams available — assign age groups first to filter"
            />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {user ? "Save Changes" : "Create User"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({
  user,
  onClose,
  onConfirm,
}: {
  user: UserRecord;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal isOpen onClose={onClose} title="Delete User Account" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-text leading-relaxed">
          Are you sure you want to delete <span className="font-bold text-primary">{user.name}</span> (<span className="text-muted">{user.email}</span>)? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Delete User
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsersAdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [clubFilter, setClubFilter] = useState<string>("all");
  const [modalUser, setModalUser] = useState<UserRecord | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await getUsersDashboardData();
      setData(res);
    } catch (e: any) {
      toast.error("Failed to load users data: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-text gap-3">
        <Loader2 className="animate-spin text-primary" size={44} />
        <span className="font-bold text-muted text-sm">Loading User Management Registry...</span>
      </div>
    );
  }

  const { users, clubs, ageGroups, seasonTeams, seasons } = data;

  const filteredUsers = users.filter((u: UserRecord) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesClub =
      clubFilter === "all" ||
      (clubFilter === "none" ? u.club_id === null : u.club_id === Number(clubFilter));

    return matchesSearch && matchesRole && matchesClub;
  });

  const countByRole = {
    total: users.length,
    system_admin: users.filter((u: any) => u.role === "system_admin").length,
    club_admin: users.filter((u: any) => u.role === "club_admin").length,
    age_group_admin: users.filter((u: any) => u.role === "age_group_admin").length,
    coach: users.filter((u: any) => u.role === "coach").length,
  };

  const handleSave = async (form: any) => {
    const payload = {
      name: form.name,
      email: form.email,
      password: form.password || undefined,
      role: form.role,
      club_id: form.club_id ? Number(form.club_id) : null,
      age_group_ids: (form.age_group_ids || []).map(Number),
      season_team_ids: (form.season_team_ids || []).map(Number),
    };

    let res;
    if (form.id) {
      res = await updateUser(Number(form.id), payload);
    } else {
      res = await createUser(payload);
    }

    if (res.success) {
      toast.success(form.id ? `User "${form.name}" updated successfully.` : `User "${form.name}" created successfully.`);
      loadData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await deleteUser(Number(deleteTarget.id));
    if (res.success) {
      toast.success(`User "${deleteTarget.name}" deleted.`);
      loadData();
    } else {
      toast.error(res.error || "Failed to delete user.");
    }
    setDeleteTarget(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Users size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text">User Management</h1>
            <p className="text-xs text-muted mt-0.5">
              Manage accounts, roles, permissions, club scope, and team coaching assignments.
            </p>
          </div>
        </div>
        <Button variant="primary" onClick={() => setModalUser("new")} className="flex items-center gap-2 self-start md:self-auto">
          <UserPlus size={16} />
          <span>Add New User</span>
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div
          onClick={() => setRoleFilter("all")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            roleFilter === "all" ? "bg-primary/10 border-primary ring-1 ring-primary/20" : "bg-surface border-border hover:bg-background"
          }`}
        >
          <div className="text-[0.65rem] font-bold uppercase tracking-wider text-muted">Total Accounts</div>
          <div className="text-2xl font-black text-text mt-1">{countByRole.total}</div>
        </div>
        <div
          onClick={() => setRoleFilter("system_admin")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            roleFilter === "system_admin" ? "bg-red/10 border-red ring-1 ring-red/20" : "bg-surface border-border hover:bg-background"
          }`}
        >
          <div className="text-[0.65rem] font-bold uppercase tracking-wider text-red">System Admins</div>
          <div className="text-2xl font-black text-text mt-1">{countByRole.system_admin}</div>
        </div>
        <div
          onClick={() => setRoleFilter("club_admin")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            roleFilter === "club_admin" ? "bg-primary/10 border-primary ring-1 ring-primary/20" : "bg-surface border-border hover:bg-background"
          }`}
        >
          <div className="text-[0.65rem] font-bold uppercase tracking-wider text-primary">Club Admins</div>
          <div className="text-2xl font-black text-text mt-1">{countByRole.club_admin}</div>
        </div>
        <div
          onClick={() => setRoleFilter("age_group_admin")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            roleFilter === "age_group_admin" ? "bg-purple/10 border-purple ring-1 ring-purple/20" : "bg-surface border-border hover:bg-background"
          }`}
        >
          <div className="text-[0.65rem] font-bold uppercase tracking-wider text-purple">Coordinators</div>
          <div className="text-2xl font-black text-text mt-1">{countByRole.age_group_admin}</div>
        </div>
        <div
          onClick={() => setRoleFilter("coach")}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            roleFilter === "coach" ? "bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500/20" : "bg-surface border-border hover:bg-background"
          }`}
        >
          <div className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-500">Coaches</div>
          <div className="text-2xl font-black text-text mt-1">{countByRole.coach}</div>
        </div>
      </div>

      {/* Controls Bar: Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-3 rounded-xl border border-border">
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full text-xs font-semibold bg-background py-2 pl-9 pr-8 border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted shrink-0">
            <Filter size={14} />
            <span>Filters:</span>
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs font-bold bg-background py-2 px-3 border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="system_admin">System Admin</option>
            <option value="club_admin">Club Admin</option>
            <option value="age_group_admin">Age Group Coordinator</option>
            <option value="coach">Coach</option>
          </select>

          {clubs.length > 0 && (
            <select
              value={clubFilter}
              onChange={(e) => setClubFilter(e.target.value)}
              className="text-xs font-bold bg-background py-2 px-3 border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">All Clubs</option>
              <option value="none">Global / No Club</option>
              {clubs.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {(search || roleFilter !== "all" || clubFilter !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setRoleFilter("all");
                setClubFilter("all");
              }}
              className="text-xs font-extrabold text-primary hover:underline px-2"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-background/80 border-b border-border text-[0.65rem] uppercase tracking-wider font-extrabold text-muted">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Club Scope</th>
                <th className="px-4 py-3">Age Groups</th>
                <th className="px-4 py-3">Assigned Teams</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted italic text-xs">
                    No users match your criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u: UserRecord) => {
                  const displayAgeGroups: string[] = [];
                  if (u.age_groups?.name && u.user_age_groups.length === 0) {
                    displayAgeGroups.push(u.age_groups.name);
                  }
                  u.user_age_groups.forEach((r) => {
                    if (r.age_groups?.name) displayAgeGroups.push(r.age_groups.name);
                  });

                  const displayTeams: string[] = [];
                  if (u.season_teams?.teams?.name && u.user_season_teams.length === 0) {
                    displayTeams.push(
                      `${u.season_teams.teams.name} (${u.season_teams.season_age_groups?.gender || "Coed"})`
                    );
                  }
                  u.user_season_teams.forEach((r) => {
                    if (r.season_teams?.teams?.name) {
                      displayTeams.push(
                        `${r.season_teams.teams.name} (${r.season_teams.season_age_groups?.gender || "Coed"})`
                      );
                    }
                  });

                  const initials = u.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr key={u.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                            {initials || <UserIcon size={14} />}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-text">{u.name}</div>
                            <div className="text-[0.65rem] text-muted">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full border ${roleBadgeClass(u.role)}`}>
                          {roleLabels[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-text">
                          {u.clubs?.name || <span className="text-muted/60 italic">Global / System</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {displayAgeGroups.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {displayAgeGroups.map((ag) => (
                              <span key={ag} className="text-[0.6rem] px-1.5 py-0.5 bg-purple/10 text-purple border border-purple/20 rounded-full font-bold">
                                {ag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[0.65rem] text-muted/40 italic">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {displayTeams.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {displayTeams.map((t) => (
                              <span key={t} className="text-[0.6rem] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-full font-bold">
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[0.65rem] text-muted/40 italic">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setModalUser(u)}
                            className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                            title="Edit User"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-all cursor-pointer"
                            title="Delete User"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {modalUser && (
        <StaffModal
          user={modalUser === "new" ? null : modalUser}
          clubs={clubs}
          ageGroups={ageGroups}
          seasonTeams={seasonTeams}
          seasons={seasons || []}
          onClose={() => setModalUser(null)}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmDeleteModal
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

