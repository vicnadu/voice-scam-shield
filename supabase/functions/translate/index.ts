import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, targetLanguage, sourceLanguage = 'auto' } = await req.json();
    
    if (!text || !targetLanguage) {
      throw new Error('Text and target language are required');
    }

    // Skip translation if target language is English (assumed source for most content)
    if (targetLanguage === 'en') {
      return new Response(
        JSON.stringify({ 
          translatedText: text,
          sourceLanguage: sourceLanguage,
          targetLanguage: targetLanguage 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const googleTranslateApiKey = Deno.env.get('GOOGLE_TRANSLATE_API_KEY');
    
    if (!googleTranslateApiKey) {
      throw new Error('Google Translate API key not configured');
    }

    // Use Google Translate API
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${googleTranslateApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          target: targetLanguage,
          source: sourceLanguage,
          format: 'text'
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Translate API error:', errorText);
      throw new Error(`Translation failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const translatedText = result.data.translations[0].translatedText;
    const detectedSourceLanguage = result.data.translations[0].detectedSourceLanguage || sourceLanguage;

    return new Response(
      JSON.stringify({ 
        translatedText,
        sourceLanguage: detectedSourceLanguage,
        targetLanguage: targetLanguage 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Translation error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        translatedText: null 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});