'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Button, buttonClass } from '@/components/ui';

function useCopy() {
  const [copied, setCopied] = useState<string>();
  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Trình duyệt nhúng (Zalo/Facebook) có thể chặn clipboard API: dùng cách cũ.
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(id);
    setTimeout(() => setCopied(undefined), 2000);
  }
  return { copied, copy };
}

/** Nút chia sẻ nhanh: Facebook, Messenger, Zalo (copy link), copy link, bài đăng mẫu, mã QR. */
export function ShareTools({ url, title, post, slug, tone = 'dark' }: { url: string; title: string; post?: string | null; slug: string; tone?: 'dark' | 'brand' }) {
  const { copied, copy } = useCopy();
  const [qr, setQr] = useState<string>();
  useEffect(() => {
    QRCode.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(undefined));
  }, [url]);

  const enc = encodeURIComponent(url);
  const btn = tone === 'brand' ? 'min-h-11 bg-white px-3 font-bold text-[#b01e25] flex items-center justify-center' : buttonClass('secondary');

  async function nativeShare() {
    if (navigator.share) await navigator.share({ title, url }).catch(() => undefined);
    else await copy('link', url);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <a className={btn} href={`https://www.facebook.com/sharer/sharer.php?u=${enc}`} target="_blank" rel="noreferrer">
          Facebook
        </a>
        <a className={btn} href={`fb-messenger://share/?link=${enc}`}>
          Messenger
        </a>
        <button type="button" className={btn} onClick={nativeShare}>
          {copied === 'link' ? 'Đã copy link!' : 'Zalo / khác'}
        </button>
        <button type="button" className={btn} onClick={() => copy('link', url)}>
          {copied === 'link' ? 'Đã copy!' : 'Copy link'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {post && (
          <Button onClick={() => copy('post', post)} className={tone === 'brand' ? 'border-white text-white' : undefined}>
            {copied === 'post' ? 'Đã copy bài đăng!' : 'Copy bài đăng mẫu'}
          </Button>
        )}
        {qr && (
          <a href={qr} download={`qr-${slug}.png`} className={buttonClass('secondary', tone === 'brand' ? 'border-white text-white' : undefined)}>
            Tải mã QR giải
          </a>
        )}
      </div>
    </div>
  );
}
