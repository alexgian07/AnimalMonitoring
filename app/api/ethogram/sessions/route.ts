import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/* List the caller's saved sessions (most recent first) for the past-sessions browser.
 * Returns lightweight metadata + a filled-cell count computed from the JSONB grid. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("ethogram_sessions")
      .select("session_date, time_of_day, status, sheet_tab, updated_at, data")
      .eq("user_id", userId)
      .order("session_date", { ascending: false })
      .order("time_of_day", { ascending: true })
      .limit(60);
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
        filled,
      };
    });

    return NextResponse.json({ sessions });
  } catch (e) {
    return NextResponse.json({ sessions: [], error: (e as Error).message });
  }
}
