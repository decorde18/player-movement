import { getServerSession } from "next-auth/next";

import { redirect } from "next/navigation";
import { getClubs } from "@/lib/data/queries";
import { createClub } from "@/lib/actions/clubs";
import { getServerAuthSession } from "@/lib/auth";

export const metadata = {
  title: "Clubs Manager | Admin",
};

export default async function AdminClubsPage() {
  const session = await getServerAuthSession();
  if ((session?.user as any)?.role !== "system_admin") {
    redirect("/admin/teams");
  }

  const clubs = await getClubs();

  return (
    <div className='max-w-[1200px] mx-auto p-8 w-full space-y-8'>
      <div className='flex justify-between items-center'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight text-slate-900'>
            Clubs
          </h1>
          <p className='text-slate-500 mt-1'>
            Manage global clubs in the system.
          </p>
        </div>
      </div>

      <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {clubs.map((club) => (
          <div
            key={club.id}
            className='bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between'
          >
            <div>
              <h3 className='text-xl font-bold text-slate-800'>{club.name}</h3>
              <p className='text-sm text-slate-500 mt-1'>ID: {club.id}</p>
            </div>
            <div className='mt-4 pt-4 border-t border-slate-100 flex justify-between items-center'>
              <span className='text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded'>
                Active
              </span>
            </div>
          </div>
        ))}

        <div className='border-2 border-dashed border-slate-300 bg-slate-50 rounded-xl p-6 flex flex-col justify-center'>
          <form action={createClub} className='space-y-4'>
            <div>
              <label className='block text-sm font-semibold text-slate-700 mb-1'>
                Create New Club
              </label>
              <input
                type='text'
                name='name'
                placeholder='Club Name'
                required
                className='w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white outline-none focus:ring-2 focus:ring-indigo-500'
              />
            </div>
            <button
              type='submit'
              className='w-full bg-indigo-600 text-white font-semibold rounded-lg px-4 py-2 hover:bg-indigo-700 transition-colors'
            >
              Add Club
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
