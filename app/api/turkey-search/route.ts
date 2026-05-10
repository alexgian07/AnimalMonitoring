import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json([]);

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("turkeys")
    .select("id, tag, sex, status, location_id, locations(name)")
    .is("deleted_at", null)
    .ilike("tag", `%${q}%`)
    .order("tag")
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
