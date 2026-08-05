"use client";

import React, { useEffect, useState } from "react";
import CrudDashboard, { ColumnConfig, SubtableConfig } from "@/components/admin/CrudDashboard";
import { Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getSeasonsDashboardData,
  saveSeason,
  deleteSeason as deleteSeasonAction,
  saveSeasonAgeGroup,
  deleteSeasonAgeGroup,
} from "./actions";

export default function SeasonsAdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const res = await getSeasonsDashboardData();
      setData(res);
    } catch (e: any) {
      toast.error("Failed to load seasons data: " + e.message);
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
        <span className='font-bold text-muted'>Loading seasons...</span>
      </div>
    );
  }

  const { seasons, ageGroups, userScope } = data;

  const handleSave = async (form: any) => {
    const res = await saveSeason({
      id: form.id ? Number(form.id) : undefined,
      name: form.name,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
      cutoff_type: form.cutoff_type || "seasonal",
      clone_from_season_id: form.clone_from_season_id || undefined,
    });

    if (res.success) {
      await loadData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const handleDelete = async (id: any) => {
    const res = await deleteSeasonAction(Number(id));
    if (res.success) {
      await loadData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const handleSubtableSave = async (childItem: any, parentId: any) => {
    const res = await saveSeasonAgeGroup(
      {
        season_id: Number(parentId),
        age_group_id: Number(childItem.age_group_id),
        gender: childItem.gender,
      },
      Number(parentId)
    );

    if (res.success) {
      await loadData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const handleSubtableDelete = async (childId: any) => {
    const res = await deleteSeasonAgeGroup(Number(childId));
    if (res.success) {
      await loadData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // COLUMNS for the main Seasons table
  const columns: ColumnConfig[] = [
    {
      key: "name",
      label: "Season Name",
      type: "text",
      required: true,
      render: (s: any) => (
        <span className='font-bold text-primary'>{s.name}</span>
      ),
    },
    {
      key: "cutoff_type",
      label: "Age Cutoff Standard",
      type: "select",
      options: [
        { value: "seasonal", label: "Seasonal (8/1 - 7/31) - Default" },
        { value: "calendar", label: "Calendar (1/1 - 12/31)" },
      ],
      render: (s: any) => {
        const isCal = s.cutoff_type === "calendar";
        return (
          <span
            className={`px-2 py-0.5 rounded-full text-[0.65rem] font-bold border ${
              isCal
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            {isCal ? "Calendar (1/1–12/31)" : "Seasonal (8/1–7/31)"}
          </span>
        );
      },
    },
    {
      key: "start_date",
      label: "Start Date",
      type: "date",
    },
    {
      key: "end_date",
      label: "End Date",
      type: "date",
    },
    {
      key: "season_age_groups",
      label: "Divisions",
      type: "custom",
      render: (s: any) => {
        const divs = s.season_age_groups || [];
        if (divs.length === 0) {
          return <span className='text-muted/40 italic text-xs'>No divisions configured</span>;
        }
        return (
          <div className='flex flex-wrap gap-1'>
            {divs.map((d: any) => (
              <span
                key={d.id}
                className='px-2 py-0.5 bg-primary/10 text-primary text-[0.65rem] font-bold rounded-full border border-primary/20'
              >
                {d.age_groups?.name || d.name} ({d.gender})
              </span>
            ))}
          </div>
        );
      },
    },
  ];

  // SUBTABLE for age group divisions
  const subtables: SubtableConfig[] = [
    {
      title: "Age Group Divisions",
      relationKey: "season_age_groups",
      parentForeignKey: "season_id",
      columns: [
        {
          key: "age_group_id",
          label: "Age Group",
          type: "select",
          required: true,
          options: ageGroups.map((ag: any) => ({
            value: ag.id,
            label: `[${ag.cutoff_type === "calendar" ? "Calendar 1/1-12/31" : "Seasonal 8/1-7/31"}] ${ag.name}`,
          })),
          render: (child: any) => (
            <span className='font-semibold text-text'>
              {child.age_groups?.name || child.name || `ID: ${child.age_group_id}`}
            </span>
          ),
        },
        {
          key: "gender",
          label: "Gender",
          type: "select",
          required: true,
          options: [
            { value: "Boys", label: "Boys" },
            { value: "Girls", label: "Girls" },
            { value: "Coed", label: "Coed" },
          ],
          render: (child: any) => {
            const color =
              child.gender === "Boys"
                ? "text-blue-600 bg-blue-50 border-blue-200"
                : child.gender === "Girls"
                  ? "text-pink-600 bg-pink-50 border-pink-200"
                  : "text-emerald-600 bg-emerald-50 border-emerald-200";
            return (
              <span className={`px-2 py-0.5 rounded-full text-[0.65rem] font-bold border ${color}`}>
                {child.gender}
              </span>
            );
          },
        },
      ],
      onSave: handleSubtableSave,
      onDelete: handleSubtableDelete,
    },
  ];

  return (
    <CrudDashboard
      title='Seasons Management'
      icon={<Calendar size={32} className='text-primary' />}
      description='Create seasons, specify age group cutoff preferences (defaulting to 8/1–7/31), and configure divisions for Boys and Girls.'
      items={seasons}
      columns={columns}
      onSave={handleSave}
      onDelete={handleDelete}
      subtables={subtables}
      searchPlaceholder='Search seasons by name...'
      extraAddFields={(formState, setFormState) => (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-4 animate-fadeIn'>
          <div>
            <label className='block text-xs font-bold text-text-label mb-1'>
              Age Group Cutoff Preference
            </label>
            <select
              value={formState.cutoff_type || "seasonal"}
              onChange={(e) =>
                setFormState((prev: any) => ({
                  ...prev,
                  cutoff_type: e.target.value,
                }))
              }
              className='text-sm bg-surface font-semibold py-2 px-3 border border-border rounded-md w-full focus:outline-none focus:ring-1 focus:ring-primary'
            >
              <option value='seasonal'>Seasonal (8/1 - 7/31) - Default (TSC, Club Soccer)</option>
              <option value='calendar'>Calendar Year (1/1 - 12/31) - (ODP, US Soccer)</option>
            </select>
            <p className='text-[0.6rem] text-muted mt-1'>
              Determines which age group DOB standard this club/season defaults to.
            </p>
          </div>
          <div>
            <label className='block text-xs font-bold text-text-label mb-1'>
              Clone Divisions From (Optional)
            </label>
            <select
              value={formState.clone_from_season_id || ""}
              onChange={(e) =>
                setFormState((prev: any) => ({
                  ...prev,
                  clone_from_season_id: e.target.value,
                }))
              }
              className='text-sm bg-surface font-semibold py-2 px-3 border border-border rounded-md w-full focus:outline-none focus:ring-1 focus:ring-primary'
            >
              <option value=''>-- Don&apos;t Clone --</option>
              {seasons.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({(s.season_age_groups || []).length} divisions)
                </option>
              ))}
            </select>
            <p className='text-[0.6rem] text-muted mt-1'>
              Copies all age group divisions from the selected season into the new one.
            </p>
          </div>
        </div>
      )}
    />
  );
}
