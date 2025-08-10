import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trash2, Calendar, FileAudio, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { 
  AnalysisHistory, 
  getGuestHistory, 
  getUserHistory, 
  deleteUserAnalysis,
  clearGuestHistory 
} from "@/services/history";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const HistoryTab = () => {
  const { user, isGuest } = useAuth();
  const { t } = useTranslation();
  const [history, setHistory] = useState<AnalysisHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadHistory();
  }, [user, isGuest]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      if (isGuest) {
        const guestHistory = getGuestHistory();
        setHistory(guestHistory);
      } else if (user) {
        const { data, error } = await getUserHistory();
        if (error) throw error;
        setHistory(data || []);
      }
      } catch (error) {
        console.error('Failed to load history:', error);
        toast.error(t("history.failedToLoad"));
      } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (isGuest) {
        // For guests, we'd need to implement local deletion
        const guestHistory = getGuestHistory().filter(item => item.id !== id);
        localStorage.setItem('voice_analysis_guest_history', JSON.stringify(guestHistory));
        setHistory(guestHistory);
        toast.success(t("history.analysisDeleted"));
      } else if (user) {
        const { error } = await deleteUserAnalysis(id);
        if (error) throw error;
        await loadHistory(); // Reload after deletion
        toast.success(t("history.analysisDeleted"));
      }
    } catch (error) {
      console.error('Failed to delete analysis:', error);
      toast.error(t("history.failedToDelete"));
    }
  };

  const handleClearAll = () => {
    if (isGuest) {
      clearGuestHistory();
      setHistory([]);
      toast.success(t("history.historyCleared"));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const getScamLevel = (probability: number) => {
    if (probability >= 0.7) return { label: t("history.highRisk"), color: 'destructive' };
    if (probability >= 0.4) return { label: t("history.mediumRisk"), color: 'secondary' };
    return { label: t("history.lowRisk"), color: 'default' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <FileAudio className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">{t("history.noHistory")}</h3>
        <p className="text-sm text-muted-foreground">
          {isGuest 
            ? t("history.guestHistoryDesc")
            : t("history.userHistoryDesc")
          }
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">{t("history.analysisHistory")}</h2>
          <p className="text-sm text-muted-foreground">
            {isGuest 
              ? t("history.guestModeCount", { count: history.length })
              : t("history.analysesCount", { count: history.length })
            }
          </p>
        </div>
        {isGuest && history.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClearAll}>
            {t("history.clearAll")}
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {history.map((item) => {
          const isExpanded = expandedItems.has(item.id);
          return (
            <Card key={item.id} className="relative">
              <Collapsible>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CollapsibleTrigger 
                      className="flex-1 text-left"
                      onClick={() => toggleExpanded(item.id)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <FileAudio className="h-4 w-4" />
                        <CardTitle className="text-sm font-medium hover:text-primary transition-colors">
                          {item.filename}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground ml-6">
                        <Calendar className="h-3 w-3" />
                        {formatDate(item.created_at)}
                        {item.file_size && (
                          <span>• {Math.round(item.file_size / 1024)}KB</span>
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  {/* Always show scam probability summary */}
                   {item.analysis_result?.scam?.probability !== undefined && (
                     <div className="flex items-center gap-2 mb-3">
                       <AlertTriangle className="h-4 w-4" />
                       <span className="text-sm font-medium">{t("scamProbability")}:</span>
                       <Badge variant={getScamLevel(item.analysis_result.scam.probability).color as any}>
                         {Math.round(item.analysis_result.scam.probability * 100)}% - {getScamLevel(item.analysis_result.scam.probability).label}
                       </Badge>
                     </div>
                   )}
                  
                  {/* Show truncated transcription when collapsed */}
                   {!isExpanded && item.analysis_result?.transcription && (
                     <div className="bg-muted/30 p-3 rounded-md">
                       <p className="text-xs font-medium text-muted-foreground mb-1">{t("history.transcriptionPreview")}:</p>
                       <p className="text-sm line-clamp-2">
                         {item.analysis_result.transcription}
                       </p>
                       <Button variant="ghost" size="sm" className="mt-2 p-0 h-auto text-xs text-primary">
                         {t("history.clickToViewFull")}
                       </Button>
                     </div>
                   )}

                  {/* Expanded content */}
                  <CollapsibleContent className="space-y-4">
                     {/* Full transcription */}
                     {item.analysis_result?.transcription && (
                       <div className="bg-muted/30 p-4 rounded-md">
                         <h4 className="text-sm font-medium text-muted-foreground mb-2">{t("history.fullTranscription")}:</h4>
                         <p className="text-sm whitespace-pre-wrap leading-relaxed">
                           {item.analysis_result.transcription}
                         </p>
                       </div>
                     )}

                     {/* Detailed scam analysis */}
                     {item.analysis_result?.scam && (
                       <div className="bg-muted/30 p-4 rounded-md">
                         <h4 className="text-sm font-medium text-muted-foreground mb-2">{t("history.scamAnalysisDetails")}:</h4>
                         {item.analysis_result.scam.label && (
                           <p className="text-sm mb-2">
                             <span className="font-medium">{t("history.classification")}:</span> {item.analysis_result.scam.label.replace("_", " ")}
                           </p>
                         )}
                         {Array.isArray(item.analysis_result.scam.reasons) && item.analysis_result.scam.reasons.length > 0 && (
                           <div>
                             <p className="text-sm font-medium mb-1">{t("indicators")}:</p>
                             <ul className="list-disc pl-5 text-sm space-y-1">
                               {item.analysis_result.scam.reasons.map((reason: string, idx: number) => (
                                 <li key={idx}>{reason}</li>
                               ))}
                             </ul>
                           </div>
                         )}
                       </div>
                     )}

                     {/* Voice analysis details */}
                     {item.analysis_result?.voice_analysis && (
                       <div className="bg-muted/30 p-4 rounded-md">
                         <h4 className="text-sm font-medium text-muted-foreground mb-2">{t("voiceAnalysis")}:</h4>
                         <div className="space-y-2">
                           <div className="flex items-center gap-2">
                             <span className={`inline-block w-3 h-3 rounded-full ${item.analysis_result.voice_analysis.sounds_artificial ? 'bg-red-500' : 'bg-green-500'}`}></span>
                             <span className="text-sm">
                               {item.analysis_result.voice_analysis.sounds_artificial ? t("artificialVoiceDetected") : t("naturalVoice")}
                             </span>
                             {item.analysis_result.voice_analysis.confidence > 0 && (
                               <span className="text-xs text-muted-foreground">
                                 ({t("confidence", { percent: Math.round(item.analysis_result.voice_analysis.confidence * 100) })})
                               </span>
                             )}
                           </div>
                           
                           {item.analysis_result.voice_analysis.description && (
                             <p className="text-sm">
                               <span className="font-medium">{t("history.analysis")}:</span> {item.analysis_result.voice_analysis.description}
                             </p>
                           )}
                           
                           {Array.isArray(item.analysis_result.voice_analysis.indicators) && item.analysis_result.voice_analysis.indicators.length > 0 && (
                             <div>
                               <p className="text-sm font-medium mb-1">{t("history.voiceIndicators")}:</p>
                               <ul className="list-disc pl-5 text-sm space-y-1">
                                 {item.analysis_result.voice_analysis.indicators.map((indicator: string, idx: number) => (
                                   <li key={idx}>{indicator}</li>
                                 ))}
                               </ul>
                             </div>
                           )}
                         </div>
                       </div>
                     )}
                  </CollapsibleContent>
                </CardContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
};