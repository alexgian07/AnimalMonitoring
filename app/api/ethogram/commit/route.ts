import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { commitDay, type Row } from "@/lib/ethogram/sheets";
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
    const note = `Committed by ${who || userId} · ${stamp}`;

    const committed = await commitDay(spreadsheetId, tabName, rows, note);

    // Mark the session committed (audit). Never fail the commit over this.
    if (sessionDate && timeOfDay) {
      try {
        const supabase = await createServerClient();
        await supabase.from("ethogram_sessions").upsert(
          {
            user_id: userId,
            session_date: sessionDate,
            time_of_day: timeOfDay,
            status: "committed",
            sheet_tab: tabName,
            committed_by: userId,
            committed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
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
    return NextResponse.json(
      { error: err.message, code: err.code ?? null },
      { status: err.code === "TAB_EXISTS" ? 409 : 500 },
    );
  }
}
