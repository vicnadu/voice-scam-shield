import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create a hash function for text caching
function createHash(text: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    
    // Support both single text and batch translations
    const isBatch = Array.isArray(requestBody.texts);
    const texts = isBatch ? requestBody.texts : [requestBody.text];
    const { targetLanguage, sourceLanguage = 'auto' } = requestBody;
    
    if (!texts.length || !targetLanguage) {
      return new Response(
        JSON.stringify({ error: 'Text(s) and target language are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip translation if target language is English
    if (targetLanguage === 'en') {
      const results = texts.map(text => ({
        translatedText: text,
        sourceLanguage,
        targetLanguage
      }));
      return new Response(
        JSON.stringify(isBatch ? { translations: results } : results[0]),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client for caching
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = [];
    const textsToTranslate = [];
    const textIndices = [];

    console.log(`Processing ${texts.length} text(s) for translation to ${targetLanguage}`);

    // Check cache for each text
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (!text || text.trim() === '') {
        results[i] = { translatedText: text, cached: true };
        continue;
      }

      const sourceHash = createHash(text);
      
      // Look up in cache
      const { data: cached } = await supabase
        .from('translation_cache')
        .select('translated_text')
        .eq('source_hash', sourceHash)
        .eq('target_language', targetLanguage)
        .single();

      if (cached) {
        console.log(`Cache hit for text ${i + 1}`);
        results[i] = { translatedText: cached.translated_text, cached: true };
      } else {
        console.log(`Cache miss for text ${i + 1}, queuing for translation`);
        textsToTranslate.push(text);
        textIndices.push(i);
      }
    }

    // If all texts were cached, return early
    if (textsToTranslate.length === 0) {
      console.log('All translations found in cache');
      return new Response(
        JSON.stringify(isBatch ? { translations: results } : results[0]),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Translate uncached texts
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      // Return original texts as fallback
      for (const idx of textIndices) {
        results[idx] = { 
          translatedText: texts[idx],
          fallback: true,
          error: 'Translation service not configured'
        };
      }
      return new Response(
        JSON.stringify(isBatch ? { translations: results } : results[0]),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    // Batch translate multiple texts in one API call if more than one
    let translatedTexts: string[];
    
    if (textsToTranslate.length === 1) {
      // Single text translation
      console.log('Translating single text...');
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Translate the following text to ${targetLanguageName}. Only return the translation, no explanations or additional text:

${textsToTranslate[0]}`
              }]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2048,
            }
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', errorText);
        
        if (response.status === 429) {
          console.log('Gemini API quota exceeded, returning original text');
          for (const idx of textIndices) {
            results[idx] = { 
              translatedText: texts[idx],
              sourceLanguage,
              targetLanguage,
              fallback: true,
              error: 'Translation quota exceeded, showing original text'
            };
          }
          return new Response(
            JSON.stringify(isBatch ? { translations: results } : results[0]),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        throw new Error(`Translation failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const translatedText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      translatedTexts = [translatedText || textsToTranslate[0]];
    } else {
      // Batch translation
      console.log(`Batch translating ${textsToTranslate.length} texts...`);
      const combinedText = textsToTranslate.map((text, idx) => 
        `[${idx + 1}] ${text}`
      ).join('\n\n');

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Translate the following numbered texts to ${targetLanguageName}. Maintain the same numbering format [1], [2], etc. and return each translation on separate lines with the same numbers. Only return the translated texts with their numbers, no additional formatting or explanation:

${combinedText}`
              }]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 4096,
            }
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', errorText);
        
        if (response.status === 429) {
          console.log('Gemini API quota exceeded, returning original texts');
          for (const idx of textIndices) {
            results[idx] = { 
              translatedText: texts[idx],
              sourceLanguage,
              targetLanguage,
              fallback: true,
              error: 'Translation quota exceeded, showing original text'
            };
          }
          return new Response(
            JSON.stringify(isBatch ? { translations: results } : results[0]),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        throw new Error(`Translation failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const translatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!translatedText) {
        throw new Error('No translation received from Gemini');
      }

      // Parse the batch response
      const translatedLines = translatedText.split('\n').filter(line => line.trim());
      translatedTexts = [];

      for (const line of translatedLines) {
        const match = line.match(/^\[(\d+)\]\s*(.+)$/);
        if (match) {
          const index = parseInt(match[1]) - 1;
          const translation = match[2].trim();
          translatedTexts[index] = translation;
        }
      }

      // Fill any missing translations with original text
      for (let i = 0; i < textsToTranslate.length; i++) {
        if (!translatedTexts[i]) {
          translatedTexts[i] = textsToTranslate[i];
        }
      }
    }

    // Store translations in cache and update results
    for (let i = 0; i < textsToTranslate.length; i++) {
      const originalIdx = textIndices[i];
      const translation = translatedTexts[i];
      
      results[originalIdx] = {
        translatedText: translation,
        sourceLanguage,
        targetLanguage
      };

      // Cache the translation
      const sourceHash = createHash(textsToTranslate[i]);
      await supabase
        .from('translation_cache')
        .insert({
          source_text: textsToTranslate[i],
          source_hash: sourceHash,
          target_language: targetLanguage,
          translated_text: translation
        })
        .then(result => {
          if (result.error) {
            console.error('Cache insertion error:', result.error);
          } else {
            console.log(`Cached translation for text ${i + 1}`);
          }
        });
    }

    console.log('Translation completed successfully');

    return new Response(
      JSON.stringify(isBatch ? { translations: results } : results[0]),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Translation error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Translation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});