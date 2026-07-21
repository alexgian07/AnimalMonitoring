import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

// large-v3 is more accurate than turbo (better on numbers/accents), still fast on Groq.
const MODEL = process.env.GROQ_MODEL || "whisper-large-v3";
const VOCAB =
  "Walking, Standing, Sitting, Running, Eating, Drinking, Grooming, Preening, " +
  "Environmental Pecking, Aggressive Pecking, Feather Pecking, Fighting, Dust bathing, " +
  "Scratching, Flapping, Stretching, Perching, Strutting, Tail fanning, Wing dragging, " +
  "Gobbling, Other vocalisation.";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: "GROQ_API_KEY is not set on the server" }, { status: 500 });

  const ctype = req.headers.get("content-type") || "audio/webm";
  const ext = ctype.includes("mp4") ? "mp4" : ctype.includes("wav") ? "wav" : "webm";
  const buf = Buffer.from(await req.arrayBuffer());

  const form = new FormData();
  form.append("file", new Blob([buf], { type: ctype }), "audio." + ext);
  form.append("model", MODEL);
  form.append("language", "en");
  form.append("temperature", "0");
  form.append("prompt", VOCAB);
  form.append("response_format", "json");

  const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key },
    body: form,
  });
  const data = await r.json();
  return NextResponse.json(data, { status: r.ok ? 200 : r.status });
}
