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

async function transcribeWithGemini(audioBase64: string, filename = "audio.webm", mimeType = "audio/webm") {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) throw new Error("Missing GEMINI_API_KEY secret");

  // Use Gemini 2.0 Flash with audio input for transcription
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: "Please transcribe this audio file accurately. Return only the transcript text without any additional formatting or commentary." },
          {
            inline_data: {
              mime_type: mimeType || "audio/webm",
              data: audioBase64
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0,
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 1000,
      }
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini transcription error: ${errText}`);
  }

  const result = await response.json();
  const transcript = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return transcript.trim();
}

async function scamProbabilityWithGemini(transcript: string) {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) throw new Error("Missing GEMINI_API_KEY secret");

  // Guard: empty transcript
  if (!transcript || !transcript.trim()) {
    return { probability: 0.0, reasons: ["No speech content detected"], label: labelFromProbability(0.0) } as const;
  }

  const prompt = `You are a cybersecurity expert analyzing voicemails for scam indicators. Analyze this transcript and provide a scam probability score.

TRANSCRIPT: "${transcript}"

SCAM INDICATORS TO LOOK FOR:
- Urgent threats (account closure, legal action, arrest)
- Requests for personal info (SSN, passwords, payment details)
- Pressure tactics (immediate action required, limited time)
- Impersonation (IRS, banks, tech support, utilities)
- Payment demands (gift cards, wire transfers, cryptocurrency)
- Verification code requests
- Suspicious caller behavior (robotic voice, background noise)

RESPONSE FORMAT (JSON only, no other text):
{
  "probability": 0.85,
  "reasons": ["Threatens immediate legal action", "Demands immediate payment", "Claims to be from IRS"]
}

Probability scale:
- 0.0-0.2: Legitimate call
- 0.3-0.6: Suspicious elements  
- 0.7-1.0: Likely scam

Analyze now:`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.2,
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 300,
      }
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${errText}`);
  }

  const data = await response.json();
  let content = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  
  // Clean up the response - extract JSON if wrapped in markdown
  content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  
  let probability = 0.0;
  let reasons: string[] = ["Analysis completed"];
  
  try {
    const json = JSON.parse(content);
    const pRaw = Number(json?.probability);
    probability = Number.isFinite(pRaw) ? Math.max(0, Math.min(1, pRaw)) : 0.0;
    if (Array.isArray(json?.reasons)) {
      reasons = json.reasons.slice(0, 6).map((r: unknown) => String(r)).filter(r => r.length > 0);
    }
  } catch (parseError) {
    // Fallback: analyze content manually for keywords
    const lowerTranscript = transcript.toLowerCase();
    const scamKeywords = [
      'irs', 'arrest', 'warrant', 'legal action', 'suspend', 'verify', 'urgent',
      'gift card', 'wire transfer', 'social security', 'account closed', 'immediate',
      'confirm your', 'press 1', 'call back immediately', 'final notice', 'refund'
    ];
    
    const matchedKeywords = scamKeywords.filter(keyword => lowerTranscript.includes(keyword));
    probability = Math.min(0.9, matchedKeywords.length * 0.15);
    
    if (matchedKeywords.length > 0) {
      reasons = [`Contains suspicious keywords: ${matchedKeywords.slice(0, 3).join(', ')}`];
    }
    
    console.log("JSON parse failed, using keyword fallback:", { parseError, content, probability, reasons });
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
    const transcription = await transcribeWithGemini(audio, filename, mimeType);

    // 2) Content-based scam probability with Gemini
    const scam = await scamProbabilityWithGemini(transcription);
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
