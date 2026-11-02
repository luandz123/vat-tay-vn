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

/** Quét QR vé bằng camera (BarcodeDetector — Chrome/Android). Trình duyệt không hỗ trợ thì dùng ô tìm kiếm. */
export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!window.BarcodeDetector) {
      setError('Trình duyệt này chưa hỗ trợ quét QR. Hãy dùng Chrome trên Android, hoặc tìm theo tên/SĐT.');
      return;
    }
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    let stream: MediaStream | undefined;
    let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        while (!stop) {
          const codes = await detector.detect(video.current).catch(() => []);
          if (codes[0]?.rawValue) {
            onResult(codes[0].rawValue);
            return;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setError('Không mở được camera. Hãy cấp quyền camera cho trang này.');
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-sm text-gold">{error}</p> : <video ref={video} className="aspect-square w-full bg-black object-cover" muted playsInline />}
      <button type="button" onClick={onClose} className="min-h-10 border border-line-strong font-semibold">Đóng camera</button>
    </div>
  );
}
