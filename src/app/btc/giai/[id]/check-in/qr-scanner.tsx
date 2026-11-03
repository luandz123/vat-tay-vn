'use client';

import { useEffect, useRef, useState } from 'react';

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

/**
 * Quét QR vé bằng camera. Dùng BarcodeDetector (Chrome/Android) nếu có, ngược lại (Safari iPhone,
 * Firefox) đọc khung hình qua canvas bằng jsQR. Không mở được camera thì dùng ô tìm kiếm.
 */
export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let stream: MediaStream | undefined;
    let stop = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no-camera');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        const v = video.current;
        if (!v) return;
        v.srcObject = stream;
        v.setAttribute('playsinline', 'true'); // iOS: không tự mở toàn màn hình
        await v.play();

        let detect: () => Promise<string | null>;
        if (window.BarcodeDetector) {
          const d = new window.BarcodeDetector({ formats: ['qr_code'] });
          detect = async () => (await d.detect(v).catch(() => []))[0]?.rawValue ?? null;
        } else {
          const { default: jsQR } = await import('jsqr');
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
          detect = async () => {
            if (!v.videoWidth) return null;
            // Thu nhỏ khung hình cho nhanh trên điện thoại
            const scale = Math.min(1, 640 / v.videoWidth);
            canvas.width = Math.round(v.videoWidth * scale);
            canvas.height = Math.round(v.videoHeight * scale);
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
          };
        }
        while (!stop) {
          const text = await detect();
          if (text) {
            onResult(text);
            return;
          }
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch {
        setError('Không mở được camera. Hãy cấp quyền camera cho trang này (Safari: aA → Cài đặt trang web → Camera), hoặc tìm theo tên/SĐT.');
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p className="text-sm text-gold">{error}</p>
      ) : (
        <div className="relative">
          <video ref={video} className="aspect-square w-full bg-black object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-[18%] border-4 border-white/80" aria-hidden="true" />
        </div>
      )}
      <button type="button" onClick={onClose} className="min-h-10 border border-line-strong font-semibold">Đóng camera</button>
    </div>
  );
}
