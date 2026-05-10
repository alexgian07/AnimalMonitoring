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
  let query = supabase
    .from("culls")
    .select("*, turkeys(tag)")
    .is("deleted_at", null)
    .order("culled_at", { ascending: false });
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

  // Find the cull to revert turkey status
  const { data: cull } = await supabase.from("culls").select("turkey_id").eq("id", id).single();

  // Soft-delete the cull
  const { error } = await supabase
    .from("culls")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Restore turkey to alive (since the cull is being undone)
  if (cull?.turkey_id) {
    await supabase.from("turkeys").update({ status: "alive" }).eq("id", cull.turkey_id);
  }

  return NextResponse.json({ success: true });
}
