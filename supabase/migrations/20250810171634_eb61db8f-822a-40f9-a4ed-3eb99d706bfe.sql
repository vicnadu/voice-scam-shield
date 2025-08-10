-- Remove overly permissive translation cache policy
DROP POLICY IF EXISTS "Anyone can view translations" ON public.translation_cache;

-- Create more restrictive policies for translation_cache
-- Only service role can read translations (for the translate function)
CREATE POLICY "Service role can read translations" 
ON public.translation_cache 
FOR SELECT 
USING (auth.jwt() ->> 'role' = 'service_role');

-- Keep existing policies for service role insert/update
-- (they're already secure)