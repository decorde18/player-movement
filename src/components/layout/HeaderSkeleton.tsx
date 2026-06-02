// components/layout/HeaderSkeleton.jsx
function HeaderSkeleton() {
  return (
    <header className='bg-surface border-b border-border sticky top-0 z-50 shadow-sm'>
      <div className='flex items-center justify-between gap-2 px-3 sm:px-4 md:px-6 h-16 py-2'>
        {/* Left - Date skeleton */}
        <div className='hidden xl:block w-48 h-5 bg-border/30 rounded animate-pulse' />

        {/* Center - Team Selector skeleton */}
        <div className='flex-1 flex justify-center'>
          <div className='w-full max-w-[60%] h-10 bg-border/30 rounded-lg animate-pulse' />
        </div>

        {/* Right - User menu skeleton */}
        <div className='flex items-center gap-3'>
          <div className='w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 animate-pulse' />
          <div className='hidden sm:flex flex-col gap-2'>
            <div className='w-24 h-4 bg-border/30 rounded animate-pulse' />
            <div className='w-16 h-3 bg-border/30 rounded animate-pulse' />
          </div>
        </div>
      </div>
    </header>
  );
}

export default HeaderSkeleton;
