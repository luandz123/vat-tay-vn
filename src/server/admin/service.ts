/** Admin nền tảng: quản lý người dùng, BTC, giải; xem nhật ký thay đổi kết quả. */
import { and, desc, eq, ilike, inArray, like, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { armTables, auditLogs, organizationMembers, organizations, tournaments, users } from '@/db/schema';
import { AppError, forbidden } from '../shared/errors';

export async function requireAdmin(userId: string) {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (u?.role !== 'admin') throw forbidden();
  return u;
}

export async function adminOverview(userId: string, q = '') {
  await requireAdmin(userId);
  const like_ = `%${q.trim()}%`;
  const [userRows, orgRows, tRows, [counts]] = await Promise.all([
    db
      .select({ id: users.id, email: users.email, fullName: users.fullName, role: users.role, createdAt: users.createdAt, orgs: sql<number>`(select count(*)::int from ${organizationMembers} m where m.user_id = ${users.id})` })
      .from(users)
      .where(q ? or(ilike(users.email, like_), ilike(users.fullName, like_)) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(100),
    db
      .select({ id: organizations.id, name: organizations.name, createdAt: organizations.createdAt, sepay: sql<boolean>`${organizations.webhookSecret} is not null`, tournaments: sql<number>`(select count(*)::int from ${tournaments} t where t.organization_id = ${organizations.id})` })
      .from(organizations)
      .where(q ? ilike(organizations.name, like_) : undefined)
      .orderBy(desc(organizations.createdAt))
      .limit(100),
    db
      .select({ id: tournaments.id, name: tournaments.name, slug: tournaments.slug, status: tournaments.status, startsAt: tournaments.startsAt, org: organizations.name, registered: sql<number>`(select count(*)::int from registrations r where r.tournament_id = ${tournaments.id} and r.status <> 'cancelled')` })
      .from(tournaments)
      .innerJoin(organizations, eq(organizations.id, tournaments.organizationId))
      .where(q ? or(ilike(tournaments.name, like_), ilike(tournaments.slug, like_)) : undefined)
      .orderBy(desc(tournaments.createdAt))
      .limit(100),
    db.select({
      users: sql<number>`(select count(*)::int from users)`,
      orgs: sql<number>`(select count(*)::int from organizations)`,
      tournaments: sql<number>`(select count(*)::int from tournaments)`,
      registrations: sql<number>`(select count(*)::int from registrations where status <> 'cancelled')`,
    }).from(sql`(select 1) as x`),
  ]);
  return { users: userRows, organizations: orgRows, tournaments: tRows, counts: counts! };
}

export async function setUserRole(adminId: string, userId: string, role: unknown) {
  const admin = await requireAdmin(adminId);
  const r = z.enum(['user', 'admin']).parse(role);
  if (admin.id === userId && r !== 'admin') throw new AppError('INVALID', 'Không tự gỡ quyền admin của chính mình');
  await db.update(users).set({ role: r, updatedAt: new Date() }).where(eq(users.id, userId));
  await db.insert(auditLogs).values({ actorUserId: adminId, entity: 'user', entityId: userId, action: 'admin.set_role', before: null, after: { role: r } });
}

/** Ẩn giải vi phạm (chuyển 'cancelled'): trang công khai không còn nhận đăng ký. */
export async function setTournamentStatus(adminId: string, tournamentId: string, status: unknown) {
  await requireAdmin(adminId);
  const s = z.enum(['draft', 'published', 'ongoing', 'finished', 'cancelled']).parse(status);
  const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) });
  if (!t) throw new AppError('NOT_FOUND', 'Không tìm thấy giải');
  await db.update(tournaments).set({ status: s, updatedAt: new Date() }).where(eq(tournaments.id, t.id));
  await db.insert(auditLogs).values({ tournamentId: t.id, actorUserId: adminId, entity: 'tournament', entityId: t.id, action: 'admin.set_status', before: { status: t.status }, after: { status: s } });
}

/** Nhật ký thay đổi kết quả (và các thao tác nhạy cảm khác nếu chọn). */
export async function auditLog(adminId: string, opts: { tournamentId?: string; onlyResults?: boolean } = {}) {
  await requireAdmin(adminId);
  const conds = [];
  if (opts.tournamentId) conds.push(eq(auditLogs.tournamentId, opts.tournamentId));
  if (opts.onlyResults !== false) conds.push(or(like(auditLogs.action, 'result.%'), like(auditLogs.action, 'bracket.%'), inArray(auditLogs.action, ['entry.move']))!);
  return db
    .select({ log: auditLogs, actorEmail: users.email, tableName: armTables.name, tournamentName: tournaments.name })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .leftJoin(armTables, eq(armTables.id, auditLogs.actorTableId))
    .leftJoin(tournaments, eq(tournaments.id, auditLogs.tournamentId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(300);
}
