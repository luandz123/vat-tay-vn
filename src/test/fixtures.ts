/** Dữ liệu mẫu cho integration test: một giải đã xuất bản với 3 hạng và 2 đợt giá. */
import { eq } from 'drizzle-orm';
import { tournaments } from '@/db/schema';
import { createOrganization } from '@/server/organizations/service';
import { createDraft, getTournamentForEdit, saveCategories, saveImages, savePricing, updateInfo, publishTournament } from '@/server/tournaments/service';
import { createUser, db } from './pglite-db';

export async function publishedTournament(opts: { capacity?: string; categoryCapacity?: number } = {}) {
  const user = await createUser();
  const org = await createOrganization(user.id, { name: 'CLB PTIT', phone: '0912345678', bankBin: '970436', bankAccountNo: '0123456789', bankAccountName: 'CLB PTIT' });
  const t = await createDraft(user.id, { organizationId: org.id, name: 'Giải PTIT 2026' });
  await updateInfo(user.id, t.id, {
    name: 'Giải PTIT 2026',
    slug: 'ptit-2026',
    startsAt: '2026-12-15T07:00',
    venueName: 'NTĐ PTIT',
    registrationDeadline: '2026-12-12T23:59',
    birthYearMin: '1996',
    birthYearMax: '2008',
    capacity: opts.capacity ?? '',
    weightToleranceKg: '1',
  });
  await saveImages(user.id, t.id, { coverKey: `tournaments/${t.id}/cover-1.jpg`, ogKey: `tournaments/${t.id}/og-1.jpg` });
  await saveCategories(user.id, t.id, {
    categories: [
      { key: 'r63', kind: 'weight', hand: 'right', gender: 'male', label: '-63kg', weightMaxKg: 63, capacity: opts.categoryCapacity ?? null },
      { key: 'l63', kind: 'weight', hand: 'left', gender: 'male', label: '-63kg', weightMaxKg: 63 },
      { key: 'rf', kind: 'weight', hand: 'right', gender: 'female', label: '-55kg', weightMaxKg: 55 },
    ],
  });
  await savePricing(user.id, t.id, {
    tiers: [
      { key: 'on', kind: 'online', name: 'Online', singleHandPrice: 150000, bothHandsPrice: 250000 },
      { key: 'off', kind: 'onsite', name: 'Tại sân', singleHandPrice: 200000, bothHandsPrice: 320000 },
    ],
  });
  await publishTournament(user.id, t.id);
  const d = await getTournamentForEdit(user.id, t.id);
  const cat = (hand: string, label: string, gender = 'male') => d.categories.find((c) => c.hand === hand && c.label === label && c.gender === gender)!.id;
  return { user, org, tournament: (await db.query.tournaments.findFirst({ where: eq(tournaments.id, t.id) }))!, r63: cat('right', '-63kg'), l63: cat('left', '-63kg'), f55: cat('right', '-55kg', 'female') };
}

export const athleteInput = (over: Record<string, unknown> = {}) => ({
  fullName: 'nguyễn minh khang',
  phone: '0912 345 678',
  birthYear: 2000,
  gender: 'male',
  consent: true,
  ...over,
});

export const NOW = new Date('2026-12-01T03:00:00Z');
