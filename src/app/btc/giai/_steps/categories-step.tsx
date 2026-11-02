'use client';

import { useState } from 'react';
import { saveCategoriesAction } from '@/app/btc/actions';
import { Alert, Button, Card, Field, inputClass } from '@/components/ui';
import {
  GENDER_LABEL,
  HAND_LABEL,
  categoriesFromTemplate,
  weightLabel,
  type CategoryDraft,
  type CategoryTemplate,
  type Hand,
} from '@/server/tournaments/templates';
import { StepFooter, tempKey, useSaver } from './shared';

type Row = Omit<CategoryDraft, 'weightMinKg' | 'weightMaxKg' | 'capacity' | 'birthYearMin' | 'birthYearMax'> & {
  weightMinKg: string;
  weightMaxKg: string;
  capacity: string;
  birthYearMin: string;
  birthYearMax: string;
};

const s = (n: number | null) => (n === null ? '' : String(n));
const toRow = (c: CategoryDraft): Row => ({
  ...c,
  weightMinKg: s(c.weightMinKg),
  weightMaxKg: s(c.weightMaxKg),
  capacity: s(c.capacity),
  birthYearMin: s(c.birthYearMin),
  birthYearMax: s(c.birthYearMax),
});
const cell = `${inputClass} min-h-10 px-2`;

