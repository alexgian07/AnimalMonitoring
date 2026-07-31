import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

/* Tiny client-diagnostics sink. The client beacons upload failures here (esp. a 413, which Vercel
 * rejects at the edge before /transcribe runs, so it leaves NO server trace otherwise). We just
 * console.error it → visible in Vercel runtime logs. Best-effort; never throws, stores nothing. */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const body = await req.json();
    console.error("[ethogram/clientlog]", userId, JSON.stringify(body).slice(0, 800));
  } catch {
    /* ignore malformed diagnostics */
  }
  return NextResponse.json({ ok: true });
}
