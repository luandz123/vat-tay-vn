'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { createImageUploadsAction, saveImagesAction } from '@/app/btc/actions';
import { Alert, Button } from '@/components/ui';

const OG_W = 1200;
const OG_H = 628; // tỉ lệ 1.91:1 cho Facebook/Zalo/Messenger
const MAX_BYTES = 5 * 1024 * 1024;

async function cropToJpeg(src: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width = OG_W;
  canvas.height = OG_H;
  canvas.getContext('2d')!.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, OG_W, OG_H);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('crop'))), 'image/jpeg', 0.88));
}

async function put(url: string, body: Blob, type: string) {
  const res = await fetch(url, { method: 'PUT', body, headers: { 'content-type': type, 'x-upsert': 'false' } });
  if (!res.ok) throw new Error(`Upload lỗi ${res.status}`);
}

export function CoverUploader({ tournamentId, coverUrl, ogUrl }: { tournamentId: string; coverUrl: string | null; ogUrl: string | null }) {
  const router = useRouter();
  const [file, setFile] = useState<File>();
  const [src, setSrc] = useState<string>();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const onComplete = useCallback((_: Area, px: Area) => setArea(px), []);

  function pick(f: File | undefined) {
    setError(undefined);
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return setError('Chỉ nhận ảnh JPG, PNG hoặc WebP');
    if (f.size > MAX_BYTES) return setError('Ảnh tối đa 5MB');
    setFile(f);
    setSrc(URL.createObjectURL(f));
    setZoom(1);
  }

  async function upload() {
    if (!file || !src || !area) return;
    setBusy(true);
    setError(undefined);
    try {
      const og = await cropToJpeg(src, area);
      const r = await createImageUploadsAction(tournamentId, file.type);
      if (!r.ok) throw new Error(r.error);
      await Promise.all([put(r.data.cover.uploadUrl, file, file.type), put(r.data.og.uploadUrl, og, 'image/jpeg')]);
      const s = await saveImagesAction(tournamentId, { coverKey: r.data.cover.key, ogKey: r.data.og.key });
      if (!s.ok) throw new Error(s.error);
      setSrc(undefined);
      setFile(undefined);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tải ảnh thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {src ? (
        <>
          <div className="relative h-72 w-full bg-black sm:h-96">
            <Cropper image={src} crop={crop} zoom={zoom} aspect={OG_W / OG_H} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onComplete} />
          </div>
          <label className="flex items-center gap-3 text-sm text-fg-2">
            Phóng to
            <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
          </label>
          <p className="text-xs text-muted">Khung này là ảnh xem trước khi dán link vào Facebook, Zalo, Messenger. Ảnh gốc vẫn được giữ làm poster.</p>
          <div className="flex gap-2">
            <Button variant="primary" disabled={busy || !area} onClick={upload}>
              {busy ? 'Đang tải lên…' : 'Dùng ảnh này'}
            </Button>
            <Button disabled={busy} onClick={() => setSrc(undefined)}>
              Hủy
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          {ogUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ogUrl} alt="Ảnh xem trước khi chia sẻ" className="aspect-[1.91/1] w-full max-w-xl object-cover" />
          ) : (
            <div className="flex aspect-[1.91/1] w-full max-w-xl items-center justify-center border border-dashed border-line-strong text-sm text-muted">
              Chưa có ảnh bìa
            </div>
          )}
          {coverUrl && (
            <a href={coverUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-text hover:underline">
              Xem ảnh gốc / poster
            </a>
          )}
          <label className="inline-flex min-h-11 w-fit cursor-pointer items-center border border-line-strong px-4 font-semibold hover:bg-surface-2">
            {ogUrl ? 'Đổi ảnh bìa' : 'Chọn ảnh bìa / poster *'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
