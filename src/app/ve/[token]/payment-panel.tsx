'use client';

import QRCode from 'qrcode';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatVnd } from '@/server/shared/time';

export function QrImage({ text, label, size = 240, dark = '#0B0C10' }: { text: string; label: string; size?: number; dark?: string }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    QRCode.toDataURL(text, { width: size * 2, margin: 1, errorCorrectionLevel: 'M', color: { dark, light: '#ffffff' } }).then(setSrc);
  }, [text, size, dark]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={label} width={size} height={size} /> : <div style={{ width: size, height: size }} aria-label={label} />;
}

function CopyRow({ k, v, copy }: { k: string; v: string; copy?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-3 last:border-b-0">
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-xs text-muted">{k}</span>
        <span className="font-bold">{v}</span>
      </div>
      {copy && (
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(copy).catch(() => undefined);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          }}
          className="min-h-9 min-w-16 border border-line-strong text-sm font-bold text-brand-text"
          aria-label={`Sao chép ${k}`}
        >
          {done ? 'Đã copy' : 'Copy'}
        </button>
      )}
    </div>
  );
}

export function PaymentPanel({
  token,
  payload,
  remaining,
  bankName,
  accountNo,
  accountName,
  transferRef,
}: {
  token: string;
  payload: string;
  remaining: number;
  bankName: string;
  accountNo: string;
  accountName: string;
  transferRef: string;
}) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.hidden) return;
      const res = await fetch(`/api/ve/${token}`, { cache: 'no-store' }).catch(() => null);
      const s = res?.ok ? ((await res.json()) as { paymentStatus: string; amountPaid: number }) : null;
      if (s && (s.paymentStatus === 'paid' || s.amountPaid > 0)) router.refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [token, router]);

  return (
    <section className="flex flex-col gap-4 px-4 pt-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-sm text-fg-2">Quét mã bằng app ngân hàng bất kỳ</span>
        <span className="font-display text-5xl font-bold leading-none">{formatVnd(remaining)}</span>
        <div className="flex flex-col items-center gap-2 bg-white p-4">
          <QrImage text={payload} label={`Mã VietQR chuyển ${formatVnd(remaining)} cho BTC`} />
          <span className="text-xs font-bold tracking-widest text-bg">VIETQR · NAPAS 247</span>
        </div>
      </div>
      <div className="flex flex-col border border-line bg-surface">
        <CopyRow k="Ngân hàng" v={bankName} />
        <CopyRow k="Số tài khoản" v={accountNo} copy={accountNo} />
        <CopyRow k="Chủ tài khoản" v={accountName} />
        <CopyRow k="Số tiền" v={formatVnd(remaining)} copy={String(remaining)} />
        <CopyRow k="Nội dung chuyển khoản (bắt buộc)" v={transferRef} copy={transferRef} />
      </div>
      <div className="flex items-center gap-3 bg-surface-2 p-3.5 text-sm" role="status">
        <span className="size-3 shrink-0 animate-pulse rounded-full bg-gold" />
        <span>Đang chờ tiền về tài khoản BTC… Trạng thái tự cập nhật, không cần gửi ảnh chụp. Nếu BTC chưa bật đối soát tự động, BTC sẽ xác nhận tay.</span>
      </div>
      <p className="text-xs text-muted">Tiền chuyển thẳng vào tài khoản của BTC. VậtTay.vn không giữ tiền hộ.</p>
    </section>
  );
}
