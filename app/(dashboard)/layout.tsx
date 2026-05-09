import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import ProfileSync from "@/components/ProfileSync";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  let role: string | null = null;
  if (userId) {
    const service = createServiceClient();
    const { data } = await service.from("profiles").select("role").eq("id", userId).single();
    role = data?.role ?? null;
  }

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar role={role} />
      <main className="flex-1 overflow-auto">
        <ProfileSync />
        {children}
      </main>
    </div>
  );
}
