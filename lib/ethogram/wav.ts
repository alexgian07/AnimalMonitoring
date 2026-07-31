/* Client-only audio down-encoder.
 *
 * Re-encode a recorded audio Blob to 16 kHz mono 16-bit PCM WAV so the UPLOAD size is
 * deterministic (~32 KB/s) regardless of the device's MediaRecorder bitrate. This is the real fix
 * for long clips failing on upload: `audioBitsPerSecond` is only a hint (ignored on iOS Safari and
 * some Android browsers), so a >1-min clip can exceed Vercel's ~4.5 MB serverless request-body limit
 * and get rejected at the platform edge (a 413 that never even reaches our function). 16 kHz mono is
 * transparent for speech — Whisper downsamples to 16 kHz anyway — so there's no accuracy cost.
 * 32 KB/s ⇒ 80 s ≈ 2.6 MB, ~2 min stays under the cap.
 *
 * Never throws: if the browser can't decode the recorded container, it returns the original blob so
 * recording is never broken (the caller logs `reencoded:false` so we can see it).
 */

const TARGET_RATE = 16000;

type WavResult = { blob: Blob; reencoded: boolean };

export async function toWav16kMono(input: Blob): Promise<WavResult> {
  try {
    const AC: typeof AudioContext | undefined =
      (typeof window !== "undefined" &&
        (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)) ||
      undefined;
    const OAC: typeof OfflineAudioContext | undefined =
      (typeof window !== "undefined" &&
        (window.OfflineAudioContext ||
          (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext)) ||
      undefined;
    if (!AC || !OAC) return { blob: input, reencoded: false };

    const bytes = await input.arrayBuffer();
    const ctx = new AC();
    let decoded: AudioBuffer;
    try {
      decoded = await ctx.decodeAudioData(bytes.slice(0)); // slice: decodeAudioData detaches the buffer
    } finally {
      ctx.close?.();
    }

    const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE));
    const off = new OAC(1, frames, TARGET_RATE); // 1 channel → mono, rendered at 16 kHz
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start(0);
    const rendered = await off.startRendering();

    const wav = encodeWav16(rendered.getChannelData(0), TARGET_RATE);
    return { blob: new Blob([wav], { type: "audio/wav" }), reencoded: true };
  } catch {
    return { blob: input, reencoded: false }; // never break recording over a re-encode failure
  }
}

/* Float32 [-1,1] PCM → 16-bit mono WAV (44-byte header + samples). */
function encodeWav16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate = rate * blockAlign
  view.setUint16(32, 2, true); // block align = channels * bytesPerSample
  view.setUint16(34, 16, true); // bits per sample
  str(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}
