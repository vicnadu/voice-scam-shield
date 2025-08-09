// Deno edge function: analyze (stub)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const response = {
      status: "ok",
      message: "Edge function stub. ASR + AI voice detection not implemented yet.",
      received: {
        hasAudio: Boolean(body?.audio),
        filename: body?.filename ?? null,
        mimeType: body?.mimeType ?? null,
        size: body?.size ?? null,
      },
      ai_voice: {
        probability: null as number | null,
        label: "not_implemented" as const,
      },
      transcription: null as string | null,
      notes: [
        "This is a placeholder endpoint. We'll add transcription and anti-spoofing next.",
      ],
      version: "0.1.0",
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: e instanceof Error ? e.message : "Unexpected error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
