/**
 * Lớp bọc lưu file. Chỉ file này được import Supabase Storage.
 * DB chỉ lưu key (ví dụ `tournaments/<id>/cover-<ts>.jpg`); URL dựng ở đây.
 * Khi chuyển sang R2/S3: đổi thân hàm, key trong DB giữ nguyên.
 */
import { createClient } from '@supabase/supabase-js';

const PUBLIC_BUCKET = 'public-images';

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

/** URL công khai của ảnh từ key. */
export function publicUrl(key: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PUBLIC_BUCKET}/${key}`;
}

/** Server: tạo URL upload một lần cho trình duyệt (sau khi đã kiểm tra quyền). */
export async function createUploadUrl(key: string): Promise<{ uploadUrl: string; token: string; key: string }> {
  const { data, error } = await adminClient().storage.from(PUBLIC_BUCKET).createSignedUploadUrl(key);
  if (error) throw error;
  return { uploadUrl: data.signedUrl, token: data.token, key };
}

export async function deleteObject(key: string): Promise<void> {
  const { error } = await adminClient().storage.from(PUBLIC_BUCKET).remove([key]);
  if (error) throw error;
}
