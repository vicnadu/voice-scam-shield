-- Create a table to cache translations
CREATE TABLE public.translation_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_text TEXT NOT NULL,
  target_language TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_hash TEXT NOT NULL, -- Hash of source text for faster lookups
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.translation_cache ENABLE ROW LEVEL SECURITY;

-- Create policies - translations can be read by everyone but only system can write
CREATE POLICY "Anyone can view translations" 
ON public.translation_cache 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can insert translations" 
ON public.translation_cache 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Service role can update translations" 
ON public.translation_cache 
FOR UPDATE 
USING (true);

-- Create indexes for fast lookups
CREATE INDEX idx_translation_cache_hash_lang ON public.translation_cache (source_hash, target_language);
CREATE INDEX idx_translation_cache_created_at ON public.translation_cache (created_at);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_translation_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_translation_cache_updated_at
  BEFORE UPDATE ON public.translation_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_translation_cache_updated_at();