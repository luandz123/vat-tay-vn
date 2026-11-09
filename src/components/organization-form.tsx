'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createOrganizationAction, updateOrganizationAction } from '@/app/btc/actions';
import { Alert, Button, Card, Field, inputClass } from '@/components/ui';
import { BANKS } from '@/server/shared/banks';

export interface OrganizationValues {
  name: string;
  phone: string;
  zalo: string;
  facebook: string;
  tiktok: string;
  bankBin: string;
  bankAccountNo: string;
  bankAccountName: string;
}

export function OrganizationForm({ orgId, initial, redirectTo }: { orgId?: string; initial?: OrganizationValues; redirectTo: string }) {
  const router = useRouter();
  const [v, setV] = useState<OrganizationValues>(
    initial ?? { name: '', phone: '', zalo: '', facebook: '', tiktok: '', bankBin: '', bankAccountNo: '', bankAccountName: '' },
  );
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const set = (k: keyof OrganizationValues) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = orgId ? await updateOrganizationAction(orgId, v) : await createOrganizationAction(v);
          if (r.ok) router.push(redirectTo);
          else {
            setError(r.error);
            setFields(r.fields ?? {});
          }
        });
      }}
    >
      <Card title="Thông tin BTC">
        <Field label="Tên BTC / CLB" required error={fields.name}>
          <input className={inputClass} value={v.name} onChange={set('name')} placeholder="CLB Vật tay PTIT" required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Số điện thoại" optional error={fields.phone}>
            <input className={inputClass} value={v.phone} onChange={set('phone')} inputMode="tel" />
          </Field>
          <Field label="Zalo (SĐT hoặc link nhóm)" optional error={fields.zalo}>
            <input className={inputClass} value={v.zalo} onChange={set('zalo')} />
          </Field>
          <Field label="Facebook (link trang/nhóm)" optional error={fields.facebook}>
            <input className={inputClass} value={v.facebook} onChange={set('facebook')} />
          </Field>
          <Field label="TikTok" optional error={fields.tiktok}>
            <input className={inputClass} value={v.tiktok} onChange={set('tiktok')} />
          </Field>
        </div>
      </Card>

      <Card title="Tài khoản nhận lệ phí (VietQR)">
        <p className="text-sm text-fg-2">
          VĐV quét mã VietQR và chuyển thẳng vào tài khoản này. VậtTay.vn không giữ tiền hộ. Bắt buộc nếu giải có thu phí; bỏ trống nếu giải miễn phí.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ngân hàng" optional error={fields.bankBin}>
            <select className={inputClass} value={v.bankBin} onChange={set('bankBin')}>
              <option value="">— Chọn ngân hàng —</option>
              {BANKS.map((b) => (
                <option key={b.bin} value={b.bin}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Số tài khoản" optional error={fields.bankAccountNo}>
            <input className={inputClass} value={v.bankAccountNo} onChange={set('bankAccountNo')} inputMode="numeric" />
          </Field>
          <Field label="Tên chủ tài khoản" optional error={fields.bankAccountName} className="sm:col-span-2">
            <input className={`${inputClass} uppercase`} value={v.bankAccountName} onChange={set('bankAccountName')} />
          </Field>
        </div>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Đang lưu…' : orgId ? 'Lưu thay đổi' : 'Tạo BTC'}
        </Button>
      </div>
    </form>
  );
}
