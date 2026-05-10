import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = await createServerClient();
  const { data, error } = await sb
    .from("tasks_template")
    .select("*")
    .order("day_of_week")
    .order("position");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { day_of_week, time_slot, task_label, category, position } = body;
  if (!day_of_week || !task_label) {
    return NextResponse.json({ error: "day_of_week and task_label are required" }, { status: 400 });
  }

  const sb = await createServerClient();
  const { data, error } = await sb
    .from("tasks_template")
    .insert({
      day_of_week: parseInt(day_of_week),
      time_slot: time_slot || null,
      task_label: task_label.trim(),
      category: category || null,
      position: position ?? 0,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...patch } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const sb = await createServerClient();
  const { data, error } = await sb
    .from("tasks_template")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const sb = await createServerClient();
  const { error } = await sb.from("tasks_template").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
