import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { analyzeAudio } from "@/services/analyze";
import { translateText } from "@/services/translate";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const Index = () => {
  const { t, i18n } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [translations, setTranslations] = useState<{
    transcription?: string;
    reasons?: string[];
  }>({});

  // Language mapping for translation API
  const getLanguageCode = (langCode: string) => {
    const mapping: { [key: string]: string } = {
      'en': 'en',
      'es': 'es',
      'fr': 'fr',
      'de': 'de',
      'it': 'it',
      'pt': 'pt',
      'ru': 'ru',
      'ja': 'ja',
      'zh': 'zh',
      'ko': 'ko',
      'ar': 'ar',
      'hi': 'hi'
    };
    return mapping[langCode] || 'en';
  };

  // Auto-translate content when language changes or result updates
  useEffect(() => {
    if (result?.status === "ok" && i18n.language !== 'en') {
      console.log('Triggering translation for language:', i18n.language);
      translateContent();
    } else if (i18n.language === 'en') {
      // Clear translations when switching back to English
      setTranslations({});
    }
  }, [i18n.language, result]);

  const translateContent = async () => {
    if (!result || i18n.language === 'en') return;

    console.log('Starting translation process...');
    const targetLang = getLanguageCode(i18n.language);
    const newTranslations: { transcription?: string; reasons?: string[] } = {};

    try {
      // Translate transcription
      if (result.transcription) {
        console.log('Translating transcription...');
        const { data: transcriptionData, error: transcriptionError } = await translateText(result.transcription, targetLang);
        if (transcriptionError) {
          console.error('Transcription translation error:', transcriptionError);
        } else if (transcriptionData?.translatedText) {
          newTranslations.transcription = transcriptionData.translatedText;
          console.log('Transcription translated successfully');
        }
      }

      // Translate scam reasons
      if (result.scam?.reasons && Array.isArray(result.scam.reasons)) {
        console.log('Translating scam reasons...');
        const reasonPromises = result.scam.reasons.map(async (reason: string, index: number) => {
          console.log(`Translating reason ${index + 1}:`, reason);
          const { data, error } = await translateText(reason, targetLang);
          if (error) {
            console.error(`Error translating reason ${index + 1}:`, error);
            return null;
          }
          return data?.translatedText;
        });
        
        const reasonResults = await Promise.all(reasonPromises);
        newTranslations.reasons = reasonResults.filter(Boolean);
        console.log('Reasons translated:', newTranslations.reasons);
      }

      console.log('Setting translations:', newTranslations);
      setTranslations(newTranslations);
    } catch (error) {
      console.error('Translation error:', error);
      toast({ 
        title: "Translation Error", 
        description: "Failed to translate content. Please try again.", 
        variant: "destructive" 
      });
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && !f.type.startsWith("audio/")) {
      toast({ title: t("toast.invalidFile"), description: t("toast.invalidFileDesc"), variant: "destructive" });
      e.currentTarget.value = "";
      return;
    }
    setFile(f);
    setResult(null);
    setTranslations({});
  };

  const onAnalyze = async () => {
    if (!file) {
      toast({ title: t("toast.noFileSelected"), description: t("toast.noFileSelectedDesc") });
      return;
    }
    setLoading(true);
    setTranslations({});
    try {
      const { data, error } = await analyzeAudio(file);
      if (error) throw error;
      setResult(data);
      if (data?.status === "ok") {
        toast({ title: t("toast.analysisComplete"), description: t("toast.analysisCompleteDesc") });
        // Auto-translate if UI language is not English
        if (i18n.language !== 'en') {
          console.log('Analysis complete, triggering translation...');
          setTimeout(() => translateContent(), 500);
        }
      } else if (data?.status === "error") {
        const msg = data?.error?.message || data?.message || t("toast.analysisFailed");
        toast({ title: t("toast.analysisFailed"), description: msg, variant: "destructive" });
      } else {
        toast({ title: t("toast.unexpectedResponse"), description: t("toast.unexpectedResponseDesc") });
      }
    } catch (err: any) {
      toast({ title: t("toast.analysisFailed"), description: err?.message ?? t("toast.unexpectedError"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const scamProbPercent = typeof result?.scam?.probability === "number" ? Math.round(result.scam.probability * 100) : null;
  const scamLabel = result?.scam?.label as string | undefined;
  const currentLang = i18n.language;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="container mx-auto max-w-2xl px-4 py-16">
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-2">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </header>

        <article className="rounded-lg border border-input bg-card p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="audio" className="block text-sm font-medium mb-2">{t("uploadLabel")}</label>
              <Input id="audio" type="file" accept="audio/*" onChange={onFileChange} />
              {file && (
                <p className="mt-2 text-sm text-muted-foreground">{t("selectedFile", { filename: file.name, size: Math.round(file.size/1024) })}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={onAnalyze} disabled={loading || !file}>
                {loading ? t("analyzingButton") : t("analyzeButton")}
              </Button>
              <Button variant="ghost" onClick={() => { setFile(null); setResult(null); setTranslations({}); }} disabled={loading && !result}>
                {t("resetButton")}
              </Button>
            </div>
            {result?.status === "error" && (
              <section className="mt-6">
                <div className="rounded-md border border-input p-4">
                  <h2 className="text-lg font-semibold mb-1">{t("analysisError")}</h2>
                  <p className="text-sm text-muted-foreground">{result?.error?.message || result?.message || t("analysisErrorGeneric")}</p>
                  {result?.error?.code && (
                    <p className="text-xs mt-2">{t("errorCode")} <span className="font-mono">{result.error.code}</span></p>
                  )}
                </div>
              </section>
            )}

            {result?.status === "ok" && (
              <section className="mt-6 space-y-4">
                {typeof result?.scam?.probability === "number" && (
                  <div className="rounded-md border border-input p-4">
                    <h2 className="text-lg font-semibold mb-1">{t("scamProbability")}</h2>
                    <p className="text-sm text-muted-foreground mb-1">{scamLabel ? scamLabel.replace("_", " ") : ""}</p>
                    <p className="text-2xl font-bold">{scamProbPercent}%</p>
                    {Array.isArray(result?.scam?.reasons) && result.scam.reasons.length > 0 && (
                      <div className="mt-2">
                        <h3 className="text-sm font-medium mb-1">{t("indicators")}</h3>
                        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                          {result.scam.reasons.map((r: string, idx: number) => (
                            <li key={idx}>
                              <div>{r}</div>
                              {currentLang !== 'en' && translations.reasons?.[idx] && (
                                <div className="text-xs text-muted-foreground/80 mt-1 italic">
                                  {translations.reasons[idx]}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {result?.voice_analysis && (
                  <div className="rounded-md border border-input p-4">
                    <h2 className="text-lg font-semibold mb-2">{t("voiceAnalysis")}</h2>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-3 h-3 rounded-full ${result.voice_analysis.sounds_artificial ? 'bg-red-500' : 'bg-green-500'}`}></span>
                        <span className="text-sm font-medium">
                          {result.voice_analysis.sounds_artificial ? t("artificialVoiceDetected") : t("naturalVoice")}
                        </span>
                      </div>
                      {result.voice_analysis.confidence > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {t("confidence", { percent: Math.round(result.voice_analysis.confidence * 100) })}
                        </p>
                      )}
                      {result.voice_analysis.description && (
                        <p className="text-sm text-muted-foreground">{result.voice_analysis.description}</p>
                      )}
                      {Array.isArray(result.voice_analysis.indicators) && result.voice_analysis.indicators.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">{t("indicators")}</p>
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
                    <h2 className="text-lg font-semibold mb-2">{t("transcription")}</h2>
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Original:</h3>
                        <p className="whitespace-pre-wrap text-sm leading-6 bg-muted/30 p-2 rounded">{result.transcription}</p>
                      </div>
                      {currentLang !== 'en' && (
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-1">
                            {currentLang.toUpperCase()} Translation:
                          </h3>
                          {translations.transcription ? (
                            <p className="whitespace-pre-wrap text-sm leading-6 bg-primary/10 p-2 rounded">
                              {translations.transcription}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic p-2">
                              Translating...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <details className="rounded-md border border-input p-4">
                  <summary className="cursor-pointer text-sm">{t("rawResponse")}</summary>
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
