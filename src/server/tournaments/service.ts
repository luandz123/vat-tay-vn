/** Giải đấu: tạo nháp, các bước wizard, xuất bản, đọc trang công khai. */
import { and, asc, count, eq, inArray, like, notInArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  allAroundSources,
  auditLogs,
  brackets,
  categories,
  categoryResults,
  organizations,
  payments,
  priceTiers,
  prizes,
  registrationEntries,
  registrations,
  sessions,
  tournaments,
} from '@/db/schema';
import { requireOrgRole } from '../organizations/service';
import { AppError, notFound } from '../shared/errors';
import { canPublish, publishChecklist, type ChecklistIssue } from './checklist';
import { categoriesInput, createDraftInput, infoInput, pricingInput, scheduleInput } from './inputs';
import { codePrefixFrom, isValidSlug, slugify, uniqueSlug } from './slug';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (v: string | null) => (v === null ? null : Number(v));
const kgStr = (v: number | null) => (v === null ? null : v.toFixed(2));

/* ───────────── Quyền ───────────── */

/** Giải mà người dùng có quyền (thành viên BTC). Ném NOT_FOUND/FORBIDDEN. */
export async function requireTournament(userId: string, tournamentId: string) {
  if (!UUID_RE.test(tournamentId)) throw notFound('Không tìm thấy giải');
  const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) });
  if (!t) throw notFound('Không tìm thấy giải');
  await requireOrgRole(userId, t.organizationId);
  return t;
}

/* ───────────── Tạo & danh sách ───────────── */

export async function createDraft(userId: string, raw: unknown) {
  const input = createDraftInput.parse(raw);
  await requireOrgRole(userId, input.organizationId);
  const base = slugify(input.name);
  const takenRows = await db
    .select({ slug: tournaments.slug })
    .from(tournaments)
    .where(like(tournaments.slug, `${base.slice(0, 56)}%`));
  const slug = uniqueSlug(base, new Set(takenRows.map((r) => r.slug)));
  const [t] = await db
    .insert(tournaments)
    .values({
      organizationId: input.organizationId,
      name: input.name,
      slug,
      codePrefix: codePrefixFrom(input.name, new Date().getFullYear()),
      weightToleranceKg: '0',
    })
    .returning();
  return t!;
}

export async function listOrganizationTournaments(userId: string, organizationId: string) {
  await requireOrgRole(userId, organizationId);
  return db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      slug: tournaments.slug,
      status: tournaments.status,
      startsAt: tournaments.startsAt,
      registered: sql<number>`(select count(*)::int from ${registrations} r where r.tournament_id = ${tournaments.id} and r.status <> 'cancelled')`,
    })
    .from(tournaments)
    .where(eq(tournaments.organizationId, organizationId))
    .orderBy(sql`${tournaments.startsAt} desc nulls first`, sql`${tournaments.createdAt} desc`);
}

/* ───────────── Đọc để sửa ───────────── */

export async function getTournamentForEdit(userId: string, tournamentId: string) {
  const t = await requireTournament(userId, tournamentId);
  const [org, cats, sources, tiers, sess, przs] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(organizations.id, t.organizationId) }),
    db.select().from(categories).where(eq(categories.tournamentId, t.id)).orderBy(asc(categories.sortOrder)),
    db
      .select({ allAroundCategoryId: allAroundSources.allAroundCategoryId, sourceCategoryId: allAroundSources.sourceCategoryId })
      .from(allAroundSources)
      .innerJoin(categories, eq(categories.id, allAroundSources.allAroundCategoryId))
      .where(eq(categories.tournamentId, t.id)),
    db.select().from(priceTiers).where(eq(priceTiers.tournamentId, t.id)).orderBy(asc(priceTiers.sortOrder)),
    db.select().from(sessions).where(eq(sessions.tournamentId, t.id)).orderBy(asc(sessions.sortOrder)),
    db.select().from(prizes).where(eq(prizes.tournamentId, t.id)).orderBy(asc(prizes.place)),
  ]);
  return {
    tournament: { ...t, weightToleranceKg: Number(t.weightToleranceKg) },
    organization: org!,
    categories: cats.map((c) => ({
      ...c,
      weightMinKg: num(c.weightMinKg),
      weightMaxKg: num(c.weightMaxKg),
      allAroundSourceIds: sources.filter((s) => s.allAroundCategoryId === c.id).map((s) => s.sourceCategoryId),
    })),
    priceTiers: tiers,
    sessions: sess,
    prizes: przs,
  };
}
export type TournamentForEdit = Awaited<ReturnType<typeof getTournamentForEdit>>;

