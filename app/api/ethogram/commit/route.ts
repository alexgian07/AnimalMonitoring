import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { commitDay, type Row } from "@/lib/ethogram/sheets";

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
    if (!tabName || !Array.isArray(rows)) throw new Error("Missing tabName/rows");

    const committed = await commitDay(spreadsheetId, tabName, rows);
    return NextResponse.json({ committed });
  } catch (e) {
    const err = e as Error & { code?: string };
    return NextResponse.json(
      { error: err.message, code: err.code ?? null },
      { status: err.code === "TAB_EXISTS" ? 409 : 500 },
    );
  }
}
