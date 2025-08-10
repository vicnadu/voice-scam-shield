import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { analyzeAudio } from "@/services/analyze";
import { translateText, batchTranslateTexts } from "@/services/translate";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { LogOut, User } from "lucide-react";

const Index = () => {
  const { t, i18n } = useTranslation();
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [translations, setTranslations] = useState<{
    transcription?: string;
    reasons?: string[];
    voiceIndicators?: string[];
    voiceDescription?: string;
    scamLabel?: string;
  }>({});
  const [translating, setTranslating] = useState(false);

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

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
      setTranslating(false);
    }
  }, [i18n.language, result]);

  const translateContent = async () => {
    if (!result || i18n.language === 'en') return;

    console.log('🚀 Starting efficient translation process...');
    console.log('🌍 Target language:', i18n.language);
    setTranslating(true);
    const targetLang = getLanguageCode(i18n.language);
    const newTranslations: { transcription?: string; reasons?: string[]; voiceIndicators?: string[]; voiceDescription?: string; scamLabel?: string; } = {};

    try {
      // Collect all texts that need translation
      const textsToTranslate: string[] = [];
      const textMapping: { type: string; index?: number; originalText: string }[] = [];

      // Add transcription
      if (result.transcription) {
        textsToTranslate.push(result.transcription);
        textMapping.push({ type: 'transcription', originalText: result.transcription });
      }

      // Add scam label
      if (result?.scam?.label) {
        const labelText = result.scam.label.replace("_", " ");
        textsToTranslate.push(labelText);
        textMapping.push({ type: 'scamLabel', originalText: labelText });
      }

      // Add scam reasons
      if (result.scam?.reasons && Array.isArray(result.scam.reasons)) {
        result.scam.reasons.forEach((reason, index) => {
          textsToTranslate.push(reason);
          textMapping.push({ type: 'reasons', index, originalText: reason });
        });
      }

      // Add voice description
      if (result.voice_analysis?.description) {
        textsToTranslate.push(result.voice_analysis.description);
        textMapping.push({ type: 'voiceDescription', originalText: result.voice_analysis.description });
      }

      // Add voice indicators
      if (result.voice_analysis?.indicators && Array.isArray(result.voice_analysis.indicators)) {
        result.voice_analysis.indicators.forEach((indicator, index) => {
          textsToTranslate.push(indicator);
          textMapping.push({ type: 'voiceIndicators', index, originalText: indicator });
        });
      }

      if (textsToTranslate.length === 0) {
        console.log('No texts to translate');
        setTranslating(false);
        return;
      }

      console.log(`🔄 Batch translating ${textsToTranslate.length} texts in one request...`);

      // Use batch translation API
      const { data: batchData, error: batchError } = await batchTranslateTexts(textsToTranslate, targetLang);

      if (batchError) {
        console.error('❌ Batch translation error:', batchError);
        // Fallback to original texts
        textMapping.forEach((mapping) => {
          if (mapping.type === 'transcription') {
            newTranslations.transcription = mapping.originalText;
          } else if (mapping.type === 'scamLabel') {
            newTranslations.scamLabel = mapping.originalText;
          } else if (mapping.type === 'reasons') {
            if (!newTranslations.reasons) newTranslations.reasons = [];
            newTranslations.reasons[mapping.index!] = mapping.originalText;
          } else if (mapping.type === 'voiceDescription') {
            newTranslations.voiceDescription = mapping.originalText;
          } else if (mapping.type === 'voiceIndicators') {
            if (!newTranslations.voiceIndicators) newTranslations.voiceIndicators = [];
            newTranslations.voiceIndicators[mapping.index!] = mapping.originalText;
          }
        });
      } else if (batchData?.translations) {
        console.log('✅ Batch translation successful');
        
        // Map the results back to their respective fields
        batchData.translations.forEach((translationResult: any, index: number) => {
          const mapping = textMapping[index];
          const translatedText = translationResult.translatedText || mapping.originalText;

          if (mapping.type === 'transcription') {
            newTranslations.transcription = translatedText;
          } else if (mapping.type === 'scamLabel') {
            newTranslations.scamLabel = translatedText;
          } else if (mapping.type === 'reasons') {
            if (!newTranslations.reasons) newTranslations.reasons = [];
            newTranslations.reasons[mapping.index!] = translatedText;
          } else if (mapping.type === 'voiceDescription') {
            newTranslations.voiceDescription = translatedText;
          } else if (mapping.type === 'voiceIndicators') {
            if (!newTranslations.voiceIndicators) newTranslations.voiceIndicators = [];
            newTranslations.voiceIndicators[mapping.index!] = translatedText;
          }
        });
      }

      console.log('🎯 Final translations object:', newTranslations);
      setTranslations(newTranslations);
      console.log('✅ Translations completed successfully');
    } catch (error) {
      console.error('Translation error:', error);
      toast({ 
        title: "Translation Error", 
        description: "Failed to translate content. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setTranslating(false);
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
    setTranslating(false);
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

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render if user is not authenticated (will redirect)
  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="container mx-auto max-w-2xl px-4 py-16">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="text-sm text-muted-foreground">
              {user.email}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Sign Out
            </Button>
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
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
                    <p className="text-sm text-muted-foreground mb-1">
                      {scamLabel ? (
                        currentLang !== 'en' && translations.scamLabel 
                          ? translations.scamLabel 
                          : scamLabel.replace("_", " ")
                      ) : ""}
                    </p>
                    <p className="text-2xl font-bold">{scamProbPercent}%</p>
                    {Array.isArray(result?.scam?.reasons) && result.scam.reasons.length > 0 && (
                      <div className="mt-2">
                        <h3 className="text-sm font-medium mb-1">{t("indicators")}</h3>
                        {translating && currentLang !== 'en' && (!translations.reasons || translations.reasons.length === 0) ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                            <span>Translating...</span>
                          </div>
                        ) : (
                          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                            {result.scam.reasons.map((r: string, idx: number) => (
                              <li key={idx}>
                                {currentLang !== 'en' && translations.reasons?.[idx] ? 
                                  translations.reasons[idx] : 
                                  r
                                }
                              </li>
                            ))}
                          </ul>
                        )}
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
                        <div className="text-sm text-muted-foreground">
                          {translating && currentLang !== 'en' && !translations.voiceDescription ? (
                            <div className="flex items-center gap-2">
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                              <span>Translating description...</span>
                            </div>
                          ) : (
                            <p>
                              {currentLang !== 'en' && translations.voiceDescription ? 
                                translations.voiceDescription : 
                                result.voice_analysis.description
                              }
                            </p>
                          )}
                        </div>
                      )}
                      {Array.isArray(result.voice_analysis.indicators) && result.voice_analysis.indicators.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">{t("indicators")}</p>
                          {translating && currentLang !== 'en' && (!translations.voiceIndicators || translations.voiceIndicators.length === 0) ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                              <span>Translating indicators...</span>
                            </div>
                          ) : (
                            <ul className="list-disc pl-5 text-sm text-muted-foreground">
                              {result.voice_analysis.indicators.map((indicator: string, idx: number) => (
                                <li key={idx}>
                                  {currentLang !== 'en' && translations.voiceIndicators?.[idx] ? 
                                    translations.voiceIndicators[idx] : 
                                    indicator
                                  }
                                </li>
                              ))}
                            </ul>
                          )}
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
                            {translating && !translations.transcription ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                                <span>Translating transcription...</span>
                              </div>
                            ) : translations.transcription ? (
                              <p className="whitespace-pre-wrap text-sm leading-6 bg-primary/10 p-2 rounded">
                                {translations.transcription}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground italic p-2">
                                No translation available
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
