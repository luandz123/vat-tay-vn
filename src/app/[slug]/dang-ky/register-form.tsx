'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Alert, cx, inputClass } from '@/components/ui';
import { totalFee } from '@/server/registration/fees';
import { formatVnd } from '@/server/shared/time';
import { HAND_LABEL, type Hand } from '@/server/tournaments/templates';
import { registerAction } from './actions';

interface Cat {
  id: string;
  hand: Hand;
  gender: 'male' | 'female' | 'open';
  label: string;
  birthYearMin: number | null;
  birthYearMax: number | null;
  full: boolean;
  session: string | null;
}

export function RegisterForm({
  slug,
  tournamentName,
  closed,
  categories,
  tier,
}: {
  slug: string;
  tournamentName: string;
  closed: boolean;
  categories: Cat[];
  tier: { name: string; singleHandPrice: number; bothHandsPrice: number | null } | null;
}) {
  const router = useRouter();
  const [v, setV] = useState({ fullName: '', phone: '', email: '', birthYear: '', club: '', website: '' });
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [picked, setPicked] = useState<Partial<Record<Hand, string>>>({});
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  const available = categories.filter((c) => c.gender === 'open' || c.gender === gender);
  const hands = (['right', 'left'] as const).filter((h) => available.some((c) => c.hand === h));
  const chosen = Object.values(picked)
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is Cat => !!c);
  const total = tier ? totalFee(chosen.map((c) => ({ hand: c.hand })), tier) : 0;
  const combo = chosen.length === 2 && tier?.bothHandsPrice != null && total < 2 * tier.singleHandPrice;

  function submit() {
    setError(undefined);
    start(async () => {
      const r = await registerAction(slug, { ...v, gender, categoryIds: chosen.map((c) => c.id), consent });
      if (r.ok) router.push(`/ve/${r.data.token}`);
      else {
        setError(r.error);
        setFields(r.fields ?? {});
      }
    });
  }

  if (closed)
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 text-center">
        <h1 className="display text-4xl">Đã đóng đăng ký online</h1>
        <p className="text-fg-2">Liên hệ BTC để đăng ký tại sân.</p>
        <a href={`/${slug}`} className="font-semibold text-brand-text">← Về trang giải</a>
      </main>
    );

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <a href={`/${slug}`} aria-label="Quay lại trang giải" className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </a>
        <div className="flex min-w-0 flex-col">
          <span className="display text-xl leading-none">Đăng ký thi đấu</span>
          <span className="truncate text-xs text-muted">{tournamentName}</span>
        </div>
      </header>

      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <section className="flex flex-col gap-3.5 px-4 pt-5">
          <h2 className="display text-2xl text-brand-text">Thông tin VĐV</h2>
          <Input label="Họ và tên" error={fields.fullName} value={v.fullName} onChange={set('fullName')} autoComplete="name" required />
          <Input label="Số điện thoại (Zalo)" error={fields.phone} value={v.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" required />
          <div className="flex gap-2.5">
            <Input
              label="Năm sinh"
              error={fields.birthYear}
              value={v.birthYear}
              onChange={set('birthYear')}
              inputMode="numeric"
              maxLength={4}
              required
              className="flex-1"
            />
            <div className="flex flex-1 flex-col gap-1.5 text-sm text-fg-2">
              <span id="gt">Giới tính</span>
              <div role="radiogroup" aria-labelledby="gt" className="flex h-12">
                {(['male', 'female'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={gender === g}
                    onClick={() => {
                      setGender(g);
                      setPicked({});
                    }}
                    className={cx('flex-1 border border-line-strong font-bold', gender === g ? 'bg-fg text-bg' : 'text-fg')}
                  >
                    {g === 'male' ? 'Nam' : 'Nữ'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Input label="CLB / Đội (không bắt buộc)" value={v.club} onChange={set('club')} />
          <Input label="Email (không bắt buộc, để nhận vé)" error={fields.email} value={v.email} onChange={set('email')} type="email" autoComplete="email" />
          <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={v.website} onChange={set('website')} name="website" />

        </section>

        <section className="flex flex-col gap-3.5 px-4 pt-7">
          <h2 className="display text-2xl text-brand-text">Chọn hạng mục</h2>
          <p className="text-sm text-muted">Chọn hạng cân cho từng tay.{tier?.bothHandsPrice != null && ' Đăng ký cả 2 tay được giá combo.'}</p>
          {hands.map((h) => {
            const list = available.filter((c) => c.hand === h);
            return (
              <fieldset key={h} className={cx('flex flex-col gap-2.5 border bg-surface p-3.5', picked[h] ? 'border-brand' : 'border-line')}>
                <legend className="sr-only">{HAND_LABEL[h]}</legend>
                <div className="flex items-baseline justify-between">
                  <span className="display text-xl">{HAND_LABEL[h]}</span>
                  <span className="text-sm text-muted">{list[0]?.session ?? ''}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {list.map((c) => {
                    const on = picked[h] === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        disabled={c.full && !on}
                        onClick={() => setPicked({ ...picked, [h]: on ? undefined : c.id })}
                        className={cx(
                          'min-h-11 border font-display text-base font-bold disabled:opacity-40',
                          on ? 'border-brand bg-brand text-white' : 'border-line-strong text-fg',
                        )}
                      >
                        {c.label}
                        {c.full && <span className="block text-[10px] font-normal">Hết suất</span>}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
          {fields.categoryIds && <p className="text-sm font-semibold text-brand-text">{fields.categoryIds}</p>}
        </section>

        <section className="mx-4 mt-7 flex flex-col gap-2.5 border border-line bg-surface p-4">
          <h2 className="display text-xl">Tóm tắt</h2>
          {chosen.length === 0 && <p className="text-sm text-muted">Chưa chọn hạng mục nào.</p>}
          {chosen.map((c) => (
            <div key={c.id} className="flex justify-between text-sm">
              <span>
                {HAND_LABEL[c.hand]} · {c.gender === 'female' ? 'Nữ' : c.gender === 'male' ? 'Nam' : 'Mở'} {c.label}
              </span>
              <span className="text-fg-2">{tier ? formatVnd(tier.singleHandPrice) : ''}</span>
            </div>
          ))}
          {combo && tier && (
            <div className="flex justify-between text-sm text-success-text">
              <span>Giảm giá combo 2 tay</span>
              <span>-{formatVnd(2 * tier.singleHandPrice - total)}</span>
            </div>
          )}
          <div className="h-px bg-line-strong" />
          <div className="flex items-baseline justify-between">
            <span className="font-bold">Tổng cộng</span>
            <span className="font-display text-3xl font-bold">{total === 0 && chosen.length ? 'Miễn phí' : formatVnd(total)}</span>
          </div>
          {tier && <span className="text-xs text-muted">Giá “{tier.name}”</span>}
        </section>

        <label className="flex items-start gap-3 px-4 pt-5 text-sm text-fg-2">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]" />
          <span>
            Tôi đồng ý cho BTC sử dụng họ tên, SĐT, năm sinh để tổ chức giải và liên hệ. SĐT không hiển thị công khai.
            {fields.consent && <span className="block font-semibold text-brand-text">{fields.consent}</span>}
          </span>
        </label>

        {error && (
          <div className="px-4 pt-4">
            <Alert tone="error">{error}</Alert>
          </div>
        )}

        <div className="sticky bottom-0 mt-auto border-t border-line bg-bg px-4 py-3">
          <button
            type="submit"
            disabled={pending || chosen.length === 0}
            className="display btn-slant flex min-h-13 w-full items-center justify-center bg-brand text-xl text-white disabled:opacity-50"
          >
            {pending ? 'Đang gửi…' : total > 0 ? `Tiếp tục thanh toán · ${formatVnd(total)}` : 'Hoàn tất đăng ký'}
          </button>
        </div>
      </form>
    </main>
  );
}

function Input({ label, error, className, ...p }: React.ComponentProps<'input'> & { label: string; error?: string }) {
  return (
    <label className={cx('flex flex-col gap-1.5 text-sm text-fg-2', className)}>
      <span>
        {label}
        {p.required && <span className="ml-0.5 font-bold text-brand-text" aria-hidden="true">*</span>}
      </span>
      <input {...p} className={cx(inputClass, 'min-h-12 bg-surface font-medium', error && 'border-brand')} />
      {error && <span className="text-xs font-semibold text-brand-text">{error}</span>}
    </label>
  );
}
