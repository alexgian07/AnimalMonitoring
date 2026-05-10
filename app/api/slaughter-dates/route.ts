import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const sb = await createServerClient();
  const { data } = await sb.from("profiles").select("role").eq("id", userId).single();
  return data?.role === "admin" ? userId : null;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = await createServerClient();
  const { data, error } = await sb.from("slaughter_schedule").select("*").order("scheduled_on");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { scheduled_on, notes } = body;
  if (!scheduled_on) return NextResponse.json({ error: "scheduled_on is required" }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("slaughter_schedule")
    .upsert({ scheduled_on, notes: notes || null }, { onConflict: "scheduled_on" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service.from("slaughter_schedule").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
