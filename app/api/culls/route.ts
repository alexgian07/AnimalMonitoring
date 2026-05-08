import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { turkey_id, location_id, culled_at, weight_at_cull, reason, notes } = body;

  if (!turkey_id || !location_id) {
    return NextResponse.json({ error: "turkey_id and location_id are required" }, { status: 400 });
  }

  const supabase = await createServerClient();

  const { error: cullError } = await supabase.from("culls").insert({
    turkey_id,
    location_id,
    culled_at: culled_at ?? new Date().toISOString().split("T")[0],
    weight_at_cull: weight_at_cull ?? null,
    reason: reason ?? "harvest",
    notes: notes || null,
    recorded_by: userId,
  });

  if (cullError) return NextResponse.json({ error: cullError.message }, { status: 400 });

  // Mark turkey as culled
  await supabase.from("turkeys").update({ status: "culled" }).eq("id", turkey_id);

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("location_id");

  const supabase = await createServerClient();
  let query = supabase.from("culls").select("*, turkeys(tag)").order("culled_at", { ascending: false });
  if (locationId) query = query.eq("location_id", locationId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
