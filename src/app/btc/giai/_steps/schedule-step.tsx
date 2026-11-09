'use client';

import { useState } from 'react';
import { saveScheduleAction } from '@/app/btc/actions';
import { TimeSelect } from '@/components/pickers';
import { Button, Card, Field, inputClass } from '@/components/ui';
import { GENDER_LABEL, HAND_LABEL, type CategoryGender, type Hand } from '@/server/tournaments/templates';
import { StepFooter, tempKey, useSaver } from './shared';

interface Session {
  key: string;
  name: string;
  weighInStart: string;
  weighInEnd: string;
  competeStart: string;
  competeEnd: string;
}
interface Prize {
  key: string;
  categoryKey: string | null;
  place: number;
  title: string;
  description: string;
  cashAmount: string;
}
interface Cat {
  id: string;
  label: string;
  hand: Hand;
  gender: CategoryGender;
  kind: 'weight' | 'all_around';
  sessionId: string | null;
}

const PLACES = [
  { place: 1, title: 'Nhất' },
  { place: 2, title: 'Nhì' },
  { place: 3, title: 'Ba' },
  { place: 4, title: 'Khuyến khích' },
];
const cell = `${inputClass} min-h-10 px-2`;

export function ScheduleStep({
  tournamentId,
  categories,
  initialSessions,
  initialPrizes,
  tournamentDate,
}: {
  tournamentId: string;
  /** Ngày thi đấu "YYYY-MM-DD" (giải trong 1 ngày → phiên chỉ cần chọn giờ). */
  tournamentDate: string;
  categories: Cat[];
  initialSessions: Session[];
  initialPrizes: Prize[];
}) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [showSessions, setShowSessions] = useState(initialSessions.length > 0);
  const hhmm = (v: string) => (v ? v.split('T')[1] ?? '' : '');
  const at = (t: string) => (t && tournamentDate ? `${tournamentDate}T${t}` : '');
  const [assign, setAssign] = useState<Record<string, string | null>>(Object.fromEntries(categories.map((c) => [c.id, c.sessionId])));
  const [prizes, setPrizes] = useState<Prize[]>(
    initialPrizes.length
      ? initialPrizes
      : PLACES.map((p) => ({ key: tempKey(), categoryKey: null, place: p.place, title: p.title, description: '', cashAmount: '' })),
  );
  const { pending, error, fields, savedAt, save } = useSaver(tournamentId);
  const updS = (key: string, patch: Partial<Session>) => setSessions((ss) => ss.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const updP = (key: string, patch: Partial<Prize>) => setPrizes((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  function addSession(name: string, hand?: Hand) {
    const key = tempKey();
    setSessions((ss) => [...ss, { key, name, weighInStart: '', weighInEnd: '', competeStart: '', competeEnd: '' }]);
    if (hand) setAssign((a) => ({ ...a, ...Object.fromEntries(categories.filter((c) => c.hand === hand).map((c) => [c.id, key])) }));
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="display text-4xl leading-none">
        Lịch phiên <span className="text-brand-text">&amp; giải thưởng</span>
      </h1>

      <Card
        title="Chia phiên thi đấu"
        actions={<span className="text-sm text-muted">không bắt buộc</span>}
      >
        {!showSessions ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-sm text-fg-2">
              Không cần xếp trước. Chỉ dùng khi muốn công bố giờ cân/giờ thi riêng, ví dụ sáng tay trái, chiều tay phải. Bảng đấu và bàn vẫn chạy bình thường nếu không chia phiên.
            </p>
            <Button onClick={() => setShowSessions(true)}>Chia phiên</Button>
          </div>
        ) : (
          <>
            {sessions.length === 0 && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { addSession('Sáng', 'left'); addSession('Chiều', 'right'); }}>Sáng tay trái · chiều tay phải</Button>
                <Button onClick={() => addSession('Cả ngày')}>Một phiên</Button>
                <Button onClick={() => setShowSessions(false)}>Không chia phiên</Button>
              </div>
            )}
            {!tournamentDate && sessions.length > 0 && <p className="text-sm text-gold">Hãy chọn ngày thi đấu ở bước 1 để đặt giờ cho phiên.</p>}
            {sessions.map((s, i) => (
              <div key={s.key} className="grid gap-3 border border-line-strong p-3 sm:grid-cols-[10rem_1fr_1fr_auto]">
                <Field label="Tên phiên" required error={fields[`sessions.${i}.name`]}>
                  <input className={cell} value={s.name} onChange={(e) => updS(s.key, { name: e.target.value })} />
                </Field>
                <Field label="Giờ cân" optional>
                  <div className="flex items-center gap-1">
                    <TimeSelect label="Cân từ" value={hhmm(s.weighInStart)} onChange={(t) => updS(s.key, { weighInStart: at(t) })} />
                    <span className="text-muted">–</span>
                    <TimeSelect label="Cân đến" value={hhmm(s.weighInEnd)} onChange={(t) => updS(s.key, { weighInEnd: at(t) })} />
                  </div>
                </Field>
                <Field label="Giờ thi đấu" optional>
                  <div className="flex items-center gap-1">
                    <TimeSelect label="Thi từ" value={hhmm(s.competeStart)} onChange={(t) => updS(s.key, { competeStart: at(t) })} />
                    <span className="text-muted">–</span>
                    <TimeSelect label="Thi đến" value={hhmm(s.competeEnd)} onChange={(t) => updS(s.key, { competeEnd: at(t) })} />
                  </div>
                </Field>
                <Button className="self-end" onClick={() => setSessions(sessions.filter((x) => x.key !== s.key))}>
                  Xóa
                </Button>
              </div>
            ))}
            {sessions.length > 0 && <Button className="self-start" onClick={() => addSession(`Phiên ${sessions.length + 1}`)}>+ Thêm phiên</Button>}
          </>
        )}

        {showSessions && sessions.length > 0 && categories.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold">Gán hạng mục vào phiên</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 bg-surface-2 px-3 py-2 text-sm">
                  <span className="flex-1">
                    {HAND_LABEL[c.hand]} · {GENDER_LABEL[c.gender]} <strong>{c.label}</strong>
                  </span>
                  <select className={`${cell} w-32`} value={assign[c.id] ?? ''} onChange={(e) => setAssign({ ...assign, [c.id]: e.target.value || null })}>
                    <option value="">Chưa gán</option>
                    {sessions.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card title="Cơ cấu giải thưởng" actions={<Button onClick={() => setPrizes([...prizes, { key: tempKey(), categoryKey: null, place: 4, title: '', description: '', cashAmount: '' }])}>+ Thêm dòng</Button>}>
        <p className="text-sm text-fg-2">Áp dụng cho mọi hạng, hoặc chọn riêng một hạng (ví dụ Cúp Toàn năng).</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="p-2">Hạng</th>
                <th className="p-2">Thứ hạng</th>
                <th className="p-2">Tên giải</th>
                <th className="p-2">Hiện vật</th>
                <th className="p-2">Tiền thưởng</th>
                <th className="p-2"><span className="sr-only">Xóa</span></th>
              </tr>
            </thead>
            <tbody>
              {prizes.map((p, i) => (
                <tr key={p.key} className="border-t border-line">
                  <td className="p-1.5">
                    <select aria-label="Áp dụng cho" className={cell} value={p.categoryKey ?? ''} onChange={(e) => updP(p.key, { categoryKey: e.target.value || null })}>
                      <option value="">Mọi hạng</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {HAND_LABEL[c.hand]} {GENDER_LABEL[c.gender]} {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1.5">
                    <select aria-label="Thứ hạng" className={cell} value={p.place} onChange={(e) => updP(p.key, { place: Number(e.target.value) })}>
                      {PLACES.map((x) => (
                        <option key={x.place} value={x.place}>
                          {x.title}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1.5">
                    <input aria-label="Tên giải" className={cell} value={p.title} onChange={(e) => updP(p.key, { title: e.target.value })} />
                    {fields[`prizes.${i}.title`] && <span className="text-xs text-brand-text">{fields[`prizes.${i}.title`]}</span>}
                  </td>
                  <td className="p-1.5">
                    <input aria-label="Hiện vật" className={cell} value={p.description} onChange={(e) => updP(p.key, { description: e.target.value })} placeholder="Huy chương vàng + cúp" />
                  </td>
                  <td className="p-1.5">
                    <input aria-label="Tiền thưởng" className={`${cell} w-32`} inputMode="numeric" value={p.cashAmount} onChange={(e) => updP(p.key, { cashAmount: e.target.value })} placeholder="0" />
                  </td>
                  <td className="p-1.5 text-right">
                    <button type="button" aria-label="Xóa dòng" onClick={() => setPrizes(prizes.filter((x) => x.key !== p.key))} className="size-10 border border-line-strong text-fg-2 hover:text-brand-text">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <StepFooter
        tournamentId={tournamentId}
        prev="le-phi"
        next="xuat-ban"
        nextLabel="Tiếp: Xuất bản →"
        pending={pending}
        error={error}
        savedAt={savedAt}
        onSave={(next) => save(() => saveScheduleAction(tournamentId, { sessions, assignments: assign, prizes }), next)}
      />
    </div>
  );
}
