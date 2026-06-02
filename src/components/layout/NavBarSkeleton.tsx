// components/layout/NavBarSkeleton.jsx
function NavBarSkeleton() {
  return (
    <aside className='hidden lg:block relative w-[280px] bg-gradient-to-br from-primary to-secondary text-white'>
      <div className='flex flex-col h-full'>
        {/* Header */}
        <div className='flex-shrink-0 p-6 border-b border-white/10'>
          <div className='w-32 h-7 bg-white/20 rounded mb-2 animate-pulse' />
          <div className='w-24 h-3 bg-white/10 rounded animate-pulse' />
        </div>

        {/* Navigation Items */}
        <nav className='flex-1 overflow-y-auto p-4 space-y-6'>
          {[1, 2, 3].map((section) => (
            <div key={section}>
              <div className='w-20 h-3 bg-white/10 rounded mb-3 px-4 animate-pulse' />
              <div className='space-y-2'>
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className='h-10 bg-white/5 rounded-lg animate-pulse'
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className='flex-shrink-0 p-4 border-t border-white/10 space-y-2'>
          <div className='h-10 bg-white/5 rounded-lg animate-pulse' />
          <div className='h-10 bg-white/5 rounded-lg animate-pulse' />
        </div>
      </div>
    </aside>
  );
}

export default NavBarSkeleton;
