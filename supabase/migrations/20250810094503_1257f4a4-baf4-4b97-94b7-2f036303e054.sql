-- Fix the function security warning by setting search_path
CREATE OR REPLACE FUNCTION public.update_translation_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;