"use client";

import { useState, useEffect, useMemo } from "react";
import { type EntityConfig } from "@/components/entities/types";
import { toast } from "sonner";

export interface UseEntityPageOptions<T extends Record<string, unknown>> {
  config: EntityConfig;
  initialData: T[];
  onCreate: (data: Record<string, string>) => Promise<void>;
  onUpdate: (id: unknown, data: Record<string, string>) => Promise<void>;
  onDelete: (id: unknown) => Promise<void>;
}

export interface UseEntityPageReturn<T extends Record<string, unknown>> {
  // Data
  data: T[];
  filteredData: T[];

  // Filters
  globalFilter: string;
  setGlobalFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  statusOptions: string[];

  // Form modal
  showForm: boolean;
  editRecord: T | null;
  openCreate: () => void;
  openEdit: (row: T) => void;
  closeForm: () => void;

  // Delete dialog
  deleteDialogOpen: boolean;
  deleteTarget: T | null;
  deleteError: string | null;
  openDeleteDialog: (row: T) => void;
  closeDeleteDialog: () => void;

  // Sub-table (e.g. age groups) modal
  subTableTarget: T | null;
  openSubTable: (row: T) => void;
  closeSubTable: () => void;

  // Handlers
  handleCreate: (formData: Record<string, string>) => Promise<void>;
  handleUpdate: (formData: Record<string, string>) => Promise<void>;
  handleDelete: () => Promise<void>;
}

export function useEntityPage<T extends Record<string, unknown>>({
  config,
  initialData,
  onCreate,
  onUpdate,
  onDelete,
}: UseEntityPageOptions<T>): UseEntityPageReturn<T> {
  // -------------------------------------------------------------------------
  // Data — resyncs when parent refreshes initialData
  // -------------------------------------------------------------------------
  const [data, setData] = useState<T[]>(initialData);
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // -------------------------------------------------------------------------
  // Filters
  // -------------------------------------------------------------------------
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { statusCol, statusOptions } = useMemo(() => {
    const col = config.table.columns.find((c) => c.type === "badge");
    return {
      statusCol: col,
      statusOptions: col?.options ? Object.keys(col.options) : [],
    };
  }, [config.table.columns]);

  const filteredData = useMemo(() => {
    if (!statusFilter || !statusCol) return data;
    return data.filter((row) => row[statusCol.key] === statusFilter);
  }, [data, statusFilter, statusCol]);

  // -------------------------------------------------------------------------
  // Form modal
  // -------------------------------------------------------------------------
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<T | null>(null);

  const openCreate = () => {
    setEditRecord(null);
    setShowForm(true);
  };

  const openEdit = (row: T) => {
    setEditRecord(row);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditRecord(null);
  };

  // -------------------------------------------------------------------------
  // Delete dialog
  // -------------------------------------------------------------------------
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openDeleteDialog = (row: T) => {
    setDeleteTarget(row);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  // -------------------------------------------------------------------------
  // Sub-table modal (age groups, players, etc.)
  // -------------------------------------------------------------------------
  const [subTableTarget, setSubTableTarget] = useState<T | null>(null);

  const openSubTable = (row: T) => setSubTableTarget(row);
  const closeSubTable = () => setSubTableTarget(null);

  // -------------------------------------------------------------------------
  // CRUD handlers
  // -------------------------------------------------------------------------
  const handleCreate = async (formData: Record<string, string>) => {
    try {
      await onCreate(formData);
      // Defer to parent refresh via initialData — no fake id
      closeForm();
      toast.success(`${config.singular} created successfully`);
    } catch {
      toast.error(`Failed to create ${config.singular.toLowerCase()}`);
      throw; // re-throw so form can stay open if desired
    }
  };

  const handleUpdate = async (formData: Record<string, string>) => {
    if (!editRecord) return;
    const id = (editRecord as Record<string, unknown>).id;
    try {
      await onUpdate(id, formData);
      setData((prev) =>
        prev.map((row) =>
          (row as Record<string, unknown>).id === id
            ? { ...row, ...formData }
            : row,
        ),
      );
      closeForm();
      toast.success(`${config.singular} updated successfully`);
    } catch {
      toast.error(`Failed to update ${config.singular.toLowerCase()}`);
      throw;
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const id = (deleteTarget as Record<string, unknown>).id;
    setDeleteError(null);
    try {
      await onDelete(id);
      setData((prev) =>
        prev.filter((r) => (r as Record<string, unknown>).id !== id),
      );
      closeDeleteDialog();
      toast.success(`${config.singular} deleted successfully`);
    } catch {
      setDeleteError(
        `Failed to delete ${config.singular}. Please try again.`,
      );
      toast.error(`Failed to delete ${config.singular.toLowerCase()}`);
      throw;
    }
  };

  return {
    data,
    filteredData,
    globalFilter,
    setGlobalFilter,
    statusFilter,
    setStatusFilter,
    statusOptions,
    showForm,
    editRecord,
    openCreate,
    openEdit,
    closeForm,
    deleteDialogOpen,
    deleteTarget,
    deleteError,
    openDeleteDialog,
    closeDeleteDialog,
    subTableTarget,
    openSubTable,
    closeSubTable,
    handleCreate,
    handleUpdate,
    handleDelete,
  };
}