import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { turkey_id, location_id, measured_at, weight_kg, temperature_celsius, notes } = body;

  if (!turkey_id || !location_id) {
    return NextResponse.json({ error: "turkey_id and location_id are required" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.from("measurements").insert({
    turkey_id,
    location_id,
    measured_at: measured_at ?? new Date().toISOString().split("T")[0],
    weight_kg: weight_kg ?? null,
    temperature_celsius: temperature_celsius ?? null,
    notes: notes || null,
    recorded_by: userId,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const turkeyId = searchParams.get("turkey_id");
  const locationId = searchParams.get("location_id");

  const supabase = await createServerClient();
  let query = supabase
    .from("measurements")
    .select("*")
    .is("deleted_at", null)
    .order("measured_at", { ascending: false });
  if (turkeyId) query = query.eq("turkey_id", turkeyId);
  if (locationId) query = query.eq("location_id", locationId);

  const { data, error } = await query.limit(500);
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
  const { error } = await supabase
    .from("measurements")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
