import type { Metadata } from "next";
import AuthProvider from "@/components/AuthProvider";
import { getServerAuthSession } from "@/lib/auth";
import "@/styles/globals.css";
import { Inter, Poppins } from "next/font/google";
import { Toaster } from "sonner";

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
    <html lang='en'>
      <head>
        <link rel='icon' type='image/png' href='/favicon.png' />
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
