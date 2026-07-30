import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/* List the caller's saved sessions (most recent first) for the past-sessions browser.
 * Returns lightweight metadata + a filled-cell count computed from the JSONB grid. */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = await createServerClient();
    const url = new URL(req.url);
    const spaceFilter = url.searchParams.get("space"); // optional: only this space

    // Team view: everyone's COMMITTED sessions + the caller's own (draft or committed).
    // RLS enforces the same rule; this .or mirrors it so others' private drafts aren't listed.
    let query = supabase
      .from("ethogram_sessions")
      .select("session_date, time_of_day, status, sheet_tab, updated_at, data, space, user_id, committed_by_name")
      .or(`status.eq.committed,user_id.eq.${userId}`);
    if (spaceFilter) query = query.eq("space", spaceFilter);
    const { data, error } = await query
      .order("session_date", { ascending: false })
      .order("time_of_day", { ascending: true })
      .limit(120);
    if (error) throw error;

    const sessions = (data ?? []).map((s) => {
      let filled = 0;
      const grid = s.data as number[][][] | null;
      if (Array.isArray(grid))
        for (const obs of grid)
          if (Array.isArray(obs))
            for (const cell of obs)
              if (Array.isArray(cell) && cell.some((v) => typeof v === "number" && v > 0)) filled++;
      return {
        date: s.session_date,
        ampm: s.time_of_day,
        status: s.status,
        sheetTab: s.sheet_tab,
        updatedAt: s.updated_at,
        space: s.space,
        filled,
        mine: s.user_id === userId,
        by: s.committed_by_name ?? null,
      };
    });

    return NextResponse.json({ sessions });
  } catch (e) {
    return NextResponse.json({ sessions: [], error: (e as Error).message });
  }
}
