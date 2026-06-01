"use client";

import React, { useEffect, useState } from "react";
import {
  getSeasonsDashboardData,
  saveSeason,
  deleteSeason,
  saveSeasonAgeGroup,
  deleteSeasonAgeGroup,
} from "../seasons/actions";
import CrudDashboard, {
  ColumnConfig,
  SubtableConfig,
} from "@/components/admin/CrudDashboard";
import { CalendarRange } from "lucide-react";
import { toast } from "sonner";

export default function SeasonsAdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const res = await getSeasonsDashboardData();
      setData(res);
    } catch (e: any) {
      toast.error("Failed to load seasons: " + e.message);
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
        <span className='font-bold text-muted'>
          Loading seasons registry...
        </span>
      </div>
    );
  }

  const { seasons, ageGroups } = data;

  const handleSaveSeason = async (form: any) => {
    const res = await saveSeason({
      id: form.id ? Number(form.id) : undefined,
      name: form.name,
      start_date: form.start_date,
      end_date: form.end_date,
      clone_from_season_id: form.clone_from_season_id || undefined,
    });

    if (res.success) {
      loadData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const handleDeleteSeason = async (id: any) => {
    const res = await deleteSeason(Number(id));
    if (res.success) {
      loadData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const handleSaveSubtable = async (childForm: any, parentId: any) => {
    const res = await saveSeasonAgeGroup(
      {
        season_id: Number(parentId),
        age_group_id: Number(childForm.age_group_id),
        gender: childForm.gender || "Boy",
      },
      Number(parentId),
    );

    if (res.success) {
      loadData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const handleDeleteSubtable = async (childId: any) => {
    const res = await deleteSeasonAgeGroup(Number(childId));
    if (res.success) {
      loadData();
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  // Columns for Season CRUD
  const columns: ColumnConfig[] = [
    {
      key: "name",
      label: "Season Name",
      type: "text",
      required: true,
    },
    {
      key: "start_date",
      label: "Start Date",
      type: "date",
      required: true,
    },
    {
      key: "end_date",
      label: "End Date",
      type: "date",
      required: true,
    },
    {
      key: "season_age_groups",
      label: "Configured Divisions",
      type: "custom",
      render: (s: any) => (
        <div className='flex flex-wrap gap-1 text-xs'>
          {s.season_age_groups && s.season_age_groups.length > 0 ? (
            s.season_age_groups.map((sp: any) => (
              <span
                key={sp.id}
                className='px-2 py-0.5 bg-background border border-border text-text-label font-bold rounded'
              >
                {sp.age_groups?.name} ({sp.gender})
              </span>
            ))
          ) : (
            <span className='text-muted/40 italic'>
              No divisions configured
            </span>
          )}
        </div>
      ),
    },
  ];

  // Subtable configuration for Season Age Groups
  const subtables: SubtableConfig[] = [
    {
      title: "Divisions",
      relationKey: "season_age_groups",
      parentForeignKey: "season_id",
      onSave: handleSaveSubtable,
      onDelete: handleDeleteSubtable,
      columns: [
        {
          key: "age_group_id",
          label: "Age Bracket Bracket",
          type: "select",
          required: true,
          options: ageGroups.map((a: any) => ({ value: a.id, label: a.name })),
        },
        {
          key: "gender",
          label: "Gender Class",
          type: "select",
          required: true,
          options: [
            { value: "Boy", label: "Boy" },
            { value: "Girl", label: "Girl" },
            { value: "Coed", label: "Coed" },
          ],
        },
      ],
    },
  ];

  return (
    <CrudDashboard
      title='Season Management'
      icon={<CalendarRange size={32} className='text-primary animate-pulse' />}
      description='Create academic/sports seasons, configure division brackets, and clone divisions from previous setups.'
      items={seasons}
      columns={columns}
      onSave={handleSaveSeason}
      onDelete={handleDeleteSeason}
      subtables={subtables}
      searchPlaceholder='Search seasons by name...'
      extraAddFields={(formState, setFormState) => (
        <div className='border-t border-border pt-4 animate-fadeIn space-y-2'>
          <label className='block text-xs font-bold text-text-label mb-1'>
            Clone Divisions/Age Groups From (Optional)
          </label>
          <select
            value={formState.clone_from_season_id || ""}
            onChange={(e) =>
              setFormState((prev: any) => ({
                ...prev,
                clone_from_season_id: e.target.value,
              }))
            }
            className='text-sm bg-surface font-semibold py-2 px-3 border border-border rounded-md w-full focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer'
          >
            <option value=''>-- Configure Divisions Manually --</option>
            {seasons.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className='text-[0.65rem] text-muted font-semibold italic leading-relaxed'>
            * Recommendation: Copies all age group division brackets from the
            selected source season automatically. Player registries will NOT be
            copied over.
          </p>
        </div>
      )}
    />
  );
}

// Inline Loader component helper
function Loader2({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width={size || 24}
      height={size || 24}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <path d='M21 12a9 9 0 1 1-6.219-8.56' />
    </svg>
  );
}
