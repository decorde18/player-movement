"use client";

import React, { useState } from "react";
import { Plus, Edit2, Trash2, Calendar } from "lucide-react";
import {
  createAgeGroup,
  updateAgeGroup,
  deleteAgeGroup,
} from "@/lib/actions/age-groups";

// UI Components
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

export default function AgeGroupsManager({
  initialAgeGroups,
}: {
  initialAgeGroups: any[];
}) {
  const [ageGroups, setAgeGroups] = useState(initialAgeGroups);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgeGroup, setEditingAgeGroup] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    dob_start: "",
    dob_end: "",
    cutoff_type: "seasonal",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenModal = (ageGroup?: any) => {
    if (ageGroup) {
      setEditingAgeGroup(ageGroup);
      setFormData({
        name: ageGroup.name,
        dob_start: ageGroup.dob_start
          ? new Date(ageGroup.dob_start).toISOString().split("T")[0]
          : "",
        dob_end: ageGroup.dob_end
          ? new Date(ageGroup.dob_end).toISOString().split("T")[0]
          : "",
        cutoff_type: ageGroup.cutoff_type || "seasonal",
      });
    } else {
      setEditingAgeGroup(null);
      setFormData({ name: "", dob_start: "", dob_end: "", cutoff_type: "seasonal" });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingAgeGroup) {
        await updateAgeGroup(editingAgeGroup.id, formData);
      } else {
        await createAgeGroup(formData);
      }
      setIsModalOpen(false);
      window.location.reload();
    } catch (error: any) {
      console.error(error);
      alert(error.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (
      confirm(
        "Are you sure you want to delete this age group? This will fail if it's already used in a season.",
      )
    ) {
      try {
        await deleteAgeGroup(id);
        window.location.reload();
      } catch (error: any) {
        console.error(error);
        alert(error.message || "Failed to delete age group");
      }
    }
  };

  return (
    <div className='bg-[var(--card)] rounded-xl shadow-sm border border-[var(--border)] overflow-hidden text-[var(--card-foreground)]'>
      <div className='p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--muted)]/30'>
        <h2 className='text-lg font-semibold text-[var(--foreground)]'>
          Age Groups List
        </h2>
        <Button
          onClick={() => handleOpenModal()}
          className='flex items-center gap-2'
        >
          <Plus size={16} /> New Age Group
        </Button>
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full text-left border-collapse'>
          <thead>
            <tr className='bg-[var(--muted)]/50 text-[var(--muted-foreground)] text-xs uppercase tracking-wider'>
              <th className='px-6 py-4 font-semibold border-b border-[var(--border)]'>
                Name
              </th>
              <th className='px-6 py-4 font-semibold border-b border-[var(--border)]'>
                Cutoff Type
              </th>
              <th className='px-6 py-4 font-semibold border-b border-[var(--border)]'>
                DOB Range
              </th>
              <th className='px-6 py-4 font-semibold border-b border-[var(--border)] text-right'>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-[var(--border)]'>
            {initialAgeGroups.map((ag) => (
              <tr
                key={ag.id}
                className='hover:bg-[var(--muted)]/30 transition-colors'
              >
                <td className='px-6 py-4'>
                  <div className='font-semibold text-[var(--foreground)]'>
                    {ag.name}
                  </div>
                </td>
                <td className='px-6 py-4'>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[0.7rem] font-bold border ${
                      ag.cutoff_type === "calendar"
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {ag.cutoff_type === "calendar" ? "Calendar (1/1-12/31)" : "Seasonal (8/1-7/31)"}
                  </span>
                </td>
                <td className='px-6 py-4'>
                  <div className='flex items-center gap-2 text-sm text-[var(--muted-foreground)]'>
                    <Calendar size={14} className='text-[var(--primary)]' />
                    {ag.dob_start
                      ? new Date(ag.dob_start).toLocaleDateString()
                      : "N/A"}
                    <span className='mx-1'>→</span>
                    {ag.dob_end
                      ? new Date(ag.dob_end).toLocaleDateString()
                      : "N/A"}
                  </div>
                </td>
                <td className='px-6 py-4 text-right'>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => handleOpenModal(ag)}
                    className='text-[var(--muted-foreground)] hover:text-[var(--primary)]'
                  >
                    <Edit2 size={18} />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => handleDelete(ag.id)}
                    className='text-[var(--muted-foreground)] hover:text-[var(--destructive)]'
                  >
                    <Trash2 size={18} />
                  </Button>
                </td>
              </tr>
            ))}
            {initialAgeGroups.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className='px-6 py-8 text-center text-[var(--muted-foreground)]'
                >
                  No age groups found. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAgeGroup ? "Edit Age Group" : "Create Age Group"}
        className='max-w-md'
      >
        <form onSubmit={handleSubmit} className='space-y-6 mt-4'>
          <div>
            <label className='block text-sm font-semibold text-[var(--foreground)] mb-1'>
              Age Group Name
            </label>
            <Input
              type='text'
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder='e.g. U12, 2014, etc.'
            />
          </div>

          <div>
            <label className='block text-sm font-semibold text-[var(--foreground)] mb-1'>
              Cutoff Type
            </label>
            <select
              value={formData.cutoff_type}
              onChange={(e) => setFormData({ ...formData, cutoff_type: e.target.value })}
              className='w-full rounded-md border border-[var(--border)] bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary'
            >
              <option value='seasonal'>Seasonal (8/1 - 7/31)</option>
              <option value='calendar'>Calendar (1/1 - 12/31)</option>
            </select>
          </div>

          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-semibold text-[var(--foreground)] mb-1'>
                DOB Start (Oldest)
              </label>
              <Input
                type='date'
                required
                value={formData.dob_start}
                onChange={(e) =>
                  setFormData({ ...formData, dob_start: e.target.value })
                }
              />
            </div>
            <div>
              <label className='block text-sm font-semibold text-[var(--foreground)] mb-1'>
                DOB End (Youngest)
              </label>
              <Input
                type='date'
                required
                value={formData.dob_end}
                onChange={(e) =>
                  setFormData({ ...formData, dob_end: e.target.value })
                }
              />
            </div>
          </div>

          <div className='flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)] mt-8'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={
                isSubmitting ||
                !formData.name ||
                !formData.dob_start ||
                !formData.dob_end
              }
            >
              {isSubmitting
                ? "Saving..."
                : editingAgeGroup
                  ? "Save Changes"
                  : "Create Age Group"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