export function CategoriesStep({
  tournamentId,
  templates,
  initial,
  defaultBirthYears,
}: {
  tournamentId: string;
  templates: CategoryTemplate[];
  initial: CategoryDraft[];
  defaultBirthYears: [number | null, number | null];
}) {
  const [rows, setRows] = useState<Row[]>(initial.map(toRow));
  const [hands, setHands] = useState<Hand[]>(['right', 'left']);
  const { pending, error, fields, savedAt, save } = useSaver(tournamentId);
  const weights = rows.filter((r) => r.kind === 'weight');
  const allArounds = rows.filter((r) => r.kind === 'all_around');
  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) =>
    setRows((rs) => rs.filter((r) => r.key !== key).map((r) => ({ ...r, allAroundSourceKeys: r.allAroundSourceKeys.filter((k) => k !== key) })));

  function addBlank() {
    setRows((rs) => [
      ...rs,
      toRow({
        key: tempKey(), kind: 'weight', hand: 'right', gender: 'male', label: '', weightMinKg: null, weightMaxKg: null,
        birthYearMin: null, birthYearMax: null, capacity: null, sessionKey: null, allAroundMaxPlace: null, allAroundSourceKeys: [],
      }),
    ]);
  }
  function addAllAround() {
    setRows((rs) => [
      ...rs,
      toRow({
        key: tempKey(), kind: 'all_around', hand: 'right', gender: 'male', label: 'Toàn năng', weightMinKg: null, weightMaxKg: null,
        birthYearMin: null, birthYearMax: null, capacity: null, sessionKey: null, allAroundMaxPlace: 1,
        allAroundSourceKeys: weights.filter((w) => w.hand === 'right' && w.gender === 'male').map((w) => w.key),
      }),
    ]);
  }
  /** Tự đổi nhãn khi sửa cân, nếu nhãn đang là nhãn tự sinh. */
  function setWeight(r: Row, patch: Partial<Pick<Row, 'weightMinKg' | 'weightMaxKg'>>) {
    const next = { ...r, ...patch };
    const auto = r.label === '' || r.label === weightLabel(num(r.weightMinKg), num(r.weightMaxKg));
    update(r.key, auto ? { ...patch, label: weightLabel(num(next.weightMinKg), num(next.weightMaxKg)) } : patch);
  }

  const fieldError = Object.entries(fields)[0]?.[1];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="display text-4xl leading-none">
          Hạng mục <span className="text-brand-text">thi đấu</span>
        </h1>
        <p className="mt-2 text-fg-2">Tự cấu hình theo giải của bạn. Hệ thống không ép theo luật WAF, chỉ cảnh báo khi có điểm bất thường.</p>
      </div>

      <Card title="Thêm nhanh từ mẫu">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-fg-2">Cho tay:</span>
          {(['right', 'left'] as const).map((h) => (
            <label key={h} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hands.includes(h)}
                onChange={(e) => setHands(e.target.checked ? [...hands, h] : hands.filter((x) => x !== h))}
                className="size-5 accent-[var(--brand)]"
              />
              {HAND_LABEL[h]}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <Button key={t.id} disabled={hands.length === 0} onClick={() => setRows((rs) => [...rs, ...categoriesFromTemplate(t, hands, tempKey).map(toRow)])}>
              + {t.name}
            </Button>
          ))}
          <Button onClick={addBlank} className="border-dashed">
            + Hạng tự do
          </Button>
        </div>
      </Card>

      <Card
        title={`${weights.length} hạng cân`}
        actions={
          <span className="text-sm text-muted">
            Năm sinh mặc định: {defaultBirthYears[0] ?? '…'} – {defaultBirthYears[1] ?? '…'} (sửa ở bước 1)
          </span>
        }
      >
        {weights.length === 0 ? (
          <p className="text-fg-2">Chưa có hạng nào. Bấm một mẫu ở trên để bắt đầu.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted">
                  <th className="p-2">Tay</th>
                  <th className="p-2">Giới tính</th>
                  <th className="p-2">Trên (kg)</th>
                  <th className="p-2">Đến (kg)</th>
                  <th className="p-2">Tên hạng</th>
                  <th className="p-2">Năm sinh (riêng)</th>
                  <th className="p-2">Suất</th>
                  <th className="p-2"><span className="sr-only">Xóa</span></th>
                </tr>
              </thead>
              <tbody>
                {weights.map((r) => (
                  <tr key={r.key} className="border-t border-line">
                    <td className="p-1.5">
                      <select aria-label="Tay" className={cell} value={r.hand} onChange={(e) => update(r.key, { hand: e.target.value as Hand })}>
                        <option value="right">Phải</option>
                        <option value="left">Trái</option>
                      </select>
                    </td>
                    <td className="p-1.5">
                      <select aria-label="Giới tính" className={cell} value={r.gender} onChange={(e) => update(r.key, { gender: e.target.value as Row['gender'] })}>
                        <option value="male">Nam</option>
                        <option value="female">Nữ</option>
                        <option value="open">Mở (không phân)</option>
                      </select>
                    </td>
                    <td className="p-1.5">
                      <input aria-label="Cân tối thiểu" className={`${cell} w-20`} inputMode="decimal" value={r.weightMinKg} onChange={(e) => setWeight(r, { weightMinKg: e.target.value })} />
                    </td>
                    <td className="p-1.5">
                      <input aria-label="Cân tối đa" className={`${cell} w-20`} inputMode="decimal" value={r.weightMaxKg} onChange={(e) => setWeight(r, { weightMaxKg: e.target.value })} placeholder="∞" />
                    </td>
                    <td className="p-1.5">
                      <input aria-label="Tên hạng" className={`${cell} w-28 font-semibold`} value={r.label} onChange={(e) => update(r.key, { label: e.target.value })} />
                    </td>
                    <td className="p-1.5">
                      <div className="flex items-center gap-1">
                        <input aria-label="Năm sinh từ" className={`${cell} w-20`} inputMode="numeric" value={r.birthYearMin} onChange={(e) => update(r.key, { birthYearMin: e.target.value })} />
                        <span className="text-muted">–</span>
                        <input aria-label="Năm sinh đến" className={`${cell} w-20`} inputMode="numeric" value={r.birthYearMax} onChange={(e) => update(r.key, { birthYearMax: e.target.value })} />
                      </div>
                    </td>
                    <td className="p-1.5">
                      <input aria-label="Giới hạn suất" className={`${cell} w-16`} inputMode="numeric" value={r.capacity} onChange={(e) => update(r.key, { capacity: e.target.value })} placeholder="—" />
                    </td>
                    <td className="p-1.5 text-right">
                      <button type="button" aria-label={`Xóa hạng ${r.label}`} onClick={() => remove(r.key)} className="size-10 border border-line-strong text-fg-2 hover:text-brand-text">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Hạng Toàn năng tự động" actions={<Button onClick={addAllAround}>+ Thêm hạng Toàn năng</Button>}>
        <p className="text-sm text-fg-2">Khi các hạng nguồn có kết quả, hệ thống tự đưa VĐV đạt huy chương đã chọn vào bảng Toàn năng. Không thu thêm phí.</p>
        {allArounds.map((a) => (
          <div key={a.key} className="flex flex-col gap-3 border border-line-strong p-3">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Tên">
                <input className={`${cell} w-40`} value={a.label} onChange={(e) => update(a.key, { label: e.target.value })} />
              </Field>
              <Field label="Tay">
                <select className={cell} value={a.hand} onChange={(e) => update(a.key, { hand: e.target.value as Hand })}>
                  <option value="right">Phải</option>
                  <option value="left">Trái</option>
                </select>
              </Field>
              <Field label="Giới tính">
                <select className={cell} value={a.gender} onChange={(e) => update(a.key, { gender: e.target.value as Row['gender'] })}>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="open">Mở</option>
                </select>
              </Field>
              <Field label="Lấy huy chương">
                <select className={cell} value={a.allAroundMaxPlace ?? 1} onChange={(e) => update(a.key, { allAroundMaxPlace: Number(e.target.value) })}>
                  <option value={1}>Chỉ HCV</option>
                  <option value={2}>HCV + HCB</option>
                  <option value={3}>HCV + HCB + HCĐ</option>
                </select>
              </Field>
              <Button className="ml-auto" onClick={() => remove(a.key)}>
                Xóa
              </Button>
            </div>
            <fieldset className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <legend className="mb-2 text-fg-2">Từ các hạng:</legend>
              {weights.map((w) => (
                <label key={w.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--brand)]"
                    checked={a.allAroundSourceKeys.includes(w.key)}
                    onChange={(e) =>
                      update(a.key, {
                        allAroundSourceKeys: e.target.checked ? [...a.allAroundSourceKeys, w.key] : a.allAroundSourceKeys.filter((k) => k !== w.key),
                      })
                    }
                  />
                  {HAND_LABEL[w.hand]} · {GENDER_LABEL[w.gender]} {w.label || '(chưa đặt tên)'}
                </label>
              ))}
            </fieldset>
          </div>
        ))}
      </Card>

      {fieldError && <Alert tone="error">{fieldError}</Alert>}
      <StepFooter
        tournamentId={tournamentId}
        prev="thong-tin"
        next="le-phi"
        nextLabel="Tiếp: Lệ phí →"
        pending={pending}
        error={error}
        savedAt={savedAt}
        onSave={(next) => save(() => saveCategoriesAction(tournamentId, { categories: rows }), next)}
      />
    </div>
  );
}

function num(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
