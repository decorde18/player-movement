import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/login");
  }

  // Redirect authenticated user to admin desktop / events workspace
  redirect("/admin/events");
}