'use client';

import { useEffect, useState } from 'react';

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [
    { v: Math.floor(s / 86400), l: 'ngày' },
    { v: Math.floor((s % 86400) / 3600), l: 'giờ' },
    { v: Math.floor((s % 3600) / 60), l: 'phút' },
    { v: s % 60, l: 'giây' },
  ];
}

export function Countdown({ to }: { to: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now !== null && now >= target) return null;
  return (
    <div className="grid w-full grid-cols-4 gap-1.5" aria-label="Thời gian còn lại">
      {parts(now === null ? 0 : target - now).map((p) => (
        <div key={p.l} className="flex flex-col items-center border-2 border-fg pb-1.5 pt-2">
          <span className="font-display text-3xl font-semibold leading-none tabular-nums">{now === null ? '--' : String(p.v).padStart(2, '0')}</span>
          <span className="text-[11px] uppercase tracking-widest text-fg-2">{p.l}</span>
        </div>
      ))}
    </div>
  );
}
