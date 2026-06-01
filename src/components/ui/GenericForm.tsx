/**
 * GenericForm Component - Uses Global Theme Variables
 *
 * @example
 * <GenericForm
 *   config={entityConfig}
 *   initialData={editingData}
 *   onSubmit={async (data) => { await saveData(data) }}
 *   onCancel={() => setShowForm(false)}
 * />
 */

"use client";

import { useState, useEffect } from "react";
import { type FormField, type EntityConfig } from "@/components/entities/types";
import { X } from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

interface GenericFormProps<T extends Record<string, unknown>> {
  config: EntityConfig;
  initialData?: T | null;
  onSubmit: (data: Record<string, string | number | null>) => Promise<void>;
  onCancel: () => void;
}

export function GenericForm<T extends Record<string, unknown>>({
  config,
  initialData,
  onSubmit,
  onCancel,
}: GenericFormProps<T>) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [dynamicOptions, setDynamicOptions] = useState<
    Record<string, { label: string; value: string }[]>
  >({});

  useEffect(() => {
    if (initialData) {
      const mapped: Record<string, string> = {};
      config.form.fields.forEach((f) => {
        const raw = initialData[f.key];

        if (f.type === "select" && f.options?.length) {
          const strVal = String(raw ?? "");
          // Check if it's already a valid value
          const byValue = f.options.find((o) => String(o.value) === strVal);
          if (byValue) {
            mapped[f.key] = String(byValue.value);
          } else {
            // It's a label (e.g. "Tennessee State Soccer Association") — find the matching value
            const byLabel = f.options.find((o) => o.label === strVal);
            mapped[f.key] = byLabel ? String(byLabel.value) : "";
          }
        } else {
          mapped[f.key] = String(raw ?? "");
        }
      });
      setValues(mapped);
    } else {
      const defaults: Record<string, string> = {};
      config.form.fields.forEach((f) => {
        defaults[f.key] =
          f.type === "select" && f.options?.length
            ? String(f.options[0].value)
            : "";
      });
      setValues(defaults);
    }
    setErrors({});
  }, [initialData, config]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    config.form.fields.forEach((f) => {
      if (f.required && !values[f.key]?.trim()) {
        newErrors[f.key] = `${f.label} is required`;
      }
      const rule = config.form.validationRules?.[f.key];
      if (rule && values[f.key]) {
        const msg = rule(values[f.key]);
        if (msg) newErrors[f.key] = msg;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload: Record<string, string | number | null> = {};
      config.form.fields.forEach((f) => {
        const submitKey = f.valueKey ?? f.key;
        const raw = values[f.key] ?? "";
        if (f.type === "number") {
          payload[submitKey] = raw === "" ? null : Number(raw);
        } else {
          payload[submitKey] = raw;
        }
      });
      await onSubmit(payload as any);
    } finally {
      setLoading(false);
    }
  };

  const isEditing = !!initialData;

  const getColSpanClass = (span?: string) => {
    switch (span) {
      case "span-1":
        return "col-span-1";
      case "span-2":
        return "col-span-2";
      case "span-3":
        return "col-span-3";
      case "span-4":
        return "col-span-4";
      case "span-5":
        return "col-span-5";
      case "span-6":
        return "col-span-6";
      case "span-7":
        return "col-span-7";
      case "span-8":
        return "col-span-8";
      case "span-9":
        return "col-span-9";
      case "span-10":
        return "col-span-10";
      case "span-11":
        return "col-span-11";
      case "span-12":
        return "col-span-12";
      case "col-span-1":
        return "col-span-1";
      case "col-span-2":
        return "col-span-2";
      case "col-span-3":
        return "col-span-3";
      case "col-span-4":
        return "col-span-4";
      case "col-span-5":
        return "col-span-5";
      case "col-span-6":
        return "col-span-6";
      case "col-span-7":
        return "col-span-7";
      case "col-span-8":
        return "col-span-8";
      case "col-span-9":
        return "col-span-9";
      case "col-span-10":
        return "col-span-10";
      case "col-span-11":
        return "col-span-11";
      case "col-span-12":
        return "col-span-12";
      default:
        return "col-span-12";
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title={isEditing ? `Edit ${config.singular}` : `Add ${config.singular}`}
      size='md'
      footer={
        <>
          <Button
            variant='outline'
            onClick={onCancel}
            className='font-normal flex-row px-4 py-2'
            size='md'
          >
            Cancel
          </Button>
          <Button
            variant='primary'
            onClick={handleSubmit}
            disabled={loading}
            className='font-medium flex-row px-4 py-2'
            size='md'
          >
            {loading ? "Saving..." : `Save ${config.singular}`}
          </Button>
        </>
      }
    >
      <div className='grid grid-cols-12 gap-4 pt-2'>
        {config.form.fields.map((field) => (
          <div key={field.key} className={getColSpanClass(field.gridColumn)}>
            <FieldInput
              field={{
                ...field,
                options: field.options
                  ? [...field.options, ...(dynamicOptions[field.key] || [])]
                  : undefined,
              }}
              value={values[field.key] ?? ""}
              error={errors[field.key]}
              onChange={(val) => {
                setValues((prev) => ({ ...prev, [field.key]: val }));
                if (errors[field.key])
                  setErrors((prev) => ({ ...prev, [field.key]: "" }));
              }}
              onAddOption={(val, label) => {
                setDynamicOptions((prev) => ({
                  ...prev,
                  [field.key]: [
                    ...(prev[field.key] || []),
                    { value: val, label: label },
                  ],
                }));
              }}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}

function FieldInput({
  field,
  value,
  error,
  onChange,
  onAddOption,
}: {
  field: FormField;
  value: string;
  error?: string;
  onChange: (val: string) => void;
  onAddOption?: (val: string, label: string) => void;
}) {
  const [isCustom, setIsCustom] = useState(false);
  const [showNestedForm, setShowNestedForm] = useState(false);
  const isCheckboxOrToggle =
    field.type === "checkbox" || field.type === "toggle";

  return (
    <div className='flex flex-col gap-1.5'>
      {!isCheckboxOrToggle && (
        <label className='text-sm font-medium text-text'>
          {field.label}
          {field.required && <span className='text-danger ml-1'>*</span>}
        </label>
      )}

      {isCheckboxOrToggle ? (
        <div className='flex items-center gap-3 pt-1 pb-2'>
          {field.type === "toggle" ? (
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                className='sr-only peer'
                checked={value === "true"}
                onChange={(e) => onChange(e.target.checked ? "true" : "false")}
              />
              <div className="w-11 h-6 bg-border peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          ) : (
            <input
              type='checkbox'
              checked={value === "true"}
              onChange={(e) => onChange(e.target.checked ? "true" : "false")}
              className='w-4 h-4 text-primary bg-surface border-border rounded focus:ring-primary/20 focus:ring-2 cursor-pointer'
            />
          )}
          <span
            className='text-sm font-medium text-text cursor-pointer select-none'
            onClick={() => onChange(value === "true" ? "false" : "true")}
          >
            {field.label}
            {field.required && <span className='text-danger ml-1'>*</span>}
          </span>
        </div>
      ) : field.type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={`w-full px-4 py-2 text-sm border rounded-xl bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none ${error ? "border-danger focus:ring-danger/20" : "border-border"}`}
        />
      ) : field.type === "select" && field.options ? (
        <div className='flex items-center gap-2'>
          {isCustom ? (
            <Input
              type='text'
              value={value}
              onChange={(e: any) => onChange(e.target.value)}
              placeholder={`New ${field.label}...`}
              error={!!error}
              className='w-full !mb-0 flex-1'
            />
          ) : (
            <div className='flex-1'>
              <Select
                value={value}
                onChange={(e: any) => {
                  if (e.target.value === "__CREATE_NEW__") {
                    if (field.creatableConfig && field.onCreatableSubmit) {
                      setShowNestedForm(true);
                      onChange("");
                    } else {
                      setIsCustom(true);
                      onChange("");
                    }
                  } else {
                    onChange(e.target.value);
                  }
                }}
                options={
                  field.creatable
                    ? [
                        ...field.options,
                        { label: "+ Create New", value: "__CREATE_NEW__" },
                      ]
                    : field.options
                }
                error={!!error}
                width='full'
                showPlaceholder={!!field.placeholder}
                placeholder={field.placeholder}
              />
            </div>
          )}
          {isCustom && (
            <Button
              variant='outline'
              type='button'
              onClick={() => {
                setIsCustom(false);
                onChange("");
              }}
              className='px-2 h-10 border-border'
              title='Cancel'
            >
              <X size={16} />
            </Button>
          )}
          {showNestedForm &&
            field.creatableConfig &&
            field.onCreatableSubmit && (
              <GenericForm
                config={field.creatableConfig}
                onSubmit={async (data) => {
                  try {
                    const res = await field.onCreatableSubmit!(data);
                    const newVal =
                      res?.value ||
                      data.name ||
                      data[field.creatableConfig!.form.fields[0].key];
                    const newLabel = res?.label || newVal;
                    if (onAddOption) onAddOption(newVal, newLabel);
                    onChange(newVal);
                    setShowNestedForm(false);
                  } catch (err) {
                    console.error("Failed to create nested entity:", err);
                  }
                }}
                onCancel={() => setShowNestedForm(false)}
              />
            )}
        </div>
      ) : (
        <Input
          type={
            field.type === "date"
              ? "date"
              : field.type === "number"
                ? "number"
                : "text"
          }
          value={value}
          onChange={(e: any) => onChange(e.target.value)}
          placeholder={field.placeholder}
          error={!!error}
          className='w-full !mb-0'
        />
      )}
      {error && <p className='text-xs text-danger font-medium mt-1'>{error}</p>}
    </div>
  );
}
