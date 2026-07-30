import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { interpretTranscript } from "@/lib/ethogram/interpret";

export const runtime = "nodejs";

/* Text → per-behaviour counts via the LLM. Standalone so it can be tested with sample
 * transcripts (no mic) and reused later to re-parse stored transcripts. */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text, space } = (await req.json()) as { text?: string; space?: string };
  const counts = await interpretTranscript(String(text || ""), space);
  return NextResponse.json({ counts });
}
