import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;

  const service = createServiceClient();

  const { data: existing } = await service.from("profiles").select("id").eq("id", userId).single();
  if (existing) return NextResponse.json({ synced: false });

  const { error } = await service.from("profiles").insert({
    id: userId,
    email,
    name,
    role: "viewer",
    allowed_locations: null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ synced: true });
}
