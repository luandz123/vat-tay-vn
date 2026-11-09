'use client';

/** Ô chọn ngày/giờ/giá: chọn thay vì gõ (vẫn cho gõ giá tự do). Giá trị theo chuẩn của form: "YYYY-MM-DDTHH:mm". */
import { useId } from 'react';
import { cx, inputClass } from '@/components/ui';

const pad = (n: number) => String(n).padStart(2, '0');

/** Danh sách giờ cách nhau `step` phút trong khoảng [fromHour, toHour]. */
export function timeOptions(step = 15, fromHour = 5, toHour = 23): string[] {
  const out: string[] = [];
  for (let h = fromHour; h <= toHour; h++) for (let m = 0; m < 60; m += step) out.push(`${pad(h)}:${pad(m)}`);
  return out;
}

export function TimeSelect({
  value,
  onChange,
  label,
  allowEmpty = true,
  step = 15,
  className,
}: {
  value: string; // "HH:mm" hoặc ""
  onChange: (v: string) => void;
  label: string;
  allowEmpty?: boolean;
  step?: number;
  className?: string;
}) {
  const opts = timeOptions(step);
  const list = value && !opts.includes(value) ? [value, ...opts].sort() : opts; // giữ giờ lẻ đã lưu trước đó
  return (
    <select aria-label={label} className={cx(inputClass, 'w-28', className)} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty && <option value="">--:--</option>}
      {list.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

/** Chọn ngày (lịch) + giờ (danh sách). Trả "" khi chưa chọn ngày. */
export function DateTimePicker({
  value,
  onChange,
  label,
  defaultTime = '08:00',
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  defaultTime?: string;
}) {
  const [date = '', time = ''] = value ? value.split('T') : [];
  const id = useId();
  return (
    <div className="flex gap-2">
      <input
        id={id}
        type="date"
        aria-label={`${label} – ngày`}
        className={cx(inputClass, 'flex-1')}
        value={date}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}T${time || defaultTime}` : '')}
        onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
      />
      <TimeSelect
        label={`${label} – giờ`}
        value={time}
        allowEmpty={!date}
        onChange={(t) => onChange(date ? (t ? `${date}T${t}` : '') : '')}
      />
    </div>
  );
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

/** Ô giá: gõ số (tự thêm dấu chấm) hoặc bấm chọn nhanh một mức có sẵn. Giá trị là chuỗi số không dấu. */
export function PriceInput({
  value,
  onChange,
  label,
  presets = [0, 50000, 100000, 150000, 200000, 250000, 300000],
  allowEmpty = false,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  presets?: number[];
  allowEmpty?: boolean;
}) {
  const digits = value.replace(/\D/g, '');
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <input
          aria-label={label}
          inputMode="numeric"
          className={cx(inputClass, 'pr-8')}
          value={digits ? fmt(Number(digits)) : ''}
          placeholder={allowEmpty ? 'Không có' : '0'}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''))}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">đ</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {allowEmpty && (
          <button type="button" onClick={() => onChange('')} className={cx('min-h-8 border px-2 text-xs font-semibold', digits === '' ? 'border-brand bg-brand text-white' : 'border-line-strong text-fg-2')}>
            Không
          </button>
        )}
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(String(p))}
            className={cx('min-h-8 border px-2 text-xs font-semibold', digits === String(p) ? 'border-brand bg-brand text-white' : 'border-line-strong text-fg-2')}
          >
            {p === 0 ? 'Miễn phí' : `${p / 1000}k`}
          </button>
        ))}
      </div>
    </div>
  );
}
