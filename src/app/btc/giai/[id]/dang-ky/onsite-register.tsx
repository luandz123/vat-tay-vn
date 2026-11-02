'use client';

import { useRef, useState, useTransition } from 'react';
import { onsiteRegisterAction } from '@/app/btc/manage-actions';
import { Alert, Button, Field, cx, inputClass } from '@/components/ui';
import { HAND_LABEL, type Hand } from '@/server/tournaments/templates';

interface Cat {
  id: string;
  hand: Hand;
  gender: 'male' | 'female' | 'open';
  label: string;
}

/** BTC thêm VĐV ngay tại sân (giá tại sân, tự duyệt, có thể ghi tiền mặt luôn). */
export function OnsiteRegister({ tournamentId, categories }: { tournamentId: string; categories: Cat[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const empty = { fullName: '', phone: '', birthYear: '', club: '' };
  const [v, setV] = useState(empty);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [picked, setPicked] = useState<string[]>([]);
  const [cash, setCash] = useState(true);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string }>();
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const available = categories.filter((c) => c.gender === 'open' || c.gender === gender);

  return (
    <>
      <Button variant="primary" onClick={() => ref.current?.showModal()}>+ Đăng ký tại sân</Button>
      <dialog ref={ref} className="m-auto w-[min(36rem,calc(100%-2rem))] border border-line-strong bg-surface p-5 text-fg backdrop:bg-black/70">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await onsiteRegisterAction(tournamentId, { ...v, gender, categoryIds: picked }, cash);
              if (r.ok) {
                setMsg({ tone: 'success', text: `Đã thêm ${v.fullName} (${r.data.code}).` });
                setV(empty);
                setPicked([]);
                setFields({});
              } else {
                setMsg({ tone: 'error', text: r.error });
                setFields(r.fields ?? {});
              }
            });
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="display text-2xl">Đăng ký tại sân</h2>
            <button type="button" aria-label="Đóng" onClick={() => ref.current?.close()} className="size-10 text-xl text-fg-2">✕</button>
          </div>
          <Field label="Họ tên" error={fields.fullName}><input className={inputClass} value={v.fullName} onChange={set('fullName')} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SĐT" error={fields.phone}><input className={inputClass} value={v.phone} onChange={set('phone')} inputMode="tel" required /></Field>
            <Field label="Năm sinh" error={fields.birthYear}><input className={inputClass} value={v.birthYear} onChange={set('birthYear')} inputMode="numeric" required /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CLB"><input className={inputClass} value={v.club} onChange={set('club')} /></Field>
            <div className="flex flex-col gap-1.5 text-sm text-fg-2">
              Giới tính
              <div className="flex h-11">
                {(['male', 'female'] as const).map((g) => (
                  <button key={g} type="button" aria-pressed={gender === g} onClick={() => { setGender(g); setPicked([]); }} className={cx('flex-1 border border-line-strong font-bold', gender === g ? 'bg-fg text-bg' : 'text-fg')}>
                    {g === 'male' ? 'Nam' : 'Nữ'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {(['right', 'left'] as const).map((h) => {
            const list = available.filter((c) => c.hand === h);
            if (!list.length) return null;
            return (
              <fieldset key={h} className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-semibold">{HAND_LABEL[h]}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((c) => {
                    const on = picked.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setPicked(on ? picked.filter((x) => x !== c.id) : [...picked.filter((x) => categories.find((y) => y.id === x)?.hand !== h), c.id])}
                        className={cx('min-h-10 min-w-16 border px-2 font-display font-bold', on ? 'border-brand bg-brand text-white' : 'border-line-strong')}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={cash} onChange={(e) => setCash(e.target.checked)} className="size-5 accent-[var(--brand)]" />
            Đã thu tiền mặt đủ lệ phí (giá tại sân)
          </label>
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <Button type="submit" variant="primary" disabled={pending || picked.length === 0}>{pending ? 'Đang lưu…' : 'Thêm VĐV'}</Button>
        </form>
      </dialog>
    </>
  );
}
