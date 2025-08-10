import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Calendar, FileAudio, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { 
  AnalysisHistory, 
  getGuestHistory, 
  getUserHistory, 
  deleteUserAnalysis,
  clearGuestHistory 
} from "@/services/history";
import { toast } from "sonner";

export const HistoryTab = () => {
  const { user, isGuest } = useAuth();
  const [history, setHistory] = useState<AnalysisHistory[]>([]);
  const [loading, setLoading] = useState(true);

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
      toast.error("Failed to load history");
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
        toast.success("Analysis deleted");
      } else if (user) {
        const { error } = await deleteUserAnalysis(id);
        if (error) throw error;
        await loadHistory(); // Reload after deletion
        toast.success("Analysis deleted");
      }
    } catch (error) {
      console.error('Failed to delete analysis:', error);
      toast.error("Failed to delete analysis");
    }
  };

  const handleClearAll = () => {
    if (isGuest) {
      clearGuestHistory();
      setHistory([]);
      toast.success("History cleared");
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

  const getScamLevel = (probability: number) => {
    if (probability >= 0.7) return { label: 'High Risk', color: 'destructive' };
    if (probability >= 0.4) return { label: 'Medium Risk', color: 'secondary' };
    return { label: 'Low Risk', color: 'default' };
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
        <h3 className="text-lg font-medium text-muted-foreground mb-2">No Analysis History</h3>
        <p className="text-sm text-muted-foreground">
          {isGuest 
            ? "Your analysis history will appear here (last 10 analyses)" 
            : "Your voice analysis history will appear here"
          }
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Analysis History</h2>
          <p className="text-sm text-muted-foreground">
            {isGuest 
              ? `${history.length} of 10 analyses (guest mode)`
              : `${history.length} analyses`
            }
          </p>
        </div>
        {isGuest && history.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClearAll}>
            Clear All
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {history.map((item) => (
          <Card key={item.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileAudio className="h-4 w-4" />
                    {item.filename}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDate(item.created_at)}
                    {item.file_size && (
                      <span>• {Math.round(item.file_size / 1024)}KB</span>
                    )}
                  </div>
                </div>
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
              {item.analysis_result?.scam?.probability !== undefined && (
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Scam Probability:</span>
                  <Badge variant={getScamLevel(item.analysis_result.scam.probability).color as any}>
                    {Math.round(item.analysis_result.scam.probability * 100)}% - {getScamLevel(item.analysis_result.scam.probability).label}
                  </Badge>
                </div>
              )}
              
              {item.analysis_result?.transcription && (
                <div className="bg-muted/30 p-3 rounded-md">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Transcription:</p>
                  <p className="text-sm line-clamp-3">
                    {item.analysis_result.transcription}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};