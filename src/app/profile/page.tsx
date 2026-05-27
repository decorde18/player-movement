"use client";

import useRequireAuth from "@/hooks/useRequireAuth";
import SignOutButton from "@/components/SignOutButton";

export default function ProfilePage() {
  const { session, status } = useRequireAuth();

  if (status === "loading") return <div className='p-8'>Loading...</div>;

  return (
    <div className='min-h-screen flex items-start justify-center bg-slate-50 dark:bg-slate-900 p-8'>
      <div className='w-full max-w-3xl bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 p-8'>
        <div className='flex items-center justify-between mb-6'>
          <div>
            <h1 className='text-2xl font-bold text-slate-900 dark:text-white'>
              Profile
            </h1>
            <p className='text-slate-500 dark:text-slate-400'>
              Client-side guarded page using <strong>useRequireAuth()</strong>.
            </p>
          </div>
          <div>
            <SignOutButton />
          </div>
        </div>

        <div className='space-y-4'>
          <div className='p-4 rounded-lg bg-surface border border-border'>
            Session:{" "}
            <pre className='mt-2 text-sm'>
              {JSON.stringify(session, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
