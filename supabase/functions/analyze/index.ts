// Supabase Edge Function: analyze
// Implements transcription (OpenAI Whisper) and content-based scam probability
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    chunks.push(bytes);
    position += chunkSize;
  }
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function labelFromProbability(p: number) {
  if (p >= 0.7) return "likely_scam" as const;
  if (p <= 0.3) return "unlikely" as const;
  return "uncertain" as const;
}

async function transcribeWithOpenAI(audioBase64: string, filename = "audio.webm", mimeType = "audio/webm") {
  const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAIApiKey) throw new Error("Missing OPENAI_API_KEY secret");

  const binaryAudio = processBase64Chunks(audioBase64);
  const formData = new FormData();
  const blob = new Blob([binaryAudio], { type: mimeType });
  formData.append("file", blob, filename);
  formData.append("model", "whisper-1");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openAIApiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI transcription error: ${errText}`);
  }

  const result = await response.json();
  return (result?.text as string) ?? "";
}

async function scamProbabilityFromTranscript(transcript: string) {
  const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAIApiKey) throw new Error("Missing OPENAI_API_KEY secret");

  // Guard: empty transcript
  if (!transcript || !transcript.trim()) {
    return { probability: 0.0, reasons: ["No speech content detected"], label: labelFromProbability(0.0) } as const;
  }

  const systemPrompt = `You assess voicemails for possible scams (phishing, threatening IRS calls, tech support, urgent requests for payment/wires/codes).
Return STRICT JSON with keys: probability (0-1) and reasons (array of short strings). Do not include extra text.`;

  const userPrompt = `Voicemail transcript:\n\n${transcript}\n\nReturn JSON only.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI classification error: ${errText}`);
  }

  const data = await response.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";

  let probability = 0.0;
  let reasons: string[] = [];
  try {
    const json = JSON.parse(content);
    const pRaw = Number(json?.probability);
    probability = Number.isFinite(pRaw) ? Math.max(0, Math.min(1, pRaw)) : 0.0;
    if (Array.isArray(json?.reasons)) reasons = json.reasons.slice(0, 6).map((r: unknown) => String(r));
  } catch (_) {
    // Fallback: if not valid JSON, keep defaults
  }

  const label = labelFromProbability(probability);
  return { probability, reasons, label } as const;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { audio, filename, mimeType, size } = await req.json();

    if (!audio) {
      const body = { status: "error", error: { code: "no_audio", message: "No audio provided" } } as const;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const meta = { filename: filename ?? null, mimeType: mimeType ?? null, size: size ?? null };

    // 1) Transcribe
    const startedAt = Date.now();
    const transcription = await transcribeWithOpenAI(audio, filename, mimeType);

    // 2) Content-based scam probability
    const scam = await scamProbabilityFromTranscript(transcription);
    const durationMs = Date.now() - startedAt;

    const responseBody = {
      status: "ok",
      transcription,
      scam,
      metadata: meta,
      processing_ms: durationMs,
      version: "0.2.0",
    } as const;

    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze error:", e);
    const msg = e instanceof Error ? e.message : "Unexpected error";
    const code = msg.includes("insufficient_quota") ? "insufficient_quota" : (msg.includes("Missing OPENAI_API_KEY") ? "missing_api_key" : "unknown");
    const body = { status: "error", error: { code, message: code === "insufficient_quota" ? "OpenAI quota exceeded. Please add billing or use a different key." : msg } } as const;
    return new Response(
      JSON.stringify(body),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
