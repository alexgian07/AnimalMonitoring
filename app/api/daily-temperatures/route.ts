import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    location_id,
    recorded_on,
    temp_min, temp_max,
    temp_morning, temp_midday, temp_evening,
    humidity, mortality, sick_count, notes,
  } = body;

  if (!location_id) {
    return NextResponse.json({ error: "location_id is required" }, { status: 400 });
  }

  const supabase = await createServerClient();

  // Upsert: one row per (location, date)
  const { data, error } = await supabase
    .from("daily_temperatures")
    .upsert({
      location_id,
      recorded_on: recorded_on ?? new Date().toISOString().split("T")[0],
      temp_min:     temp_min     ?? null,
      temp_max:     temp_max     ?? null,
      temp_morning: temp_morning ?? null,
      temp_midday:  temp_midday  ?? null,
      temp_evening: temp_evening ?? null,
      humidity:     humidity     ?? null,
      mortality:    mortality    ?? 0,
      sick_count:   sick_count   ?? 0,
      notes:        notes        || null,
      recorded_by:  userId,
    }, { onConflict: "location_id,recorded_on" })
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
  const date = searchParams.get("date");

  const supabase = await createServerClient();
  let query = supabase.from("daily_temperatures").select("*").order("recorded_on", { ascending: false });
  if (locationId) query = query.eq("location_id", locationId);
  if (date) query = query.eq("recorded_on", date);

  const { data, error } = await query.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
