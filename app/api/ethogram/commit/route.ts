import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { commitDay, replaceTab, upsertTab, tabExists, cellText, type Row } from "@/lib/ethogram/sheets";
import { FREE_BEHAVIOURS, OBS } from "@/lib/ethogram/parser";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/* Free-range day tab layout: header, then a ΠΡΩΙ block (6 obs) and a ΜΕΣΗΜΕΡΙ block (6 obs),
 * separated by a blank row. Each grid is [obs][cell=1][behaviour]; missing halves render blank. */
function freeRangeDayRows(morning: number[][][] | null, lunch: number[][][] | null): Row[] {
  const head: Row = ["", "OBSERV.", ...FREE_BEHAVIOURS.map((b) => b.name)];
  const rows: Row[] = [head];
  const block = (grid: number[][][] | null, label: string) => {
    for (let o = 0; o < OBS; o++) {
      const counts = grid?.[o]?.[0] ?? FREE_BEHAVIOURS.map(() => 0);
      rows.push([o === 0 ? label : "", o + 1, ...counts.map((v) => (v || "") as string | number)]);
    }
  };
  block(morning, "ΠΡΩΙ");
  rows.push([]); // blank separator between the two half-day blocks
  block(lunch, "ΜΕΣΗΜΕΡΙ");
  return rows;
}

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
    const space: string = body.space || "inside";
    const replace: boolean = body.replace === true;
    // Inside sends prebuilt `rows`; free-range sends raw `data` (validated in its own branch).
    if (!tabName) throw new Error("Missing tabName");
    if (space !== "free_range" && !Array.isArray(rows)) throw new Error("Missing rows");

    // Resolve who is committing, from Clerk, for the A1 note + audit trail. Best-effort.
    let who = "";
    let whoName = "";
    try {
      const client = await clerkClient();
      const u = await client.users.getUser(userId);
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "";
      const email =
        u.primaryEmailAddress?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress ?? "";
      who = [name, email && `(${email})`].filter(Boolean).join(" ");
      whoName = name || email || userId;   // shown as "committed by <name>" to the team
    } catch {
      /* name resolution is best-effort; fall back to the user id below */
    }
    const stamp = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
    const note = `${replace ? "Re-committed" : "Committed"} by ${who || userId} · ${stamp}`;

    let committed;
    if (space === "free_range") {
      // Free-range: assemble the whole day tab (both halves) and upsert it. The committing half's
      // grid comes from the client (freshest); the other half is read from its stored session.
      const freeSheetId = process.env.GSHEET_ID_FREERANGE;
      if (!freeSheetId) throw new Error("GSHEET_ID_FREERANGE is not set on the server");
      const thisGrid = body.data as number[][][] | undefined;
      if (!thisGrid || !sessionDate || !timeOfDay) throw new Error("Missing data/sessionDate/timeOfDay");

      const supabase = await createServerClient();
      const otherAmpm = timeOfDay === "Π" ? "Μ" : "Π";
      const { data: sib } = await supabase
        .from("ethogram_sessions")
        .select("data")
        .eq("user_id", userId)
        .eq("session_date", sessionDate)
        .eq("time_of_day", otherAmpm)
        .eq("space", "free_range")
        .maybeSingle();
      const otherGrid = (sib?.data as number[][][] | undefined) ?? null;

      const morning = timeOfDay === "Π" ? thisGrid : otherGrid;
      const lunch = timeOfDay === "Μ" ? thisGrid : otherGrid;

      // Guard (parity with inside): free-range upserts the day tab, but must not clobber a tab it
      // didn't create. "Ours" = a committed free-range session for this day already points at it.
      const { data: owned } = await supabase
        .from("ethogram_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("session_date", sessionDate)
        .eq("space", "free_range")
        .eq("status", "committed")
        .eq("sheet_tab", tabName)
        .limit(1)
        .maybeSingle();
      if (owned) {
        // we created it before — shape-check before overwriting (defends against tampering/drift)
        const b1 = await cellText(freeSheetId, `'${tabName}'!B1`);
        if (b1.toUpperCase() !== "OBSERV.")
          return NextResponse.json(
            { error: `Tab "${tabName}" doesn't look like a free-range ethogram tab — refusing to overwrite it.`, code: "TAB_SHAPE_MISMATCH" },
            { status: 409 },
          );
      } else if (await tabExists(freeSheetId, tabName)) {
        // a same-named tab exists that we never committed → foreign/manual; don't touch it
        return NextResponse.json(
          { error: `Tab "${tabName}" already exists in the free-range Sheet and wasn't created by this app — rename or delete it there first.`, code: "NOT_APP_OWNED" },
          { status: 409 },
        );
      }

      committed = await upsertTab(freeSheetId, tabName, freeRangeDayRows(morning, lunch), note);
    } else if (replace) {
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
        .eq("space", space)
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
            space,
            status: "committed",
            sheet_tab: tabName,
            committed_by: userId,
            committed_by_name: whoName || userId,
            committed_at: nowIso,
            updated_at: nowIso,
          },
          { onConflict: "user_id,session_date,time_of_day,space" },
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
