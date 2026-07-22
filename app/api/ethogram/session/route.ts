import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/* Load a saved session (draft or committed) for a given day + time-of-day, so the
 * client can resume it. RLS scopes rows to the calling user. */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const ampm = url.searchParams.get("ampm");
  if (!date || !ampm) return NextResponse.json({ error: "Missing date/ampm" }, { status: 400 });

  try {
    const supabase = await createServerClient();
    const { data: session, error } = await supabase
      .from("ethogram_sessions")
      .select("id, data, status, sheet_tab, committed_at, updated_at")
      .eq("user_id", userId)
      .eq("session_date", date)
      .eq("time_of_day", ampm)
      .maybeSingle();
    if (error) throw error;

    // Also return the transcript history so the client can show what was said per cell.
    let recordings: { obs: number; cell: number; transcript: string }[] = [];
    if (session?.id) {
      const { data: recs } = await supabase
        .from("ethogram_recordings")
        .select("obs, cell, transcript, created_at")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });   // ascending → later takes win when reduced
      recordings = (recs ?? []).map((r) => ({ obs: r.obs, cell: r.cell, transcript: r.transcript }));
    }

    return NextResponse.json({ session: session ?? null, recordings });
  } catch (e) {
    // Loading is best-effort: never block the UI if persistence is unavailable.
    return NextResponse.json({ session: null, recordings: [], error: (e as Error).message });
  }
}

/* Autosave the working grid. Upsert on the natural key (user_id, date, time_of_day).
 * Only touches `data`/`template`/`updated_at`, so it never flips a committed session
 * back to draft or clobbers commit metadata. */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { date, ampm, data, template } = (await req.json()) as {
      date?: string; ampm?: string; data?: unknown; template?: string;
    };
    if (!date || !ampm || !Array.isArray(data))
      return NextResponse.json({ error: "Missing date/ampm/data" }, { status: 400 });

    const supabase = await createServerClient();
    const { data: row, error } = await supabase
      .from("ethogram_sessions")
      .upsert(
        {
          user_id: userId,
          session_date: date,
          time_of_day: ampm,
          data,
          ...(template ? { template } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,session_date,time_of_day" },
      )
      .select("id, status")
      .single();
    if (error) throw error;
    return NextResponse.json({ id: row.id, status: row.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/* Clear a whole day: delete the saved session (cascades to its recordings). This only
 * affects our app/DB state — it never touches the Google Sheet (deleting a committed
 * tab stays a manual step in Sheets, per the additive-only safety model). */
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const ampm = url.searchParams.get("ampm");
  if (!date || !ampm) return NextResponse.json({ error: "Missing date/ampm" }, { status: 400 });

  try {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("ethogram_sessions")
      .delete()
      .eq("user_id", userId)
      .eq("session_date", date)
      .eq("time_of_day", ampm);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
