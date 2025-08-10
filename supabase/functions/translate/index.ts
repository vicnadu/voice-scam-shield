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

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    // Language mapping for better translation context
    const languageNames: { [key: string]: string } = {
      'es': 'Spanish',
      'fr': 'French', 
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'zh': 'Chinese',
      'ko': 'Korean',
      'ar': 'Arabic',
      'hi': 'Hindi'
    };

    const targetLanguageName = languageNames[targetLanguage] || targetLanguage;

    // Use Gemini for translation
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Translate the following text to ${targetLanguageName}. Only return the translation, no explanations or additional text:

${text}`
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Translation failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const translatedText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!translatedText) {
      throw new Error('No translation received from Gemini');
    }

    return new Response(
      JSON.stringify({ 
        translatedText,
        sourceLanguage: sourceLanguage,
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