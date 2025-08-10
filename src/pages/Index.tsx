import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { analyzeAudio } from "@/services/analyze";

const Index = () => {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && !f.type.startsWith("audio/")) {
      toast({ title: "Invalid file", description: "Please select an audio file.", variant: "destructive" });
      e.currentTarget.value = "";
      return;
    }
    setFile(f);
    setResult(null);
  };

  const onAnalyze = async () => {
    if (!file) {
      toast({ title: "No file selected", description: "Choose a voicemail audio to analyze." });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await analyzeAudio(file);
      if (error) throw error;
      setResult(data);
      if (data?.status === "ok") {
        toast({ title: "Analysis complete", description: "Transcription and scam probability ready." });
      } else if (data?.status === "error") {
        const msg = data?.error?.message || data?.message || "Analysis failed";
        toast({ title: "Analysis failed", description: msg, variant: "destructive" });
      } else {
        toast({ title: "Unexpected response", description: "Please try again." });
      }
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err?.message ?? "Unexpected error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const scamProbPercent = typeof result?.scam?.probability === "number" ? Math.round(result.scam.probability * 100) : null;
  const scamLabel = result?.scam?.label as string | undefined;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="container mx-auto max-w-2xl px-4 py-16">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Voice Scam Shield</h1>
          <p className="text-muted-foreground">Analyze voicemails to detect AI-generated voices and potential scams using advanced voice analysis.</p>
        </header>

        <article className="rounded-lg border border-input bg-card p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="audio" className="block text-sm font-medium mb-2">Upload voicemail audio</label>
              <Input id="audio" type="file" accept="audio/*" onChange={onFileChange} />
              {file && (
                <p className="mt-2 text-sm text-muted-foreground">Selected: {file.name} ({Math.round(file.size/1024)} KB)</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={onAnalyze} disabled={loading || !file}>
                {loading ? "Analyzing..." : "Analyze Voicemail"}
              </Button>
              <Button variant="ghost" onClick={() => { setFile(null); setResult(null); }} disabled={loading && !result}>
                Reset
              </Button>
            </div>
            {result?.status === "error" && (
              <section className="mt-6">
                <div className="rounded-md border border-input p-4">
                  <h2 className="text-lg font-semibold mb-1">Analysis error</h2>
                  <p className="text-sm text-muted-foreground">{result?.error?.message || result?.message || "Something went wrong."}</p>
                  {result?.error?.code && (
                    <p className="text-xs mt-2">Code: <span className="font-mono">{result.error.code}</span></p>
                  )}
                </div>
              </section>
            )}

            {result?.status === "ok" && (
              <section className="mt-6 space-y-4">
                {typeof result?.scam?.probability === "number" && (
                  <div className="rounded-md border border-input p-4">
                    <h2 className="text-lg font-semibold mb-1">Scam probability</h2>
                    <p className="text-sm text-muted-foreground mb-1">{scamLabel ? scamLabel.replace("_", " ") : ""}</p>
                    <p className="text-2xl font-bold">{scamProbPercent}%</p>
                    {Array.isArray(result?.scam?.reasons) && result.scam.reasons.length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                        {result.scam.reasons.map((r: string, idx: number) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {result?.voice_analysis && (
                  <div className="rounded-md border border-input p-4">
                    <h2 className="text-lg font-semibold mb-2">Voice Analysis</h2>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-3 h-3 rounded-full ${result.voice_analysis.sounds_artificial ? 'bg-red-500' : 'bg-green-500'}`}></span>
                        <span className="text-sm font-medium">
                          {result.voice_analysis.sounds_artificial ? '⚠️ Artificial voice detected' : '✓ Natural voice'}
                        </span>
                      </div>
                      {result.voice_analysis.confidence > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Confidence: {Math.round(result.voice_analysis.confidence * 100)}%
                        </p>
                      )}
                      {result.voice_analysis.description && (
                        <p className="text-sm text-muted-foreground">{result.voice_analysis.description}</p>
                      )}
                      {Array.isArray(result.voice_analysis.indicators) && result.voice_analysis.indicators.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Indicators:</p>
                          <ul className="list-disc pl-5 text-sm text-muted-foreground">
                            {result.voice_analysis.indicators.map((indicator: string, idx: number) => (
                              <li key={idx}>{indicator}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {typeof result?.transcription === "string" && result.transcription && (
                  <div className="rounded-md border border-input p-4">
                    <h2 className="text-lg font-semibold mb-2">Transcription</h2>
                    <p className="whitespace-pre-wrap text-sm leading-6">{result.transcription}</p>
                  </div>
                )}

                <details className="rounded-md border border-input p-4">
                  <summary className="cursor-pointer text-sm">Raw response</summary>
                  <pre className="text-xs overflow-auto rounded-md bg-muted p-4 mt-2">
{JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </section>
            )}
          </div>
        </article>
      </section>
    </main>
  );
};

export default Index;
