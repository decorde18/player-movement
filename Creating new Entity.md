## STEP 1 Update the Database Schema
Add your model to prisma/schema.prisma
npx prisma db push
npx prisma generate

## STEP 2 Create Zod Validations
update src/lib/validations/schemas.ts

## Step 3: Create Data Fetching Queries
update src/lib/data/queries.ts

## Step 4: Create Server Actions (Create, Update, Delete)
Create a new file in src/lib/actions/ named [entity]-actions.ts (e.g., club-actions.ts).
"use server";
import { revalidatePath } from "next/cache";
import { verifyAdmin } from "../auth/auth-utils";
import prisma from "@/lib/prisma";
import { newEntitySchema } from "../validations/schemas";

export async function createEntity(data: Record<string, string>) {
  await verifyAdmin();
  const parsedData = newEntitySchema.parse(data);
  await prisma.newEntity.create({ data: parsedData });
  revalidatePath("/new-route");
}
// Add updateEntity and deleteEntity...

## Step 5: Define the Entity Configuration (UI & Form)
Create a new file in src/lib/entities/configs/ named [entity].config.ts (e.g., club.config.ts).
import type { EntityConfig } from "@/components/entities/types";

export const newEntityConfig: EntityConfig = {
  title: "Entities",
  singular: "Entity",
  plural: "Entities",
  permissions: {
    view: ["ADMIN"], create: ["ADMIN"], edit: ["ADMIN"], delete: ["ADMIN"],
  },
  table: { columns: [ { key: "name", label: "Name", type: "text" } ] },
  form: {
    layout: "grid",
    fields: [ { key: "name", label: "Name", type: "text", required: true, gridColumn: "span-12" } ],
  },
};

## Step 6: Create the Route & Page
create new directory and page
import { EntityShell } from "@/components/entities/EntityShell";
import { newEntityConfig } from "@/lib/entities/configs/newEntity.config";
import { createEntity, updateEntity, deleteEntity } from "@/lib/actions/newEntity-actions";
import { getNewEntities } from "@/lib/data/queries";

export default async function NewEntityPage() {
  const data = await getNewEntities();
  
  const stats = [
    { label: "Total", value: data.length },
  ];

  return (
    <div className='p-6 max-w-6xl mx-auto'>
      <EntityShell
        config={newEntityConfig}
        data={data}
        stats={stats}
        onCreate={createEntity}
        onUpdate={updateEntity}
        onDelete={deleteEntity}
      />
    </div>
  );
}
