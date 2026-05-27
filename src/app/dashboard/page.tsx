import { requireServerSession } from "@/lib/authHelpers";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardPage() {
  const session = await requireServerSession();

  return (
    <div className='min-h-screen flex items-start justify-center bg-background text-text p-8'>
      <div className='w-full max-w-3xl bg-surface rounded-xl shadow-lg border border-border p-8'>
        <div className='flex items-center justify-between mb-6'>
          <div>
            <h1 className='text-2xl font-bold text-text'>
              Dashboard
            </h1>
            <p className='text-muted'>
              Welcome back
              {(session as any).user?.name
                ? `, ${(session as any).user.name}`
                : ""}
              .
            </p>
          </div>
          <div>
            <SignOutButton />
          </div>
        </div>

        <div className='space-y-4'>
          <div className='p-4 rounded-lg bg-surface border border-border'>
            Your roles:{" "}
            <pre className='mt-2 text-sm'>
              {JSON.stringify((session as any).user?.roles, null, 2)}
            </pre>
          </div>
          <div className='p-4 rounded-lg bg-surface border border-border'>
            This is a protected server-side page using{" "}
            <strong>requireServerSession()</strong>.
          </div>
        </div>
      </div>
    </div>
  );
}
