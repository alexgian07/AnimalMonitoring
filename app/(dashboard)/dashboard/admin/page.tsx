import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AdminUsersTable from "@/components/AdminUsersTable";
import SlaughterScheduleAdmin from "@/components/SlaughterScheduleAdmin";
import ImportExcel from "@/components/ImportExcel";
import { t } from "@/lib/i18n";

export default async function AdminPage() {
  const { userId } = await auth();
  const supabase = await createServerClient();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId!).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const serviceClient = createServiceClient();
  const { data: profiles } = await serviceClient.from("profiles").select("*").order("created_at");
  const { data: locations } = await serviceClient.from("locations").select("*");

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">{t.admin.title}</h1>
      <p className="text-gray-400 text-sm mb-8">{t.admin.subtitle}</p>
      <AdminUsersTable profiles={profiles ?? []} locations={locations ?? []} />
      <SlaughterScheduleAdmin />
      <ImportExcel />
    </div>
  );
}
