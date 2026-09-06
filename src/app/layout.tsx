import type { Metadata } from "next";
import "@/styles/globals.css";
import { Inter, Poppins } from "next/font/google";
import { getServerAuthSession } from "@/lib/auth";

import { Toaster } from "sonner";
import AuthProvider from "@/components/AuthProvider";

export const metadata = {
  title: "Player Movement App",
  description: "Ranking/Rating Players",
};

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerAuthSession();

  return (
    <html lang='en' suppressHydrationWarning>

      <head>
        <link rel='icon' type='image/png' href='/favicon.png' />
        <script
          dangerouslySetInnerHTML={{
            __html: `if(typeof window!=='undefined'&&(window.self!==window.top||window.location.search.indexOf('embedded=true')!==-1)){document.documentElement.classList.add('is-embedded');}`,
          }}
        />
      </head>

      <body className={`${inter.variable} ${poppins.variable}`}>
        <AuthProvider session={session}>
          {children}
          <Toaster richColors closeButton position='top-right' />
        </AuthProvider>
      </body>
    </html>
  );
}
