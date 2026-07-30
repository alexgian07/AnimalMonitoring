import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { interpretTranscript } from "@/lib/ethogram/interpret";

export const runtime = "nodejs";
// Whisper + LLM parse run in this one request; give it room so longer clips don't hit the
// default (~10s) serverless timeout. 60s is the Vercel Hobby max.
export const maxDuration = 60;

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

  // space selects the behaviour set for interpretation (free-range adds Foraging).
  const space = new URL(req.url).searchParams.get("space") || "inside";
  const ctype = req.headers.get("content-type") || "audio/webm";
  const ext = ctype.includes("mp4") ? "mp4" : ctype.includes("wav") ? "wav" : "webm";
  const buf = Buffer.from(await req.arrayBuffer());

  const form = new FormData();
  form.append("file", new Blob([buf], { type: ctype }), "audio." + ext);
  form.append("model", MODEL);
  // no fixed language → Whisper auto-detects (supports Greek + English; ADR 0009)
  form.append("temperature", "0");
  form.append("prompt", VOCAB);
  form.append("response_format", "json");

  const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key },
    body: form,
  });
  const data = await r.json();
  if (!r.ok) {
    // log the exact Groq failure so long-clip / limit errors are diagnosable in Vercel logs
    console.error("[ethogram/transcribe] Groq failed", r.status, JSON.stringify(data).slice(0, 600));
    const msg = data?.error?.message || data?.error || `Transcription failed (${r.status})`;
    return NextResponse.json({ error: msg, status: r.status }, { status: r.status });
  }

  // LLM parse → per-behaviour counts for this clip; null on failure (client falls back to the
  // deterministic parser on the raw text). Returns both so the client can show the transcript.
  const text = typeof data.text === "string" ? data.text : "";
  const counts = await interpretTranscript(text, space);
  return NextResponse.json({ text, counts });
}
