import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { commitDay, replaceTab, type Row } from "@/lib/ethogram/sheets";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const spreadsheetId = process.env.GSHEET_ID;
    if (!spreadsheetId) throw new Error("GSHEET_ID is not set on the server");
    const tabName: string = body.tabName;
    const rows: Row[] = body.rows;
    const sessionDate: string | undefined = body.sessionDate;
    const timeOfDay: string | undefined = body.timeOfDay;
    const replace: boolean = body.replace === true;
    if (!tabName || !Array.isArray(rows)) throw new Error("Missing tabName/rows");

    // Resolve who is committing, from Clerk, for the A1 note + audit trail. Best-effort.
    let who = "";
    try {
      const client = await clerkClient();
      const u = await client.users.getUser(userId);
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "";
      const email =
        u.primaryEmailAddress?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress ?? "";
      who = [name, email && `(${email})`].filter(Boolean).join(" ");
    } catch {
      /* name resolution is best-effort; fall back to the user id below */
    }
    const stamp = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
    const note = `${replace ? "Re-committed" : "Committed"} by ${who || userId} · ${stamp}`;

    let committed;
    if (replace) {
      // Guarded correction path: only allow replacing a tab THIS APP committed. Verify against
      // Supabase server-side (don't trust the client) so we never overwrite a foreign/manual tab.
      if (!sessionDate || !timeOfDay) throw new Error("Missing sessionDate/timeOfDay for replace");
      const supabase = await createServerClient();
      const { data: sess } = await supabase
        .from("ethogram_sessions")
        .select("status, sheet_tab")
        .eq("user_id", userId)
        .eq("session_date", sessionDate)
        .eq("time_of_day", timeOfDay)
        .maybeSingle();
      if (!sess || sess.status !== "committed" || sess.sheet_tab !== tabName) {
        return NextResponse.json(
          {
            error: `Tab "${tabName}" wasn't created by this app — rename or delete it in Google Sheets first.`,
            code: "NOT_APP_OWNED",
          },
          { status: 409 },
        );
      }
      committed = await replaceTab(spreadsheetId, tabName, rows, note);
    } else {
      committed = await commitDay(spreadsheetId, tabName, rows, note); // throws TabExistsError if it exists
    }

    // Mark the session committed (audit). Never fail the commit over this.
    if (sessionDate && timeOfDay) {
      try {
        const supabase = await createServerClient();
        // Same timestamp for both so `updated_at > committed_at` cleanly means "edited AFTER commit"
        // (that comparison drives the client's "✎ edited since commit" indicator).
        const nowIso = new Date().toISOString();
        await supabase.from("ethogram_sessions").upsert(
          {
            user_id: userId,
            session_date: sessionDate,
            time_of_day: timeOfDay,
            status: "committed",
            sheet_tab: tabName,
            committed_by: userId,
            committed_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: "user_id,session_date,time_of_day" },
        );
      } catch {
        /* audit update is best-effort — the Sheet is the system of record */
      }
    }

    return NextResponse.json({ committed });
  } catch (e) {
    const err = e as Error & { code?: string };
    const known = err.code === "TAB_EXISTS" || err.code === "TAB_SHAPE_MISMATCH";
    return NextResponse.json(
      { error: err.message, code: err.code ?? null },
      { status: known ? 409 : 500 },
    );
  }
}
