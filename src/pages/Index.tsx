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
      toast({ title: "Analysis complete (stub)", description: "Edge function returned a placeholder response." });
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err?.message ?? "Unexpected error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="container mx-auto max-w-2xl px-4 py-16">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Voice Scam Shield</h1>
          <p className="text-muted-foreground">Analyze voicemails to detect AI-generated voices and potential scams.</p>
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

            {result && (
              <section className="mt-6">
                <h2 className="text-xl font-semibold mb-2">Result</h2>
                <pre className="text-sm overflow-auto rounded-md bg-muted p-4">
{JSON.stringify(result, null, 2)}
                </pre>
              </section>
            )}
          </div>
        </article>
      </section>
    </main>
  );
};

export default Index;