/* ───────────── Bước 1: thông tin ───────────── */

export async function updateInfo(userId: string, tournamentId: string, raw: unknown) {
  const t = await requireTournament(userId, tournamentId);
  const v = infoInput.parse(raw);

  if (v.slug !== t.slug) {
    if (t.status !== 'draft') throw new AppError('INVALID', 'Không đổi được đường dẫn sau khi đã xuất bản');
    if (!isValidSlug(v.slug)) throw new AppError('INVALID', 'Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang');
    const clash = await db.query.tournaments.findFirst({ where: eq(tournaments.slug, v.slug), columns: { id: true } });
    if (clash) throw new AppError('CONFLICT', 'Đường dẫn này đã có giải khác dùng');
  }

  const contacts = {
    ...(v.phone && { phone: v.phone }),
    ...(v.zalo && { zalo: v.zalo }),
    ...(v.facebook && { facebook: v.facebook }),
    ...(v.tiktok && { tiktok: v.tiktok }),
  };
  await db
    .update(tournaments)
    .set({
      name: v.name,
      slug: v.slug,
      description: v.description,
      rules: v.rules,
      notes: v.notes,
      startsAt: v.startsAt,
      endsAt: v.endsAt,
      venueName: v.venueName,
      venueAddress: v.venueAddress,
      mapsUrl: v.mapsUrl,
      registrationDeadline: v.registrationDeadline,
      capacity: v.capacity,
      birthYearMin: v.birthYearMin,
      birthYearMax: v.birthYearMax,
      weightToleranceKg: v.weightToleranceKg.toFixed(2),
      contacts: Object.keys(contacts).length ? contacts : null,
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, t.id));
}

/** Key ảnh hợp lệ phải nằm trong thư mục của giải (chống ghi key tùy ý). */
export function imageKeyFor(tournamentId: string, kind: 'cover' | 'og', ext: 'jpg' | 'png' | 'webp') {
  return `tournaments/${tournamentId}/${kind}-${Date.now()}.${ext}`;
}

export async function saveImages(userId: string, tournamentId: string, keys: { coverKey: string; ogKey: string }) {
  const t = await requireTournament(userId, tournamentId);
  const ok = (k: string, kind: 'cover' | 'og') => new RegExp(`^tournaments/${t.id}/${kind}-\\d+\\.(jpg|png|webp)$`).test(k);
  if (!ok(keys.coverKey, 'cover') || !ok(keys.ogKey, 'og')) throw new AppError('INVALID', 'Ảnh không hợp lệ');
  await db
    .update(tournaments)
    .set({ coverImageKey: keys.coverKey, ogImageKey: keys.ogKey, updatedAt: new Date() })
    .where(eq(tournaments.id, t.id));
  return { previous: [t.coverImageKey, t.ogImageKey].filter((k): k is string => !!k) };
}

/* ───────────── Bước 2: hạng mục ───────────── */

