"use client";

import React, { useState, useTransition } from "react";
import Button from "../ui/Button";
import Input from "../ui/Input";
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  X,
  Loader2,
  Calendar,
  AlertCircle,
  HelpCircle,
  CornerDownRight,
  ArrowLeft,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import CSVImporter from "./CSVImporter";

export interface ColumnConfig {
  key: string;
  label: string;
  type: "text" | "date" | "select" | "custom";
  options?: { value: any; label: string }[]; // For select type
  required?: boolean;
  render?: (item: any) => React.ReactNode;
}

export interface SubtableConfig {
  title: string;
  relationKey: string;
  parentForeignKey: string;
  columns: ColumnConfig[];
  onSave: (childItem: any, parentId: any) => Promise<{ success: boolean; error?: string }>;
  onDelete: (childId: any) => Promise<{ success: boolean; error?: string }>;
}

interface CrudDashboardProps {
  title: string;
  icon: React.ReactNode;
  description?: string;
  items: any[];
  columns: ColumnConfig[];
  onSave: (item: any) => Promise<{ success: boolean; error?: string }>;
  onDelete: (id: any) => Promise<{ success: boolean; error?: string }>;
  subtables?: SubtableConfig[];
  searchPlaceholder?: string;
  csvImportConfig?: {
    clubs: { id: number; name: string }[];
    seasonAgeGroups: any[];
    defaultClubId?: number;
    onImportSuccess: () => void;
  };
  // Hook for adding extra fields dynamically (e.g. Season cloning options)
  extraAddFields?: (
    formState: any,
    setFormState: React.Dispatch<React.SetStateAction<any>>
  ) => React.ReactNode;
}

