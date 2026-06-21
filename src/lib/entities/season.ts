// config/seasons.config.ts
import type { EntityConfig } from "@/components/entities/types";

export const seasonConfig: EntityConfig = {
  title: "Seasons",
  singular: "Season",
  plural: "Seasons",

  permissions: {
    view: ["SYSTEM_ADMIN", "CLUB_ADMIN", "AGE_GROUP_ADMIN", "COACH"],
    create: ["SYSTEM_ADMIN", "CLUB_ADMIN", "AGE_GROUP_ADMIN", "COACH"],
    edit: ["SYSTEM_ADMIN", "CLUB_ADMIN", "AGE_GROUP_ADMIN", "COACH"],
    delete: ["SYSTEM_ADMIN"],
  },

  table: {
    columns: [
      {
        key: "name",
        label: "Season Name",
        type: "text",
        sortable: true,
      },
      {
        key: "start_date",
        label: "Start Date",
        type: "date",
        sortable: true,
        hiddenOnMobile: true,
      },
      {
        key: "end_date",
        label: "End Date",
        type: "date",
        sortable: true,
        hiddenOnMobile: true,
      },
      {key:'age_groups',}
    ],
  },

  form: {
    layout: "grid",
    fields: [
      {
        key: "name",
        label: "Season Name",
        type: "text",
        required: true,
        placeholder: "e.g. 2012-2013",
        gridColumn: "span-10",
      },
      {
        key: "start_date",
        label: "Start Date",
        type: "date",
        required: true,
        placeholder: "e.g. PL",
        gridColumn: "span-6",
      },
      {
        key: "end_date",
        label: "End Date",
        type: "date",
        required: true,
        placeholder: "e.g. PL",
        gridColumn: "span-6",
      },
    ],
  },
};
