import { supabase } from "@/integrations/supabase/client";

export async function translateText(text: string, targetLanguage: string, sourceLanguage: string = 'auto') {
  const { data, error } = await supabase.functions.invoke("translate", {
    body: {
      text,
      targetLanguage,
      sourceLanguage,
    },
  });

  return { data, error };
}