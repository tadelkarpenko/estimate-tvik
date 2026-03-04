import { supabase } from '@/integrations/supabase/client';

const ALLOWED_TYPES = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export interface UploadResult {
  url: string;
  path: string;
}

export function validateMediaFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Invalid file type. Only PNG, JPG, JPEG, WEBP are allowed.';
  if (file.size > MAX_SIZE) return 'File too large. Maximum size is 10MB.';
  return null;
}

export async function uploadMediaFile(file: File, folder: 'estimates' | 'contracts'): Promise<UploadResult> {
  const error = validateMediaFile(file);
  if (error) throw new Error(error);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${user.id}/${folder}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from('media').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);

  return { url: publicUrl, path };
}

export async function uploadMultipleFiles(files: File[], folder: 'estimates' | 'contracts'): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  for (const file of files) {
    results.push(await uploadMediaFile(file, folder));
  }
  return results;
}