/** Lưu toàn bộ danh sách hạng. Hạng đã có VĐV đăng ký thì không xóa được. */
export async function saveCategories(userId: string, tournamentId: string, raw: unknown) {
  const t = await requireTournament(userId, tournamentId);
  const { categories: list } = categoriesInput.parse(raw);

  await db.transaction(async (tx) => {
    const existing = await tx.select({ id: categories.id }).from(categories).where(eq(categories.tournamentId, t.id));
    const existingIds = new Set(existing.map((c) => c.id));
    const keepIds = list.map((c) => c.key).filter((k) => existingIds.has(k));
    const removeIds = [...existingIds].filter((id) => !keepIds.includes(id));

    if (removeIds.length) {
      const [used] = await tx
        .select({ n: count() })
        .from(registrationEntries)
        .where(inArray(registrationEntries.categoryId, removeIds));
      if ((used?.n ?? 0) > 0) throw new AppError('CONFLICT', 'Có hạng đã có VĐV đăng ký, không xóa được. Hãy chuyển VĐV sang hạng khác trước.');
      await tx.delete(categories).where(inArray(categories.id, removeIds));
    }

    const keyToId = new Map<string, string>();
    for (const [i, c] of list.entries()) {
      const values = {
        kind: c.kind,
        hand: c.hand,
        gender: c.gender,
        label: c.label,
        weightMinKg: kgStr(c.weightMinKg),
        weightMaxKg: kgStr(c.weightMaxKg),
        birthYearMin: c.birthYearMin,
        birthYearMax: c.birthYearMax,
        capacity: c.capacity,
        allAroundMaxPlace: c.kind === 'all_around' ? (c.allAroundMaxPlace ?? 1) : null,
        sortOrder: i,
      };
      if (existingIds.has(c.key)) {
        await tx.update(categories).set(values).where(eq(categories.id, c.key));
        keyToId.set(c.key, c.key);
      } else {
        const [row] = await tx.insert(categories).values({ ...values, tournamentId: t.id }).returning({ id: categories.id });
        keyToId.set(c.key, row!.id);
      }
    }

    const allAroundIds = list.filter((c) => c.kind === 'all_around').map((c) => keyToId.get(c.key)!);
    const currentIds = [...keyToId.values()];
    if (currentIds.length) {
      await tx.delete(allAroundSources).where(inArray(allAroundSources.allAroundCategoryId, currentIds));
    }
    const links = list
      .filter((c) => c.kind === 'all_around')
      .flatMap((c) =>
        c.allAroundSourceKeys
          .map((k) => keyToId.get(k))
          .filter((id): id is string => !!id && !allAroundIds.includes(id))
          .map((sourceCategoryId) => ({ allAroundCategoryId: keyToId.get(c.key)!, sourceCategoryId })),
      );
    if (links.length) await tx.insert(allAroundSources).values(links);
  });
}

/* ───────────── Bước 3: lệ phí ───────────── */

export async function savePricing(userId: string, tournamentId: string, raw: unknown) {
  const t = await requireTournament(userId, tournamentId);
  const { tiers } = pricingInput.parse(raw);
  await db.transaction(async (tx) => {
    const existing = await tx.select({ id: priceTiers.id }).from(priceTiers).where(eq(priceTiers.tournamentId, t.id));
    const existingIds = new Set(existing.map((r) => r.id));
    const keep = tiers.map((x) => x.key).filter((k) => existingIds.has(k));
    await deleteUnreferencedTiers(tx, t.id, keep);
    for (const [i, p] of tiers.entries()) {
      const values = {
        kind: p.kind,
        name: p.name,
        validUntil: p.validUntil,
        singleHandPrice: p.singleHandPrice,
        bothHandsPrice: p.bothHandsPrice,
        sortOrder: i,
      };
      if (existingIds.has(p.key)) await tx.update(priceTiers).set(values).where(eq(priceTiers.id, p.key));
      else await tx.insert(priceTiers).values({ ...values, tournamentId: t.id });
    }
  });
}

async function deleteUnreferencedTiers(tx: Tx, tournamentId: string, keepIds: string[]) {
  const cond = keepIds.length
    ? and(eq(priceTiers.tournamentId, tournamentId), notInArray(priceTiers.id, keepIds))
    : eq(priceTiers.tournamentId, tournamentId);
  const toDelete = await tx.select({ id: priceTiers.id }).from(priceTiers).where(cond);
  if (!toDelete.length) return;
  const ids = toDelete.map((r) => r.id);
  const [used] = await tx.select({ n: count() }).from(registrations).where(inArray(registrations.priceTierId, ids));
  if ((used?.n ?? 0) > 0) throw new AppError('CONFLICT', 'Đợt giá đã có người đăng ký, không xóa được. Hãy cho hết hạn thay vì xóa.');
  await tx.delete(priceTiers).where(inArray(priceTiers.id, ids));
}

/* ───────────── Bước 4: lịch phiên & giải thưởng ───────────── */

