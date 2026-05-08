import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AdminUsersTable from "@/components/AdminUsersTable";

export default async function AdminPage() {
  const { userId } = await auth();
  const supabase = await createServerClient();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId!).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const serviceClient = createServiceClient();
  const { data: profiles } = await serviceClient.from("profiles").select("*").order("created_at");
  const { data: locations } = await serviceClient.from("locations").select("id, name");

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Admin Panel</h1>
      <p className="text-gray-400 text-sm mb-8">Manage users and their access</p>
      <AdminUsersTable profiles={profiles ?? []} locations={locations ?? []} />
    </div>
  );
}
