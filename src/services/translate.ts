import { supabase } from "@/integrations/supabase/client";

export async function translateText(text: string, targetLanguage: string, sourceLanguage: string = 'auto') {
  console.log('🌐 Translation service called:', { text: text.substring(0, 50) + '...', targetLanguage, sourceLanguage });
  
  const { data, error } = await supabase.functions.invoke("translate", {
    body: {
      text,
      targetLanguage,
      sourceLanguage,
    },
  });

  console.log('🌐 Translation service response:', { data, error });
  return { data, error };
}

export async function batchTranslateTexts(texts: string[], targetLanguage: string, sourceLanguage: string = 'auto') {
  console.log('🌐 Batch translation service called:', { textCount: texts.length, targetLanguage, sourceLanguage });
  
  const { data, error } = await supabase.functions.invoke("translate", {
    body: {
      texts,
      targetLanguage,
      sourceLanguage,
    },
  });

  console.log('🌐 Batch translation service response:', { data, error });
  return { data, error };
}