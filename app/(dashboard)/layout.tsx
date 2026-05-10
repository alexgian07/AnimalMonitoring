import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import ProfileSync from "@/components/ProfileSync";
import { t } from "@/lib/i18n";

const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? "dev";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  let role: string | null = null;
  if (userId) {
    const service = createServiceClient();
    const { data } = await service.from("profiles").select("role").eq("id", userId).single();
    role = data?.role ?? null;
  }

  const buildLabel =
    BUILD_TIME === "dev"
      ? t.common.dev
      : new Date(BUILD_TIME).toLocaleString("el-GR", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar role={role} />
      <main className="flex-1 overflow-auto">
        <div className="flex justify-end px-8 pt-4 text-xs text-gray-500">
          {t.common.deployed}: <span className="ml-1 text-gray-400 font-mono">{buildLabel}</span>
        </div>
        <ProfileSync />
        {children}
      </main>
    </div>
  );
}
