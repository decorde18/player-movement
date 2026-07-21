"use client";

import React, { useEffect, useState } from "react";
import { getUsersDashboardData, createUser, updateUser, deleteUser } from "./actions";
import CrudDashboard, { ColumnConfig } from "@/components/admin/CrudDashboard";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function UsersAdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const res = await getUsersDashboardData();
      setData(res);
    } catch (e: any) {
      toast.error("Failed to load users data: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading || !data) {
    return (
      <div className='min-h-screen flex flex-col items-center justify-center bg-background text-text gap-3'>
        <Loader2 className='animate-spin text-primary' size={44} />
        <span className='font-bold text-muted'>Loading staffing registry...</span>
      </div>
    );
  }

  const { users, clubs, ageGroups, seasonTeams, userScope } = data;

  const handleSave = async (form: any) => {
    const payload = {
      name: form.name,
      email: form.email,
      password: form.password || undefined,
      role: form.role,
      club_id: form.club_id ? Number(form.club_id) : null,
      assigned_age_group_id: form.assigned_age_group_id ? Number(form.assigned_age_group_id) : null,
      assigned_team_id: form.assigned_team_id ? Number(form.assigned_team_id) : null,
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

  const handleDelete = async (id: any) => {
    const res = await deleteUser(Number(id));
    if (res.success) {
      loadData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // Map roles to human-readable strings
  const roleLabels: Record<string, string> = {
    system_admin: "System Administrator",
    club_admin: "Club Administrator",
    age_group_admin: "Age Group Coordinator",
    coach: "Coach",
  };

  const columns: ColumnConfig[] = [
    {
      key: "name",
      label: "Name",
      type: "text",
      required: true,
      render: (u: any) => (
        <div>
          <span className='font-bold block text-sm'>{u.name}</span>
          <span className='text-xs text-muted/60 block'>{u.email}</span>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      type: "text",
      required: true,
      // Field rendered inside name column render but needed for form validation
    },
    {
      key: "password",
      label: "Password",
      type: "text",
      required: false,
      // Handled in backend, optionally entered on creation/edit
    },
    {
      key: "role",
      label: "Role",
      type: "select",
      required: true,
      options: [
        { value: "system_admin", label: roleLabels.system_admin },
        { value: "club_admin", label: roleLabels.club_admin },
        { value: "age_group_admin", label: roleLabels.age_group_admin },
        { value: "coach", label: roleLabels.coach },
      ],
      render: (u: any) => {
        const bgClass =
          u.role === "system_admin"
            ? "bg-red/10 text-red border-red/20"
            : u.role === "club_admin"
            ? "bg-primary/10 text-primary border-primary/20"
            : u.role === "age_group_admin"
            ? "bg-purple/10 text-purple border-purple/20"
            : "bg-accent/10 text-accent border-accent/20";
        return (
          <span className={`text-[0.7rem] font-bold px-2 py-0.5 rounded-full border ${bgClass}`}>
            {roleLabels[u.role] || u.role}
          </span>
        );
      },
    },
    {
      key: "club_id",
      label: "Club Scope",
      type: "select",
      required: false,
      options: [
        { value: "", label: "-- None / Global --" },
        ...clubs.map((c: any) => ({ value: c.id, label: c.name })),
      ],
      render: (u: any) => (
        <span className='text-xs font-semibold text-muted'>{u.clubs?.name || "Global Scope"}</span>
      ),
    },
    {
      key: "assigned_age_group_id",
      label: "Assigned Age Group",
      type: "select",
      required: false,
      options: [
        { value: "", label: "-- None --" },
        ...ageGroups.map((g: any) => ({ value: g.id, label: g.name })),
      ],
      render: (u: any) => (
        <span className='text-xs text-muted/80'>{u.age_groups?.name || "N/A"}</span>
      ),
    },
    {
      key: "assigned_team_id",
      label: "Assigned Coach Team",
      type: "select",
      required: false,
      options: [
        { value: "", label: "-- None --" },
        ...seasonTeams.map((st: any) => ({
          value: st.id,
          label: `[${st.season_age_groups?.seasons?.name}] ${st.teams?.name} (${st.season_age_groups?.gender})`,
        })),
      ],
      render: (u: any) => (
        <span className='text-xs text-muted/80'>
          {u.season_teams
            ? `${u.season_teams.teams?.name} (${u.season_teams.season_age_groups?.gender})`
            : "N/A"}
        </span>
      ),
    },
  ];

  return (
    <CrudDashboard
      title='Staff Registry'
      icon={<Shield size={32} className='text-primary' />}
      description='Manage administrator roles, assign age group coordinators, and configure team coaching scopes.'
      items={users}
      columns={columns}
      onSave={handleSave}
      onDelete={handleDelete}
      searchPlaceholder='Search staff by name or email...'
    />
  );
}
