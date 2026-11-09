import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => import('@/test/pglite-db'));

import { eq } from 'drizzle-orm';
import { allAroundSources, categories } from '@/db/schema';
import { createUser, db, resetDb } from '@/test/pglite-db';
import { createOrganization } from '../organizations/service';
import { AppError } from '../shared/errors';
import {
  createDraft,
  getChecklist,
  getPublicTournament,
  getTournamentForEdit,
  publishTournament,
  saveCategories,
  saveImages,
  savePricing,
  saveSchedule,
  updateInfo,
} from './service';

beforeEach(resetDb);

async function setup() {
  const user = await createUser();
  const org = await createOrganization(user.id, {
    name: 'CLB Vật tay PTIT',
    phone: '0912345678',
    bankBin: '970436',
    bankAccountNo: '0123456789',
    bankAccountName: 'Nguyen Van A',
  });
  const t = await createDraft(user.id, { organizationId: org.id, name: 'Giải vật tay PTIT mở rộng 2026' });
  return { user, org, t };
}

const info = {
  name: 'Giải vật tay PTIT mở rộng 2026',
  slug: 'ptit-2026',
  startsAt: '2026-12-15T07:00',
  venueName: 'Nhà thi đấu PTIT',
  registrationDeadline: '2026-12-12T23:59',
  birthYearMin: '1996',
  birthYearMax: '2008',
  weightToleranceKg: '1',
};

