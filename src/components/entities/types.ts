import { Role } from "@/lib/roles";

export type { Role };

export type FieldType =
  | "text"
  | "date"
  | "textarea"
  | "select"
  | "number"
  | "checkbox"
  | "toggle";
export type ColumnType =
  | "text"
  | "date"
  | "badge"
  | "number"
  | "action"
  | "boolean";

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  gridColumn?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  creatable?: boolean;
  creatableConfig?: EntityConfig;
  valueKey?: string; // the DB key to submit under (e.g. "governingBodyId")
  onCreatableSubmit?: (data: Record<string, any>) => Promise<any>;
}

export interface TableColumn {
  key: string;
  label: string;
  type: ColumnType;
  sortable?: boolean;
  options?: Record<string, "green" | "amber" | "red" | "gray" | "blue">;
  hiddenOnMobile?: boolean;
}

export interface EntityConfig {
  title: string;
  singular: string;
  plural?: string;
  permissions: {
    view: Role[];
    create: Role[];
    edit: Role[];
    delete: Role[];
  };
  table: {
    columns: TableColumn[];
  };
  form: {
    layout?: "grid" | "vertical";
    fields: FormField[];
    validationRules?: Record<string, (val: string) => string | null>;
  };
}