export default function CrudDashboard({
  title,
  icon,
  description,
  items = [],
  columns = [],
  onSave,
  onDelete,
  subtables = [],
  searchPlaceholder = "Search records...",
  csvImportConfig,
  extraAddFields,
}: CrudDashboardProps) {
  const [activeTab, setActiveTab] = useState<"registry" | "form" | "import">("registry");
  const [editingItem, setEditingItem] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();

  // Unified Form State for parent record
  const [formState, setFormState] = useState<Record<string, any>>({});

  // Subtable Form States: Record<subtableTitle, Record<fieldKey, value>>
  const [subtableFormStates, setSubtableFormStates] = useState<Record<string, Record<string, any>>>({});

  const startCreate = () => {
    const initialState: Record<string, any> = {};
    columns.forEach((c) => {
      initialState[c.key] = c.type === "select" && c.options?.[0] ? c.options[0].value : "";
    });
    setFormState(initialState);
    setEditingItem(null);
    setActiveTab("form");
  };

  const startEdit = (item: any) => {
    const state: Record<string, any> = {};
    columns.forEach((c) => {
      // Format date objects or ISO strings for input[type="date"]
      if (c.type === "date" && item[c.key]) {
        state[c.key] = new Date(item[c.key]).toISOString().split("T")[0];
      } else {
        state[c.key] = item[c.key] ?? "";
      }
    });
    setFormState(state);
    setEditingItem(item);
    setActiveTab("form");

    // Initialize subtable form states
    const subStates: Record<string, Record<string, any>> = {};
    subtables.forEach((sub) => {
      const subInitial: Record<string, any> = {};
      sub.columns.forEach((c) => {
        subInitial[c.key] = c.type === "select" && c.options?.[0] ? c.options[0].value : "";
      });
      subStates[sub.title] = subInitial;
    });
    setSubtableFormStates(subStates);
  };

  const handleFieldChange = (key: string, val: any) => {
    setFormState((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubtableFieldChange = (subTitle: string, key: string, val: any) => {
    setSubtableFormStates((prev) => ({
      ...prev,
      [subTitle]: {
        ...(prev[subTitle] || {}),
        [key]: val,
      },
    }));
  };

  const handleParentSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic Validation
    const missingField = columns.find((c) => c.required && !formState[c.key]);
    if (missingField) {
      toast.error(`${missingField.label} is required.`);
      return;
    }

    startTransition(async () => {
      const payload = editingItem ? { id: editingItem.id, ...formState } : formState;
      const res = await onSave(payload);

      if (res.success) {
        toast.success(editingItem ? "Record updated successfully." : "Record created successfully.");
        setActiveTab("registry");
        setEditingItem(null);
        setFormState({});
      } else {
        toast.error(res.error || "Failed to save record.");
      }
    });
  };

  const handleParentDelete = async (id: any, label: string) => {
    if (!confirm(`Are you sure you want to delete "${label}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await onDelete(id);
      if (res.success) {
        toast.success(`Deleted: ${label}`);
      } else {
        toast.error(res.error || "Failed to delete record.");
      }
    } catch (e: any) {
      toast.error("Delete failed: " + e.message);
    }
  };

  const handleSubtableSave = async (e: React.FormEvent, sub: SubtableConfig) => {
    e.preventDefault();
    if (!editingItem) return;

    const childForm = subtableFormStates[sub.title] || {};

    // Validate
    const missingField = sub.columns.find((c) => c.required && !childForm[c.key]);
    if (missingField) {
      toast.error(`Subtable Field "${missingField.label}" is required.`);
      return;
    }

    startTransition(async () => {
      const res = await sub.onSave(childForm, editingItem.id);
      if (res.success) {
        toast.success("Child record added.");
        // Reset subtable form input
        const subInitial: Record<string, any> = {};
        sub.columns.forEach((c) => {
          subInitial[c.key] = c.type === "select" && c.options?.[0] ? c.options[0].value : "";
        });
        setSubtableFormStates((prev) => ({
          ...prev,
          [sub.title]: subInitial,
        }));
        // Reload parent edit view to reflect new subtable records
        const freshParent = items.find((item) => item.id === editingItem.id);
        if (freshParent) {
          setEditingItem(freshParent);
        }
      } else {
        toast.error(res.error || "Failed to save child record.");
      }
    });
  };

  const handleSubtableDelete = async (sub: SubtableConfig, childId: any) => {
    if (!confirm("Are you sure you want to delete this sub-record?")) return;

    try {
      const res = await sub.onDelete(childId);
      if (res.success) {
        toast.success("Child record deleted.");
        const freshParent = items.find((item) => item.id === editingItem.id);
        if (freshParent) {
          setEditingItem(freshParent);
        }
      } else {
        toast.error(res.error || "Failed to delete sub-record.");
      }
    } catch (e: any) {
      toast.error("Delete failed: " + e.message);
    }
  };

  // Searching main items
  const filteredItems = items.filter((item) => {
    if (!searchTerm) return true;
    return columns.some((col) => {
      const val = item[col.key];
      if (val === undefined || val === null) return false;
      return val.toString().toLowerCase().includes(searchTerm.toLowerCase());
    });
  });

  return (
    <div className='min-h-screen bg-background text-text p-4 md:p-8 animate-fadeIn'>
      <div className='max-w-7xl mx-auto space-y-6'>
        {/* TOP COMMAND PANEL */}
        <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/80 border border-border p-6 rounded-2xl shadow-sm backdrop-blur-md'>
          <div>
            <h1 className='text-3xl font-bold flex items-center gap-2 mb-1'>
              {icon}
              {title}
            </h1>
            {description && <p className='text-xs text-muted font-medium'>{description}</p>}
          </div>

          <div className='flex items-center gap-2.5 bg-background p-1.5 rounded-xl border border-border self-start md:self-center'>
            <button
              onClick={() => {
                setActiveTab("registry");
                setEditingItem(null);
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                activeTab === "registry"
                  ? "bg-surface text-primary shadow-sm border border-border"
                  : "text-muted hover:text-text"
              }`}
            >
              Registry List
            </button>
            <button
              onClick={startCreate}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                activeTab === "form" && !editingItem
                  ? "bg-surface text-primary shadow-sm border border-border"
                  : "text-muted hover:text-text"
              }`}
            >
              <Plus size={14} /> Add New
            </button>
            {csvImportConfig && (
              <button
                onClick={() => setActiveTab("import")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                  activeTab === "import"
                    ? "bg-surface text-primary shadow-sm border border-border"
                    : "text-muted hover:text-text"
                }`}
              >
                <FileSpreadsheet size={14} /> CSV Import
              </button>
            )}
          </div>
        </div>

        {/* WORKSPACE VIEWPORTS */}
        <div className='min-h-[500px]'>
          {/* VIEWPORT 1: REGISTRY GRID LIST */}
          {activeTab === "registry" && (
            <div className='space-y-4 animate-fadeIn'>
              {/* Search Header */}
              <div className='flex items-center bg-surface px-4 py-3 rounded-xl border border-border shadow-sm max-w-md'>
                <Search size={18} className='text-muted mr-3' />
                <input
                  type='text'
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='text-sm bg-transparent border-none outline-none w-full focus:ring-0'
                />
              </div>

              {/* Data Table */}
              <div className='bg-surface border border-border rounded-2xl shadow-sm overflow-hidden'>
                <div className='overflow-x-auto'>
                  <table className='w-full text-left text-sm border-collapse'>
                    <thead className='bg-background text-text-label font-bold border-b border-border text-xs'>
                      <tr>
                        {columns.map((c) => (
                          <th key={c.key} className='p-4'>
                            {c.label}
                          </th>
                        ))}
                        <th className='p-4 text-right'>Actions</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-border bg-surface'>
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={columns.length + 1} className='p-8 text-center text-muted font-bold'>
                            No records found.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item: any) => (
                          <tr key={item.id} className='hover:bg-background/20 transition-all group'>
                            {columns.map((col) => (
                              <td key={col.key} className='p-4 font-semibold text-text'>
                                {col.render ? (
                                  col.render(item)
                                ) : col.type === "date" && item[col.key] ? (
                                  <span className='flex items-center gap-1.5 text-xs text-muted'>
                                    <Calendar size={14} />
                                    {new Date(item[col.key]).toLocaleDateString()}
                                  </span>
                                ) : (
                                  item[col.key] ?? <span className='text-muted/40 italic'>N/A</span>
                                )}
                              </td>
                            ))}
                            <td className='p-4 text-right flex justify-end gap-1.5'>
                              <button
                                onClick={() => startEdit(item)}
                                className='p-2 rounded-lg text-muted/60 hover:text-primary hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer'
                                title='Edit Record'
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                onClick={() =>
                                  handleParentDelete(
                                    item.id,
                                    item.name || `${item.first_name || ""} ${item.last_name || ""}`.trim() || `ID: ${item.id}`
                                  )
                                }
                                className='p-2 rounded-lg text-muted/60 hover:text-danger hover:bg-danger/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer'
                                title='Delete Record'
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className='p-4 bg-background/50 border-t border-border text-xs text-muted font-semibold'>
                  Showing {filteredItems.length} of {items.length} records
                </div>
              </div>
            </div>
          )}

          {/* VIEWPORT 2: CREATE & EDIT FORM VIEW */}
          {activeTab === "form" && (
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-fadeIn'>
              {/* PRIMARY EDIT DETAILS (Left 1 or 2 Columns) */}
              <div className={`lg:col-span-${subtables.length > 0 ? "1" : "3"} bg-surface border border-border p-6 rounded-2xl shadow-sm`}>
                <h2 className='text-lg font-bold mb-4 border-b border-border pb-3 text-text flex items-center gap-2'>
                  {editingItem ? <Edit2 size={18} className='text-primary' /> : <Plus size={18} className='text-primary' />}
                  {editingItem ? "Edit Record Details" : "Create New Record"}
                </h2>

                <form onSubmit={handleParentSave} className='space-y-4'>
                  {columns.map((col) => {
                    if (col.type === "select") {
                      return (
                        <div key={col.key}>
                          <label className='block text-xs font-bold text-text-label mb-1'>
                            {col.label} {col.required && "*"}
                          </label>
                          <select
                            value={formState[col.key] || ""}
                            onChange={(e) => handleFieldChange(col.key, e.target.value)}
                            className='text-sm bg-surface font-semibold py-2 px-3 border border-border rounded-md w-full focus:outline-none focus:ring-1 focus:ring-primary'
                            required={col.required}
                          >
                            <option value=''>-- Select Option --</option>
                            {col.options?.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    }

                    if (col.type === "custom") {
                      return null; // Skip rendering here, handled by custom injection
                    }

                    return (
                      <Input
                        key={col.key}
                        label={col.label + (col.required ? " *" : "")}
                        type={col.type === "date" ? "date" : "text"}
                        value={formState[col.key] || ""}
                        onChange={(e: any) => handleFieldChange(col.key, e.target.value)}
                        required={col.required}
                        placeholder={`Enter ${col.label.toLowerCase()}`}
                      />
                    );
                  })}

                  {/* Inject dynamic extra forms if custom hook provided */}
                  {extraAddFields && !editingItem && extraAddFields(formState, setFormState)}

                  <div className='flex justify-end gap-3 border-t border-border pt-4 mt-6'>
                    <Button
                      variant='outline'
                      type='button'
                      onClick={() => {
                        setActiveTab("registry");
                        setEditingItem(null);
                      }}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                    <Button type='submit' disabled={isPending}>
                      {isPending ? (
                        <span className='flex items-center gap-1'>
                          <Loader2 className='animate-spin' size={14} /> Saving...
                        </span>
                      ) : (
                        "Save Record"
                      )}
                    </Button>
                  </div>
                </form>
              </div>

              {/* NESTED SUBTABLES (Right Column, only displayed when editing) */}
              {subtables.length > 0 && (
                <div className='lg:col-span-2 space-y-6'>
                  {!editingItem ? (
                    <div className='p-8 bg-background border border-border border-dashed rounded-2xl flex flex-col items-center justify-center text-center text-muted'>
                      <AlertCircle size={28} className='text-muted/40 mb-2' />
                      <span className='text-xs font-bold'>Save the record details first to configure nested subtables.</span>
                    </div>
                  ) : (
                    subtables.map((sub) => {
                      const childList = editingItem[sub.relationKey] || [];
                      const childForm = subtableFormStates[sub.title] || {};

                      return (
                        <div key={sub.title} className='bg-surface border border-border p-6 rounded-2xl shadow-sm space-y-4 animate-fadeIn'>
                          <h3 className='text-md font-bold text-text-label flex items-center gap-2 border-b border-border pb-2.5'>
                            <CornerDownRight size={18} className='text-primary' />
                            Configure {sub.title}
                          </h3>

                          {/* Subtable Rows */}
                          <div className='border border-border rounded-xl overflow-hidden bg-background/30'>
                            <table className='w-full text-left text-xs border-collapse'>
                              <thead className='bg-background text-text-label font-bold border-b border-border'>
                                <tr>
                                  {sub.columns.map((c) => (
                                    <th key={c.key} className='p-2.5'>
                                      {c.label}
                                    </th>
                                  ))}
                                  <th className='p-2.5 text-right'>Action</th>
                                </tr>
                              </thead>
                              <tbody className='divide-y divide-border bg-surface'>
                                {childList.length === 0 ? (
                                  <tr>
                                    <td colSpan={sub.columns.length + 1} className='p-4 text-center text-muted/60 italic'>
                                      No sub-records registered yet.
                                    </td>
                                  </tr>
                                ) : (
                                  childList.map((child: any) => (
                                    <tr key={child.id} className='hover:bg-background/20 transition-all'>
                                      {sub.columns.map((col) => (
                                        <td key={col.key} className='p-2.5 font-semibold text-text'>
                                          {col.render ? (
                                            col.render(child)
                                          ) : col.type === "select" ? (
                                            col.options?.find((opt) => opt.value === child[col.key])?.label || child[col.key]
                                          ) : (
                                            child[col.key]
                                          )}
                                        </td>
                                      ))}
                                      <td className='p-2.5 text-right'>
                                        <button
                                          type='button'
                                          onClick={() => handleSubtableDelete(sub, child.id)}
                                          className='p-1 rounded text-muted hover:text-danger hover:bg-danger/10 transition-all cursor-pointer'
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Inline Add Child Form */}
                          <form
                            onSubmit={(e) => handleSubtableSave(e, sub)}
                            className='bg-background/50 border border-border p-4 rounded-xl space-y-3'
                          >
                            <h4 className='text-xs font-bold text-text'>Add New {sub.title} record</h4>
                            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                              {sub.columns.map((col) => {
                                if (col.type === "select") {
                                  return (
                                    <div key={col.key}>
                                      <label className='block text-[0.65rem] font-bold text-text-label mb-1'>
                                        {col.label} {col.required && "*"}
                                      </label>
                                      <select
                                        value={childForm[col.key] || ""}
                                        onChange={(e) => handleSubtableFieldChange(sub.title, col.key, e.target.value)}
                                        className='text-xs bg-surface font-semibold py-1.5 px-2 border border-border rounded w-full'
                                        required={col.required}
                                      >
                                        <option value=''>-- Select Option --</option>
                                        {col.options?.map((opt) => (
                                          <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  );
                                }

                                return (
                                  <Input
                                    key={col.key}
                                    label={col.label + (col.required ? " *" : "")}
                                    type={col.type === "date" ? "date" : "text"}
                                    value={childForm[col.key] || ""}
                                    onChange={(e: any) => handleSubtableFieldChange(sub.title, col.key, e.target.value)}
                                    required={col.required}
                                    size='sm'
                                  />
                                );
                              })}
                            </div>

                            <div className='flex justify-end pt-1 border-t border-border/60 mt-2'>
                              <Button type='submit' disabled={isPending} size='xs' className='flex items-center gap-1.5'>
                                {isPending ? <Loader2 className='animate-spin' size={12} /> : <Plus size={12} />}
                                Add to {sub.title}
                              </Button>
                            </div>
                          </form>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* VIEWPORT 3: CSV IMPORT */}
          {activeTab === "import" && csvImportConfig && (
            <div className='max-w-4xl mx-auto'>
              <div className='mb-4'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setActiveTab("registry")}
                  className='flex items-center gap-1'
                >
                  <ArrowLeft size={16} /> Return to List
                </Button>
              </div>
              <CSVImporter
                clubs={csvImportConfig.clubs}
                seasonAgeGroups={csvImportConfig.seasonAgeGroups}
                defaultClubId={csvImportConfig.defaultClubId}
                onImportSuccess={csvImportConfig.onImportSuccess}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
