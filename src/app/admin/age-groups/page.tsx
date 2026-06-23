import { getAgeGroups } from "@/lib/data/queries";
import AgeGroupsManager from "./AgeGroupsManager";

export const metadata = {
  title: "Manage Age Groups | Admin",
};

export default async function AdminAgeGroupsPage() {
  const ageGroups = await getAgeGroups();

  return (
    <div className='max-w-[1200px] mx-auto p-8 w-full space-y-8'>
      <div className='flex justify-between items-center'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight text-slate-900'>
            Age Groups
          </h1>
          <p className='text-slate-500 mt-1'>
            Manage global age groups and their birth year ranges.
          </p>
        </div>
      </div>

      <AgeGroupsManager initialAgeGroups={ageGroups} />
    </div>
  );
}
