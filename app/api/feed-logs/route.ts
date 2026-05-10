import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    location_id, feeder_label, week_number, week_start_date,
    weight_before_kg, feed_added_kg, weight_after_kg,
    bird_count, avg_weight_kg, weight_gain_kg, notes,
  } = body;

  if (!location_id || !week_number || !week_start_date) {
    return NextResponse.json({ error: "location_id, week_number and week_start_date are required" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("feed_logs")
    .upsert({
      location_id,
      feeder_label:    feeder_label ?? "main",
      week_number,
      week_start_date,
      weight_before_kg: weight_before_kg ?? null,
      feed_added_kg:    feed_added_kg    ?? null,
      weight_after_kg:  weight_after_kg  ?? null,
      bird_count:       bird_count       ?? null,
      avg_weight_kg:    avg_weight_kg    ?? null,
      weight_gain_kg:   weight_gain_kg   ?? null,
      notes:            notes || null,
      recorded_by:      userId,
    }, { onConflict: "location_id,feeder_label,week_number" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("location_id");

  const supabase = await createServerClient();
  let query = supabase
    .from("feed_logs")
    .select("*, locations(name, position)")
    .is("deleted_at", null)
    .order("week_number", { ascending: true });
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
    .from("feed_logs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
