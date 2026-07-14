import { Children, Suspense, type ReactNode } from "react";

import Header from "@/components/layout/Header";
import HeaderSkeleton from "@/components/layout/HeaderSkeleton";

import { getServerAuthSession } from "@/lib/auth";

export default async function MainAppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await getServerAuthSession();
  const user = session?.user;
  const columns = Children.toArray(children);
  const [firstColumn, ...otherColumns] = columns;

  return (
    <div className='layout'>
      <div className='main-body'>
        <div className='main-content'>
          <Suspense fallback={<HeaderSkeleton />}>
            <Header user={user} />
          </Suspense>
          <div className='p-6 w-full max-w-[1600px] mx-auto min-h-0'>
            <div className='player-board-columns'>
              <div className='player-board-fixed-col'>{firstColumn}</div>
              <div className='player-board-scroll-area'>
                <div className='player-board-scroll-columns'>
                  {otherColumns}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
