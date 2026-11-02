'use client';

import { useState } from 'react';
import { updateInfoAction } from '@/app/btc/actions';
import { Card, Field, inputClass } from '@/components/ui';
import { CoverUploader } from './cover-uploader';
import { StepFooter, useSaver } from './shared';

export interface InfoValues {
  name: string;
  slug: string;
  description: string;
  rules: string;
  notes: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  venueAddress: string;
  mapsUrl: string;
  registrationDeadline: string;
  capacity: string;
  birthYearMin: string;
  birthYearMax: string;
  weightToleranceKg: string;
  phone: string;
  zalo: string;
  facebook: string;
  tiktok: string;
}

export function InfoStep({
  tournamentId,
  status,
  initial,
  coverUrl,
  ogUrl,
}: {
  tournamentId: string;
  status: string;
  initial: InfoValues;
  coverUrl: string | null;
  ogUrl: string | null;
}) {
  const [v, setV] = useState(initial);
  const { pending, error, fields, savedAt, save } = useSaver(tournamentId);
  const set = (k: keyof InfoValues) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const area = `${inputClass} min-h-28 py-2`;

  return (
    <div className="flex flex-col gap-5">
      <Card title="Ảnh bìa / poster">
        <CoverUploader tournamentId={tournamentId} coverUrl={coverUrl} ogUrl={ogUrl} />
      </Card>

      <Card title="Thông tin chung">
        <Field label="Tên giải *" error={fields.name}>
          <input className={inputClass} value={v.name} onChange={set('name')} />
        </Field>
        <Field
          label="Đường dẫn giải"
          error={fields.slug}
          hint={status === 'draft' ? `vattay.vn/${v.slug} — không đổi được sau khi xuất bản` : 'Đã xuất bản, không đổi được'}
        >
          <input className={inputClass} value={v.slug} onChange={set('slug')} disabled={status !== 'draft'} />
        </Field>
        <Field label="Giới thiệu" error={fields.description}>
          <textarea className={area} value={v.description} onChange={set('description')} />
        </Field>
        <Field label="Lưu ý cho VĐV (móng tay, trang sức, giấy tờ…)" error={fields.notes} hint="Mỗi dòng một lưu ý">
          <textarea className={area} value={v.notes} onChange={set('notes')} />
        </Field>
        <Field label="Điều lệ" error={fields.rules}>
          <textarea className={`${area} min-h-40`} value={v.rules} onChange={set('rules')} />
        </Field>
      </Card>

      <Card title="Thời gian & địa điểm">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bắt đầu *" error={fields.startsAt}>
            <input type="datetime-local" className={inputClass} value={v.startsAt} onChange={set('startsAt')} />
          </Field>
          <Field label="Kết thúc (dự kiến)" error={fields.endsAt}>
            <input type="datetime-local" className={inputClass} value={v.endsAt} onChange={set('endsAt')} />
          </Field>
          <Field label="Địa điểm *" error={fields.venueName}>
            <input className={inputClass} value={v.venueName} onChange={set('venueName')} placeholder="Nhà thi đấu PTIT" />
          </Field>
          <Field label="Địa chỉ" error={fields.venueAddress}>
            <input className={inputClass} value={v.venueAddress} onChange={set('venueAddress')} />
          </Field>
          <Field label="Link Google Maps" error={fields.mapsUrl} className="sm:col-span-2">
            <input className={inputClass} value={v.mapsUrl} onChange={set('mapsUrl')} placeholder="https://maps.app.goo.gl/…" />
          </Field>
        </div>
      </Card>

      <Card title="Đăng ký">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Hạn đăng ký online" error={fields.registrationDeadline}>
            <input type="datetime-local" className={inputClass} value={v.registrationDeadline} onChange={set('registrationDeadline')} />
          </Field>
          <Field label="Giới hạn số VĐV" error={fields.capacity} hint="Bỏ trống = không giới hạn">
            <input className={inputClass} inputMode="numeric" value={v.capacity} onChange={set('capacity')} />
          </Field>
          <Field label="Dung sai cân (kg)" error={fields.weightToleranceKg} hint="Ví dụ 1 = cho phép +1kg quần áo">
            <input className={inputClass} inputMode="decimal" value={v.weightToleranceKg} onChange={set('weightToleranceKg')} />
          </Field>
          <Field label="Năm sinh từ" error={fields.birthYearMin}>
            <input className={inputClass} inputMode="numeric" value={v.birthYearMin} onChange={set('birthYearMin')} placeholder="1996" />
          </Field>
          <Field label="Năm sinh đến" error={fields.birthYearMax} hint="Sai năm sinh chỉ cảnh báo, không chặn">
            <input className={inputClass} inputMode="numeric" value={v.birthYearMax} onChange={set('birthYearMax')} placeholder="2008" />
          </Field>
        </div>
      </Card>

      <Card title="Liên hệ BTC">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Số điện thoại" error={fields.phone}>
            <input className={inputClass} value={v.phone} onChange={set('phone')} inputMode="tel" />
          </Field>
          <Field label="Zalo" error={fields.zalo}>
            <input className={inputClass} value={v.zalo} onChange={set('zalo')} />
          </Field>
          <Field label="Facebook" error={fields.facebook}>
            <input className={inputClass} value={v.facebook} onChange={set('facebook')} />
          </Field>
          <Field label="TikTok" error={fields.tiktok}>
            <input className={inputClass} value={v.tiktok} onChange={set('tiktok')} />
          </Field>
        </div>
      </Card>

      <StepFooter
        tournamentId={tournamentId}
        next="hang-muc"
        nextLabel="Tiếp: Hạng mục →"
        pending={pending}
        error={error}
        savedAt={savedAt}
        onSave={(next) => save(() => updateInfoAction(tournamentId, v), next)}
      />
    </div>
  );
}
