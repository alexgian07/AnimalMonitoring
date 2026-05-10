import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { location_id, tag, sex, birth_date, notes } = body;

  if (!location_id || !tag) {
    return NextResponse.json({ error: "location_id and tag are required" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.from("turkeys").insert({
    location_id,
    tag: tag.trim(),
    sex: sex ?? "Unknown",
    birth_date: birth_date || null,
    notes: notes || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("location_id");

  const supabase = await createServerClient();
  let query = supabase.from("turkeys").select("*").is("deleted_at", null).order("tag");
  if (locationId) query = query.eq("location_id", locationId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = await createServerClient();
  const now = new Date().toISOString();
  // Soft-delete the turkey AND its measurements/culls so the cascade is consistent
  const { error } = await supabase.from("turkeys").update({ deleted_at: now }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("measurements").update({ deleted_at: now }).eq("turkey_id", id).is("deleted_at", null);
  await supabase.from("culls").update({ deleted_at: now }).eq("turkey_id", id).is("deleted_at", null);

  return NextResponse.json({ success: true });
}