export async function saveSchedule(userId: string, tournamentId: string, raw: unknown) {
  const t = await requireTournament(userId, tournamentId);
  const v = scheduleInput.parse(raw);
  await db.transaction(async (tx) => {
    const existing = await tx.select({ id: sessions.id }).from(sessions).where(eq(sessions.tournamentId, t.id));
    const existingIds = new Set(existing.map((r) => r.id));
    const keyToId = new Map<string, string>();
    const keep = v.sessions.map((s) => s.key).filter((k) => existingIds.has(k));
    const remove = [...existingIds].filter((id) => !keep.includes(id));
    if (remove.length) await tx.delete(sessions).where(inArray(sessions.id, remove)); // categories.session_id → null

    for (const [i, s] of v.sessions.entries()) {
      const values = {
        name: s.name,
        weighInStart: s.weighInStart,
        weighInEnd: s.weighInEnd,
        competeStart: s.competeStart,
        competeEnd: s.competeEnd,
        sortOrder: i,
      };
      if (existingIds.has(s.key)) {
        await tx.update(sessions).set(values).where(eq(sessions.id, s.key));
        keyToId.set(s.key, s.key);
      } else {
        const [row] = await tx.insert(sessions).values({ ...values, tournamentId: t.id }).returning({ id: sessions.id });
        keyToId.set(s.key, row!.id);
      }
    }

    const catIds = new Set(
      (await tx.select({ id: categories.id }).from(categories).where(eq(categories.tournamentId, t.id))).map((c) => c.id),
    );
    for (const [categoryId, sessionKey] of Object.entries(v.assignments)) {
      if (!catIds.has(categoryId)) continue;
      const sessionId = sessionKey ? (keyToId.get(sessionKey) ?? null) : null;
      await tx.update(categories).set({ sessionId }).where(eq(categories.id, categoryId));
    }

    await tx.delete(prizes).where(eq(prizes.tournamentId, t.id));
    if (v.prizes.length) {
      await tx.insert(prizes).values(
        v.prizes.map((p) => ({
          tournamentId: t.id,
          categoryId: p.categoryKey && catIds.has(p.categoryKey) ? p.categoryKey : null,
          place: p.place,
          title: p.title,
          description: p.description,
          cashAmount: p.cashAmount,
        })),
      );
    }
  });
}

/* ───────────── Bước 5: xuất bản ───────────── */

export async function getChecklist(userId: string, tournamentId: string): Promise<ChecklistIssue[]> {
  const d = await getTournamentForEdit(userId, tournamentId);
  const t = d.tournament;
  const contacts = { ...d.organization.contacts, ...(t.contacts ?? {}) };
  return publishChecklist({
    name: t.name,
    coverImageKey: t.coverImageKey,
    startsAt: t.startsAt,
    venueName: t.venueName,
    registrationDeadline: t.registrationDeadline,
    birthYearMin: t.birthYearMin,
    birthYearMax: t.birthYearMax,
    hasContact: Object.values(contacts).some(Boolean),
    hasBankInfo: !!(d.organization.bankBin && d.organization.bankAccountNo),
    categories: d.categories.map((c) => ({
      label: c.label,
      kind: c.kind,
      hand: c.hand,
      gender: c.gender,
      sessionId: c.sessionId,
      weightMinKg: c.weightMinKg,
      weightMaxKg: c.weightMaxKg,
      sourceCount: c.allAroundSourceIds.length,
    })),
    priceTiers: d.priceTiers,
    sessionsCount: d.sessions.length,
    now: new Date(),
  });
}

export async function publishTournament(userId: string, tournamentId: string) {
  const issues = await getChecklist(userId, tournamentId);
  if (!canPublish(issues)) throw new AppError('INVALID', 'Còn thông tin bắt buộc chưa điền');
  const [t] = await db
    .update(tournaments)
    .set({ status: 'published', publishedAt: sql`coalesce(${tournaments.publishedAt}, now())`, updatedAt: new Date() })
    .where(and(eq(tournaments.id, tournamentId), eq(tournaments.status, 'draft')))
    .returning();
  return t ?? (await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) }))!;
}

/* ───────────── Trang công khai ───────────── */

