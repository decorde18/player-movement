"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getUsersDashboardData, createUser, updateUser, deleteUser } from "./actions";
import { Shield, Loader2, Check } from "lucide-react";
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
  return "bg-accent/10 text-accent border-accent/20";
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
    <div className="border border-border rounded-md overflow-hidden max-h-44 overflow-y-auto bg-surface">
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
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-primary/5 transition-colors border-b border-border last:border-0 ${
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

// ─── Staff Edit Modal ─────────────────────────────────────────────────────────

function StaffModal({
  user,
  clubs,
  ageGroups,
  seasonTeams,
  onClose,
  onSave,
}: {
  user: UserRecord | null;
  clubs: { id: number; name: string }[];
  ageGroups: AgeGroup[];
  seasonTeams: SeasonTeam[];
  onClose: () => void;
  onSave: (form: any) => Promise<{ success: boolean; error?: string }>;
}) {
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

  // Teams filtered by selected age groups
  const filteredTeams: (SeasonTeam & { label: string })[] = seasonTeams
    .filter((st) => {
      if (form.age_group_ids.length === 0) return true;
      return (
        st.season_age_groups &&
        form.age_group_ids.includes(st.season_age_groups.age_group_id)
      );
    })
    .map((st) => ({
      ...st,
      label: `[${st.season_age_groups?.seasons?.name}] ${st.teams?.name} (${st.season_age_groups?.gender})`,
    }));

  // When age group selection changes, remove any selected teams that are no longer in the filtered list
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
    <Modal isOpen onClose={onClose} title={user ? "Edit Staff Member" : "Add Staff Member"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic info */}
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-bold text-text-label mb-1">Full Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full text-sm bg-surface py-2 px-3 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Jane Smith"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-label mb-1">Email *</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="w-full text-sm bg-surface py-2 px-3 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
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
              className="w-full text-sm bg-surface py-2 px-3 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={user ? "Leave blank to keep current" : "Optional (default: password)"}
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
              className="w-full text-sm bg-surface font-semibold py-2 px-3 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
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
              className="w-full text-sm bg-surface font-semibold py-2 px-3 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
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

        {/* Multi-assign Season Teams (filtered by selected age groups) */}
        <div>
          <label className="block text-xs font-bold text-text-label mb-1">
            Assigned Teams
            {form.season_team_ids.length > 0 && (
              <span className="ml-2 text-primary font-normal">({form.season_team_ids.length} selected)</span>
            )}
          </label>
          {form.age_group_ids.length > 0 && filteredTeams.length === 0 ? (
            <div className="border border-border rounded-md px-3 py-3 text-xs text-muted/50 italic bg-surface">
              No teams found for the selected age group(s).
            </div>
          ) : (
            <MultiSelectList
              options={filteredTeams}
              selected={form.season_team_ids}
              onChange={(ids) => setForm((p) => ({ ...p, season_team_ids: ids }))}
              placeholder="No teams available — assign age groups first to filter"
            />
          )}
          {form.age_group_ids.length === 0 && (
            <p className="text-[0.65rem] text-muted/60 mt-1">
              Tip: Select age groups above to filter the team list.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {user ? "Save Changes" : "Create Staff Member"}
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
    <Modal isOpen onClose={onClose} title="Remove Staff Member">
      <div className="space-y-4">
        <p className="text-sm text-text">
          Are you sure you want to remove <span className="font-bold">{user.name}</span>? This action cannot be
          undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Remove
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
        <span className="font-bold text-muted">Loading staff registry...</span>
      </div>
    );
  }

  const { users, clubs, ageGroups, seasonTeams } = data;

  const filteredUsers = users.filter(
    (u: UserRecord) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

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
      loadData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await deleteUser(Number(deleteTarget.id));
    if (res.success) {
      toast.success("Staff member removed.");
      loadData();
    } else {
      toast.error(res.error || "Failed to remove staff member.");
    }
    setDeleteTarget(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Shield size={28} className="text-primary" />
          <div>
            <h1 className="text-xl font-bold text-text">Staff Registry</h1>
            <p className="text-xs text-muted/70">
              Manage administrator roles, assign age group coordinators and team coaching scopes.
            </p>
          </div>
        </div>
        <Button variant="primary" onClick={() => setModalUser("new")}>
          + Add Staff Member
        </Button>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search staff by name or email..."
        className="w-full max-w-sm text-sm bg-surface py-2 px-3 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
      />

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="text-left px-4 py-2 text-xs font-bold text-text-label">Name</th>
              <th className="text-left px-4 py-2 text-xs font-bold text-text-label">Role</th>
              <th className="text-left px-4 py-2 text-xs font-bold text-text-label hidden md:table-cell">Club</th>
              <th className="text-left px-4 py-2 text-xs font-bold text-text-label hidden lg:table-cell">
                Age Groups
              </th>
              <th className="text-left px-4 py-2 text-xs font-bold text-text-label hidden lg:table-cell">Teams</th>
              <th className="text-right px-4 py-2 text-xs font-bold text-text-label">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted/50 italic text-sm">
                  No staff members found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u: UserRecord) => {
                // Merge legacy + multi-assign for display
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
                    `${u.season_teams.teams.name} (${u.season_teams.season_age_groups?.gender})`
                  );
                }
                u.user_season_teams.forEach((r) => {
                  if (r.season_teams?.teams?.name) {
                    displayTeams.push(
                      `${r.season_teams.teams.name} (${r.season_teams.season_age_groups?.gender})`
                    );
                  }
                });

                return (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-primary/5 transition-colors">
                    <td className="px-4 py-2">
                      <div className="font-bold text-sm">{u.name}</div>
                      <div className="text-xs text-muted/60">{u.email}</div>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-[0.7rem] font-bold px-2 py-0.5 rounded-full border ${roleBadgeClass(u.role)}`}>
                        {roleLabels[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-2 hidden md:table-cell">
                      <span className="text-xs font-semibold text-muted">{u.clubs?.name || "Global"}</span>
                    </td>
                    <td className="px-4 py-2 hidden lg:table-cell">
                      {displayAgeGroups.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {displayAgeGroups.map((ag) => (
                            <span key={ag} className="text-[0.65rem] px-1.5 py-0.5 bg-purple/10 text-purple border border-purple/20 rounded font-semibold">
                              {ag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted/40 italic">None</span>
                      )}
                    </td>
                    <td className="px-4 py-2 hidden lg:table-cell">
                      {displayTeams.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {displayTeams.map((t) => (
                            <span key={t} className="text-[0.65rem] px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded font-semibold">
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted/40 italic">None</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setModalUser(u)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleteTarget(u)}>
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {modalUser && (
        <StaffModal
          user={modalUser === "new" ? null : modalUser}
          clubs={clubs}
          ageGroups={ageGroups}
          seasonTeams={seasonTeams}
          onClose={() => setModalUser(null)}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirm Modal */}
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
