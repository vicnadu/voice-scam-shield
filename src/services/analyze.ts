import { supabase } from "@/integrations/supabase/client";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix if present
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function analyzeAudio(file: File) {
  const base64 = await fileToBase64(file);

  const { data, error } = await supabase.functions.invoke("analyze", {
    body: {
      audio: base64,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    },
  });

  return { data, error };
}