export async function getPublicTournament(slug: string) {
  const t = await db.query.tournaments.findFirst({ where: eq(tournaments.slug, slug) });
  if (!t || t.status === 'draft') return null;
  const [org, cats, tiers, sess, przs, counts, totals] = await Promise.all([
    db.query.organizations.findFirst({ where: eq(organizations.id, t.organizationId) }),
    db.select().from(categories).where(eq(categories.tournamentId, t.id)).orderBy(asc(categories.sortOrder)),
    db.select().from(priceTiers).where(eq(priceTiers.tournamentId, t.id)).orderBy(asc(priceTiers.sortOrder)),
    db.select().from(sessions).where(eq(sessions.tournamentId, t.id)).orderBy(asc(sessions.sortOrder)),
    db.select().from(prizes).where(eq(prizes.tournamentId, t.id)).orderBy(asc(prizes.place)),
    db
      .select({ categoryId: registrationEntries.categoryId, n: count() })
      .from(registrationEntries)
      .innerJoin(registrations, eq(registrations.id, registrationEntries.registrationId))
      .where(and(eq(registrations.tournamentId, t.id), eq(registrationEntries.status, 'active')))
      .groupBy(registrationEntries.categoryId),
    db
      .select({ total: count() })
      .from(registrations)
      .where(and(eq(registrations.tournamentId, t.id), inArray(registrations.status, ['pending', 'approved']))),
  ]);
  const total = totals[0]?.total ?? 0;
  const byCat = new Map(counts.map((c) => [c.categoryId, c.n]));
  return {
    tournament: { ...t, weightToleranceKg: Number(t.weightToleranceKg) },
    contacts: { ...(org?.contacts ?? {}), ...(t.contacts ?? {}) },
    organizationName: org?.name ?? '',
    categories: cats.map((c) => ({ ...c, weightMinKg: num(c.weightMinKg), weightMaxKg: num(c.weightMaxKg), registered: byCat.get(c.id) ?? 0 })),
    priceTiers: tiers,
    sessions: sess,
    prizes: przs,
    registeredCount: total,
  };
}
export type PublicTournament = NonNullable<Awaited<ReturnType<typeof getPublicTournament>>>;

/* ───────────── Xóa giải ───────────── */

/** Số liệu cho hộp thoại xác nhận xóa. */
export async function deletionImpact(userId: string, tournamentId: string) {
  const t = await requireTournament(userId, tournamentId);
  const [r] = await db
    .select({
      registrations: sql<number>`(select count(*)::int from ${registrations} where tournament_id = ${t.id})`,
      paid: sql<number>`(select coalesce(sum(amount),0)::bigint from ${payments} where tournament_id = ${t.id} and match_status = 'matched')`,
    })
    .from(sql`(select 1) x`);
  return { slug: t.slug, name: t.name, status: t.status, registrations: r!.registrations, paid: Number(r!.paid) };
}

/**
 * Xóa hẳn giải cùng toàn bộ hạng mục, đăng ký, bảng đấu, kết quả, khoản thu/chi. Chỉ chủ BTC,
 * phải gõ đúng đường dẫn giải. Hồ sơ VĐV (dùng chung giữa các giải) được giữ. Không hoàn tác được.
 * Trả về key ảnh để xóa khỏi kho lưu trữ.
 */
export async function deleteTournament(userId: string, tournamentId: string, confirmSlug: string) {
  const t = await requireTournament(userId, tournamentId);
  await requireOrgRole(userId, t.organizationId, ['owner']);
  if (confirmSlug.trim() !== t.slug) throw new AppError('INVALID', 'Đường dẫn xác nhận không khớp');
  await db.transaction(async (tx) => {
    // Xóa tường minh theo thứ tự phụ thuộc (trận/kết quả tham chiếu VĐV-hạng, payments không xóa dây chuyền)
    const catIds = (await tx.select({ id: categories.id }).from(categories).where(eq(categories.tournamentId, t.id))).map((c) => c.id);
    if (catIds.length) {
      await tx.delete(brackets).where(inArray(brackets.categoryId, catIds)); // → matches → match_events
      await tx.delete(categoryResults).where(inArray(categoryResults.categoryId, catIds));
    }
    await tx.delete(payments).where(eq(payments.tournamentId, t.id));
    await tx.delete(registrations).where(eq(registrations.tournamentId, t.id)); // → registration_entries
    await tx.delete(tournaments).where(eq(tournaments.id, t.id)); // → hạng, phiên, giá, giải thưởng, bàn, thông báo, chi
    await tx.insert(auditLogs).values({
      actorUserId: userId, entity: 'tournament', entityId: t.id, action: 'tournament.delete',
      before: { name: t.name, slug: t.slug, status: t.status }, after: null,
    });
  });
  return { slug: t.slug, imageKeys: [t.coverImageKey, t.ogImageKey].filter((k): k is string => !!k) };
}
