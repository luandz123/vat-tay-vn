'use client';

import { useState } from 'react';
import { savePricingAction } from '@/app/btc/actions';
import { DateTimePicker, PriceInput } from '@/components/pickers';
import { Alert, Button, Card, Field, inputClass } from '@/components/ui';
import { StepFooter, tempKey, useSaver } from './shared';

interface Tier {
  key: string;
  kind: 'online' | 'onsite';
  name: string;
  validUntil: string;
  singleHandPrice: string;
  bothHandsPrice: string;
}


export function PricingStep({
  tournamentId,
  initial,
  hasBankInfo,
  organizationId,
}: {
  tournamentId: string;
  initial: Tier[];
  hasBankInfo: boolean;
  organizationId: string;
}) {
  const [tiers, setTiers] = useState<Tier[]>(
    initial.length
      ? initial
      : [
          { key: tempKey(), kind: 'online', name: 'Đăng ký online', validUntil: '', singleHandPrice: '', bothHandsPrice: '' },
          { key: tempKey(), kind: 'onsite', name: 'Đăng ký tại sân', validUntil: '', singleHandPrice: '', bothHandsPrice: '' },
        ],
  );
  const { pending, error, fields, savedAt, save } = useSaver(tournamentId);
  const update = (key: string, patch: Partial<Tier>) => setTiers((ts) => ts.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const err = (i: number, f: string) => fields[`tiers.${i}.${f}`];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="display text-4xl leading-none">
          Lệ phí <span className="text-brand-text">&amp; đợt giá</span>
        </h1>
        <p className="mt-2 text-fg-2">
          Giá tính theo tay. Có giá combo khi đăng ký cả 2 tay. Đợt online có thể đặt hạn (ví dụ giá sớm), hết hạn thì tự chuyển sang đợt tiếp theo.
        </p>
      </div>

      {!hasBankInfo && (
        <Alert>
          BTC chưa có tài khoản nhận tiền VietQR.{' '}
          <a className="font-semibold underline" href={`/btc/to-chuc/${organizationId}`}>
            Thêm tài khoản
          </a>{' '}
          (giải miễn phí thì nhập giá 0).
        </Alert>
      )}

      {tiers.map((t, i) => (
        <Card
          key={t.key}
          title={t.kind === 'online' ? 'Đợt online' : 'Tại sân (ngày thi đấu)'}
          actions={
            <Button onClick={() => setTiers(tiers.filter((x) => x.key !== t.key))} disabled={tiers.length === 1}>
              Xóa đợt
            </Button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên đợt" required error={err(i, 'name')}>
              <input className={inputClass} value={t.name} onChange={(e) => update(t.key, { name: e.target.value })} />
            </Field>
            {t.kind === 'online' ? (
              <Field label="Áp dụng đến" optional error={err(i, 'validUntil')} hint="Bỏ trống = đến hạn đăng ký. Dùng cho giá đăng ký sớm.">
                <DateTimePicker label="Áp dụng đến" value={t.validUntil} defaultTime="23:45" onChange={(x) => update(t.key, { validUntil: x })} />
              </Field>
            ) : (
              <div />
            )}
            <Field label="Giá 1 tay" required error={err(i, 'singleHandPrice')}>
              <PriceInput label="Giá 1 tay" value={t.singleHandPrice} onChange={(x) => update(t.key, { singleHandPrice: x })} />
            </Field>
            <Field label="Giá combo 2 tay" optional error={err(i, 'bothHandsPrice')} hint="Bỏ trống = không có giá combo (2 tay tính bằng 2 lần giá 1 tay)">
              <PriceInput
                label="Giá combo 2 tay"
                allowEmpty
                presets={[100000, 150000, 200000, 250000, 300000, 400000, 500000]}
                value={t.bothHandsPrice}
                onChange={(x) => update(t.key, { bothHandsPrice: x })}
              />
            </Field>
          </div>
        </Card>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setTiers([...tiers, { key: tempKey(), kind: 'online', name: 'Giá sớm', validUntil: '', singleHandPrice: '', bothHandsPrice: '' }])}>
          + Thêm đợt online
        </Button>
        {!tiers.some((t) => t.kind === 'onsite') && (
          <Button onClick={() => setTiers([...tiers, { key: tempKey(), kind: 'onsite', name: 'Đăng ký tại sân', validUntil: '', singleHandPrice: '', bothHandsPrice: '' }])}>
            + Thêm giá tại sân
          </Button>
        )}
      </div>

      <StepFooter
        tournamentId={tournamentId}
        prev="hang-muc"
        next="lich-giai-thuong"
        nextLabel="Tiếp: Lịch & giải thưởng →"
        pending={pending}
        error={error}
        savedAt={savedAt}
        onSave={(next) => save(() => savePricingAction(tournamentId, { tiers }), next)}
      />
    </div>
  );
}
