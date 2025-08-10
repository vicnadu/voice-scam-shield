import { supabase } from "@/integrations/supabase/client";

export interface AnalysisHistory {
  id: string;
  filename: string;
  file_size?: number;
  analysis_result: any;
  created_at: string;
}

// Guest history management (localStorage)
const GUEST_HISTORY_KEY = 'voice_analysis_guest_history';
const MAX_GUEST_HISTORY = 10;

export const saveGuestAnalysis = (filename: string, fileSize: number, result: any) => {
  const history = getGuestHistory();
  const newEntry: AnalysisHistory = {
    id: Date.now().toString(),
    filename,
    file_size: fileSize,
    analysis_result: result,
    created_at: new Date().toISOString()
  };
  
  // Add to beginning and limit to MAX_GUEST_HISTORY
  const updatedHistory = [newEntry, ...history].slice(0, MAX_GUEST_HISTORY);
  localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(updatedHistory));
  
  return newEntry;
};

export const getGuestHistory = (): AnalysisHistory[] => {
  try {
    const stored = localStorage.getItem(GUEST_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const clearGuestHistory = () => {
  localStorage.removeItem(GUEST_HISTORY_KEY);
};

// Authenticated user history management (Supabase)
export const saveUserAnalysis = async (filename: string, fileSize: number, result: any) => {
  const { data, error } = await supabase
    .from('voice_analysis_history')
    .insert({
      filename,
      file_size: fileSize,
      analysis_result: result,
      user_id: (await supabase.auth.getUser()).data.user?.id
    })
    .select()
    .single();

  return { data, error };
};

export const getUserHistory = async () => {
  const { data, error } = await supabase
    .from('voice_analysis_history')
    .select('*')
    .order('created_at', { ascending: false });

  return { data, error };
};

export const deleteUserAnalysis = async (id: string) => {
  const { error } = await supabase
    .from('voice_analysis_history')
    .delete()
    .eq('id', id);

  return { error };
};