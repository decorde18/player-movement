import { Suspense } from "react";

// import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import NavBar from "@/components/layout/NavBar";
import HeaderSkeleton from "@/components/layout/HeaderSkeleton";
import NavBarSkeleton from "@/components/layout/NavBarSkeleton";
import { getServerAuthSession } from "@/lib/auth";
// import { SessionProvider } from "@/contexts/SessionProvider";

export default async function MainAppLayout({ children }) {
  const session = await getServerAuthSession();
  const user = session?.user;

  return (
    <div className='layout'>
      <div className='main-body'>
        <Suspense fallback={<NavBarSkeleton />}>
          <NavBar user={user} />
        </Suspense>
        <div className='main-content'>
          <Suspense fallback={<HeaderSkeleton />}>
            <Header user={user} />
          </Suspense>
          <div className='p-6 max-w-6xl mx-auto'>{children}</div>
        </div>
      </div>
      {/* <Footer /> */}
    </div>
  );
}