describe('tạo giải (integration, Postgres thật trong bộ nhớ)', () => {
  it('BTC: tên chủ TK viết hoa, người tạo là owner', async () => {
    const { org } = await setup();
    expect(org.bankAccountName).toBe('NGUYEN VAN A');
    expect(org.contacts).toEqual({ phone: '0912345678' });
  });

  it('nháp có slug tiếng Việt và tiền tố mã', async () => {
    const { t } = await setup();
    expect(t.slug).toBe('giai-vat-tay-ptit-mo-rong-2026');
    expect(t.codePrefix).toMatch(/^PT\d{2}$/);
    expect(t.status).toBe('draft');
  });

  it('slug trùng được thêm hậu tố', async () => {
    const { user, org } = await setup();
    const t2 = await createDraft(user.id, { organizationId: org.id, name: 'Giải vật tay PTIT mở rộng 2026' });
    expect(t2.slug).toBe('giai-vat-tay-ptit-mo-rong-2026-2');
  });

  it('người ngoài BTC không sửa được giải', async () => {
    const { t } = await setup();
    const stranger = await createUser('khac@vidu.com');
    await expect(updateInfo(stranger.id, t.id, info)).rejects.toBeInstanceOf(AppError);
  });

  it('đủ 4 bước thì xuất bản được và hiện trên trang công khai', async () => {
    const { user, t } = await setup();
    await updateInfo(user.id, t.id, info);
    await saveImages(user.id, t.id, { coverKey: `tournaments/${t.id}/cover-1.jpg`, ogKey: `tournaments/${t.id}/og-1.jpg` });

    await saveCategories(user.id, t.id, {
      categories: [
        { key: 'a', kind: 'weight', hand: 'right', gender: 'male', label: '-63kg', weightMaxKg: 63 },
        { key: 'b', kind: 'weight', hand: 'right', gender: 'male', label: '+63kg', weightMinKg: 63 },
        { key: 'c', kind: 'all_around', hand: 'right', gender: 'male', label: 'Toàn năng', allAroundMaxPlace: 2, allAroundSourceKeys: ['a', 'b'] },
      ],
    });
    const cats = await db.select().from(categories).where(eq(categories.tournamentId, t.id));
    expect(cats).toHaveLength(3);
    expect(await db.select().from(allAroundSources)).toHaveLength(2);

    await savePricing(user.id, t.id, {
      tiers: [
        { key: 'x', kind: 'online', name: 'Online', singleHandPrice: '150.000', bothHandsPrice: '250000' },
        { key: 'y', kind: 'onsite', name: 'Tại sân', singleHandPrice: 200000, bothHandsPrice: 320000 },
      ],
    });

    const edit = await getTournamentForEdit(user.id, t.id);
    const catId = edit.categories.find((c) => c.label === '-63kg')!.id;
    await saveSchedule(user.id, t.id, {
      sessions: [{ key: 's1', name: 'Chiều', competeStart: '2026-12-15T14:00' }],
      assignments: Object.fromEntries(edit.categories.map((c) => [c.id, 's1'])),
      prizes: [
        { key: 'p1', categoryKey: null, place: 1, title: 'Nhất', description: 'HCV', cashAmount: '1000000' },
        { key: 'p2', categoryKey: catId, place: 1, title: 'Cúp riêng' },
      ],
    });

    const issues = await getChecklist(user.id, t.id);
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);

    expect(await getPublicTournament('ptit-2026')).toBeNull(); // nháp chưa công khai
    const published = await publishTournament(user.id, t.id);
    expect(published.status).toBe('published');

    const pub = await getPublicTournament('ptit-2026');
    expect(pub!.tournament.weightToleranceKg).toBe(1);
    expect(pub!.tournament.startsAt!.toISOString()).toBe('2026-12-15T00:00:00.000Z');
    expect(pub!.categories.map((c) => c.label)).toEqual(['-63kg', '+63kg', 'Toàn năng']);
    expect(pub!.categories[1]!.weightMinKg).toBe(63);
    expect(pub!.priceTiers.map((p) => p.singleHandPrice)).toEqual([150000, 200000]);
    expect(pub!.sessions).toHaveLength(1);
    expect(pub!.categories.every((c) => c.sessionId === pub!.sessions[0]!.id)).toBe(true);
    expect(pub!.prizes.find((p) => p.title === 'Cúp riêng')!.categoryId).toBe(catId);
    expect(pub!.contacts.phone).toBe('0912345678');
    expect(pub!.registeredCount).toBe(0);
  });

  it('lưu lại hạng mục giữ id cũ, xóa hạng bị bỏ', async () => {
    const { user, t } = await setup();
    await saveCategories(user.id, t.id, {
      categories: [
        { key: 'a', kind: 'weight', hand: 'right', gender: 'male', label: '-63kg', weightMaxKg: 63 },
        { key: 'b', kind: 'weight', hand: 'left', gender: 'male', label: '-63kg', weightMaxKg: 63 },
      ],
    });
    const first = (await getTournamentForEdit(user.id, t.id)).categories;
    await saveCategories(user.id, t.id, {
      categories: [{ ...first[0]!, key: first[0]!.id, label: '-64kg', weightMaxKg: 64, allAroundSourceKeys: [] }],
    });
    const second = (await getTournamentForEdit(user.id, t.id)).categories;
    expect(second).toHaveLength(1);
    expect(second[0]!.id).toBe(first[0]!.id);
    expect(second[0]!.weightMaxKg).toBe(64);
  });

  it('thiếu thông tin thì không xuất bản được', async () => {
    const { user, t } = await setup();
    await expect(publishTournament(user.id, t.id)).rejects.toThrow('Còn thông tin bắt buộc');
  });

  it('không đổi slug sau khi xuất bản', async () => {
    const { user, t } = await setup();
    await updateInfo(user.id, t.id, info);
    await saveImages(user.id, t.id, { coverKey: `tournaments/${t.id}/cover-1.jpg`, ogKey: `tournaments/${t.id}/og-1.jpg` });
    await saveCategories(user.id, t.id, { categories: [{ key: 'a', kind: 'weight', hand: 'right', gender: 'male', label: '-63kg', weightMaxKg: 63 }] });
    await savePricing(user.id, t.id, { tiers: [{ key: 'x', kind: 'online', name: 'Online', singleHandPrice: 0 }] });
    await publishTournament(user.id, t.id);
    await expect(updateInfo(user.id, t.id, { ...info, slug: 'doi-ten' })).rejects.toThrow('Không đổi được link trang giải');
  });

  it('key ảnh của giải khác bị từ chối', async () => {
    const { user, t } = await setup();
    await expect(saveImages(user.id, t.id, { coverKey: 'tournaments/khac/cover-1.jpg', ogKey: `tournaments/${t.id}/og-1.jpg` })).rejects.toThrow(
      'Ảnh không hợp lệ',
    );
  });
});
