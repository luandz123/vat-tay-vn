'use client';

import { useState } from 'react';
import { updateInfoAction } from '@/app/btc/actions';
import { DateTimePicker, TimeSelect } from '@/components/pickers';
import { Card, Field, cx, inputClass } from '@/components/ui';
import { finalizeSlug, slugTyping } from '@/server/tournaments/slug';
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

const YEARS = (() => {
  const now = new Date().getFullYear();
  return Array.from({ length: now - 1940 }, (_, i) => String(now - 5 - i));
})();
const SITE_HOST = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/^https?:\/\//, '') || 'vattay.vn';

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
  const [date = '', time = ''] = v.startsAt ? v.startsAt.split('T') : [];
  const slugLocked = status !== 'draft';

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-fg-2">
        Ô có dấu <span className="font-bold text-brand-text">*</span> là bắt buộc để xuất bản giải. Có thể lưu nháp bất cứ lúc nào.
      </p>

      <Card title="Ảnh bìa / poster *">
        <CoverUploader tournamentId={tournamentId} coverUrl={coverUrl} ogUrl={ogUrl} />
      </Card>

      <Card title="Thông tin chung">
        <Field label="Tên giải" required error={fields.name}>
          <input className={inputClass} value={v.name} onChange={set('name')} />
        </Field>
        <Field
          label="Link trang giải"
          required
          error={fields.slug}
          hint={
            slugLocked
              ? 'Giải đã xuất bản nên link được giữ cố định (để link đã chia sẻ không bị hỏng).'
              : 'Link để chia sẻ lên Facebook/Zalo. Tự tạo từ tên giải; có thể sửa cho ngắn, dễ nhớ (ví dụ ptit-2026). Không đổi được sau khi xuất bản.'
          }
        >
          <div className={cx('flex items-stretch border border-line-strong bg-bg', slugLocked && 'opacity-60')}>
            <span className="flex items-center border-r border-line-strong px-3 text-sm text-muted">{SITE_HOST}/</span>
            <input
              className="min-h-11 flex-1 bg-transparent px-3 text-base text-fg focus:outline-2 focus:outline-brand-text"
              value={v.slug}
              disabled={slugLocked}
              onChange={(e) => setV({ ...v, slug: slugTyping(e.target.value) })}
              placeholder="ptit-2026"
            />
          </div>
        </Field>
        <Field label="Giới thiệu" optional error={fields.description}>
          <textarea className={area} value={v.description} onChange={set('description')} />
        </Field>
        <Field label="Lưu ý cho VĐV (móng tay, trang sức, giấy tờ…)" optional error={fields.notes} hint="Mỗi dòng một lưu ý">
          <textarea className={area} value={v.notes} onChange={set('notes')} />
        </Field>
        <Field label="Điều lệ" optional error={fields.rules}>
          <textarea className={`${area} min-h-40`} value={v.rules} onChange={set('rules')} />
        </Field>
      </Card>

      <Card title="Thời gian & địa điểm">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ngày thi đấu" required error={fields.startsAt}>
            <input
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setV({ ...v, startsAt: e.target.value ? `${e.target.value}T${time || '08:00'}` : '' })}
              onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
            />
          </Field>
          <Field label="Giờ bắt đầu" required hint="Giải diễn ra trong một ngày">
            <TimeSelect label="Giờ bắt đầu" value={time} allowEmpty={!date} className="w-full" onChange={(t) => setV({ ...v, startsAt: date && t ? `${date}T${t}` : '' })} />
          </Field>
          <Field label="Địa điểm" required error={fields.venueName}>
            <input className={inputClass} value={v.venueName} onChange={set('venueName')} placeholder="Nhà thi đấu PTIT" />
          </Field>
          <Field label="Địa chỉ" optional error={fields.venueAddress}>
            <input className={inputClass} value={v.venueAddress} onChange={set('venueAddress')} />
          </Field>
          <Field label="Link Google Maps" optional error={fields.mapsUrl} className="sm:col-span-2" hint="Mở Google Maps → Chia sẻ → Sao chép đường liên kết">
            <input className={inputClass} value={v.mapsUrl} onChange={set('mapsUrl')} placeholder="https://maps.app.goo.gl/…" />
          </Field>
        </div>
      </Card>

      <Card title="Đăng ký">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hạn đăng ký online" optional error={fields.registrationDeadline} hint="Bỏ trống = nhận đăng ký online đến ngày thi đấu">
            <DateTimePicker label="Hạn đăng ký" value={v.registrationDeadline} defaultTime="23:45" onChange={(x) => setV({ ...v, registrationDeadline: x })} />
          </Field>
          <Field label="Giới hạn số VĐV" optional error={fields.capacity} hint="Bỏ trống = không giới hạn">
            <input className={inputClass} inputMode="numeric" value={v.capacity} onChange={(e) => setV({ ...v, capacity: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="Dung sai cân" optional error={fields.weightToleranceKg} hint="Cho phép vượt hạng cân bao nhiêu kg (quần áo…)">
            <select className={inputClass} value={v.weightToleranceKg || '0'} onChange={set('weightToleranceKg')}>
              {['0', '0.5', '1', '1.5', '2', '3'].map((k) => (
                <option key={k} value={k}>
                  {k === '0' ? 'Không có dung sai' : `+${k} kg`}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Năm sinh từ" optional error={fields.birthYearMin}>
              <select className={inputClass} value={v.birthYearMin} onChange={set('birthYearMin')}>
                <option value="">Không giới hạn</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>
            <Field label="đến" optional error={fields.birthYearMax} hint="Sai năm sinh chỉ cảnh báo">
              <select className={inputClass} value={v.birthYearMax} onChange={set('birthYearMax')}>
                <option value="">Không giới hạn</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Liên hệ BTC">
        <p className="-mt-2 text-sm text-muted">Nên có ít nhất một cách liên hệ để VĐV hỏi đáp.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Số điện thoại" optional error={fields.phone}>
            <input className={inputClass} value={v.phone} onChange={set('phone')} inputMode="tel" />
          </Field>
          <Field label="Zalo (SĐT hoặc link nhóm)" optional error={fields.zalo}>
            <input className={inputClass} value={v.zalo} onChange={set('zalo')} />
          </Field>
          <Field label="Facebook" optional error={fields.facebook}>
            <input className={inputClass} value={v.facebook} onChange={set('facebook')} />
          </Field>
          <Field label="TikTok" optional error={fields.tiktok}>
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
        onSave={(next) => save(() => updateInfoAction(tournamentId, { ...v, slug: finalizeSlug(v.slug), endsAt: '' }), next)}
      />
    </div>
  );
}
