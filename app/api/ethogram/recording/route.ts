import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/* Save one clip's transcript (audit trail). Ensures the session row exists, then
 * appends a recording. obs/cell are 1-based to match the Sheet layout. */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { date, ampm, obs, cell, transcript } = (await req.json()) as {
      date?: string; ampm?: string; obs?: number; cell?: number; transcript?: string;
    };
    if (!date || !ampm || !obs || !cell || typeof transcript !== "string" || !transcript.trim())
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const supabase = await createServerClient();

    // Ensure the session exists (touches only updated_at on conflict), get its id.
    const { data: session, error: sErr } = await supabase
      .from("ethogram_sessions")
      .upsert(
        { user_id: userId, session_date: date, time_of_day: ampm, updated_at: new Date().toISOString() },
        { onConflict: "user_id,session_date,time_of_day" },
      )
      .select("id")
      .single();
    if (sErr) throw sErr;

    const { error: rErr } = await supabase
      .from("ethogram_recordings")
      .insert({ session_id: session.id, obs, cell, transcript: transcript.trim() });
    if (rErr) throw rErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
