/**
 * VậtTay.vn — database schema (Drizzle ORM, PostgreSQL chuẩn).
 *
 * Quy tắc để dễ chuyển sang NestJS sau này:
 *  - Không khóa ngoại tới auth.users của Supabase; dùng bảng `users` riêng + cột `authSubject`.
 *  - Không dùng hàm SQL / trigger / RLS cho logic nghiệp vụ. Logic nằm trong code TypeScript.
 *  - Migration chạy bằng drizzle-kit, không sửa schema trên dashboard Supabase.
 *
 * Quy ước: tiền = bigint VND (number mode), cân nặng = numeric(5,2) kg, thời gian = timestamptz.
 */
import { sql } from 'drizzle-orm';
import {
  pgTable, pgEnum, uuid, text, varchar, integer, smallint, bigint, numeric, boolean,
  timestamp, jsonb, date, uniqueIndex, index, check, type AnyPgColumn,
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => bigint(name, { mode: 'number' });
const kg = (name: string) => numeric(name, { precision: 5, scale: 2 });

/* ───────────────────────────── Enums ───────────────────────────── */

export const platformRole = pgEnum('platform_role', ['user', 'admin']);
export const orgRole = pgEnum('org_role', ['owner', 'staff']);
export const tournamentStatus = pgEnum('tournament_status', ['draft', 'published', 'ongoing', 'finished', 'cancelled']);
export const financeVisibility = pgEnum('finance_visibility', ['off', 'organizers', 'athletes', 'public']);
export const hand = pgEnum('hand', ['left', 'right']);
export const gender = pgEnum('gender', ['male', 'female', 'open']);
export const categoryKind = pgEnum('category_kind', ['weight', 'all_around']);
export const bracketType = pgEnum('bracket_type', ['single', 'double']);
export const priceTierKind = pgEnum('price_tier_kind', ['online', 'onsite']);
export const registrationStatus = pgEnum('registration_status', ['pending', 'approved', 'rejected', 'cancelled']);
export const registrationSource = pgEnum('registration_source', ['online', 'onsite']);
export const paymentStatus = pgEnum('payment_status', ['unpaid', 'partial', 'paid', 'refunded']);
export const entryStatus = pgEnum('entry_status', ['active', 'moved', 'withdrawn', 'disqualified']);
export const weighResult = pgEnum('weigh_result', ['pass', 'fail']);
export const paymentMethod = pgEnum('payment_method', ['vietqr', 'cash', 'manual']);
export const paymentProvider = pgEnum('payment_provider', ['none', 'sepay', 'casso']);
export const transactionMatch = pgEnum('transaction_match', ['matched', 'unmatched', 'ignored']);
export const bracketStatus = pgEnum('bracket_status', ['draft', 'locked', 'in_progress', 'finished']);
export const bracketSide = pgEnum('bracket_side', ['winners', 'losers', 'grand_final', 'third_place']);
export const slot = pgEnum('slot', ['red', 'blue']);
export const matchStatus = pgEnum('match_status', ['pending', 'ready', 'on_table', 'in_progress', 'finished', 'bye', 'skipped']);
export const tableStatus = pgEnum('arm_table_status', ['active', 'paused']);
export const matchEventType = pgEnum('match_event_type', ['assign_table', 'start', 'foul', 'warning', 'result', 'undo', 'note']);
export const notificationKind = pgEnum('notification_kind', ['postpone', 'broadcast', 'payment_reminder']);
export const notificationChannel = pgEnum('notification_channel', ['email', 'page_banner', 'zalo_copy']);

/* ─────────────────────── Người dùng & BTC ─────────────────────── */

export const users = pgTable('users', {
  id: id(),
  /** ID bên nhà cung cấp đăng nhập (Supabase Auth uid hôm nay; Auth.js/Passport sau này). */
  authSubject: text('auth_subject').notNull().unique(),
  email: text('email').unique(),
  fullName: text('full_name'),
  phone: varchar('phone', { length: 20 }),
  role: platformRole('role').notNull().default('user'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Một BTC/CLB, có thể tổ chức nhiều giải. Tiền về tài khoản của BTC này. */
export const organizations = pgTable('organizations', {
  id: id(),
  name: text('name').notNull(),
  contacts: jsonb('contacts').$type<{ zalo?: string; facebook?: string; tiktok?: string; phone?: string }>().notNull().default({}),
  // Thông tin nhận tiền VietQR
  bankBin: varchar('bank_bin', { length: 8 }),
  bankAccountNo: varchar('bank_account_no', { length: 32 }),
  bankAccountName: text('bank_account_name'),
  // Đối soát tự động (BTC tự kết nối)
  paymentProvider: paymentProvider('payment_provider').notNull().default('none'),
  providerApiKeyEnc: text('provider_api_key_enc'), // mã hóa ở tầng ứng dụng, không lưu bản rõ
  webhookSecret: text('webhook_secret'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const organizationMembers = pgTable('organization_members', {
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: orgRole('role').notNull().default('staff'),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('org_member_uq').on(t.organizationId, t.userId)]);

/* ───────────────────────────── Giải đấu ───────────────────────────── */

export const tournaments = pgTable('tournaments', {
  id: id(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  slug: varchar('slug', { length: 60 }).notNull().unique(), // vattay.vn/ptit-2026
  name: text('name').notNull(),
  description: text('description'),
  rules: text('rules'),           // điều lệ
  notes: text('notes'),           // lưu ý: móng tay, trang sức…
  coverImageKey: text('cover_image_key'), // ảnh gốc; bắt buộc khi xuất bản (bản nháp được để trống)
  ogImageKey: text('og_image_key'),                 // ảnh đã cắt 1.91:1
  startsAt: timestamp('starts_at', { withTimezone: true }), // bắt buộc khi xuất bản
  endsAt: timestamp('ends_at', { withTimezone: true }),
  timezone: text('timezone').notNull().default('Asia/Ho_Chi_Minh'),
  venueName: text('venue_name'), // bắt buộc khi xuất bản
  venueAddress: text('venue_address'),
  mapsUrl: text('maps_url'),
  contacts: jsonb('contacts').$type<{ zalo?: string; facebook?: string; tiktok?: string; phone?: string }>(), // null = dùng của organization
  status: tournamentStatus('status').notNull().default('draft'),
  registrationDeadline: timestamp('registration_deadline', { withTimezone: true }),
  capacity: integer('capacity'), // giới hạn số VĐV, null = không giới hạn
  birthYearMin: smallint('birth_year_min'),
  birthYearMax: smallint('birth_year_max'),
  weightToleranceKg: kg('weight_tolerance_kg').notNull().default('0'),
  financeVisibility: financeVisibility('finance_visibility').notNull().default('off'),
  registrationSeq: integer('registration_seq').notNull().default(0), // sinh mã #0083, tăng trong transaction
  codePrefix: varchar('code_prefix', { length: 8 }).notNull(),       // "PT26"
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index('tournament_org_idx').on(t.organizationId), index('tournament_status_idx').on(t.status, t.startsAt)]);

/** Phiên: khung giờ cân + khung giờ thi (sáng tay trái, chiều tay phải…). */
export const sessions = pgTable('sessions', {
  id: id(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  weighInStart: timestamp('weigh_in_start', { withTimezone: true }),
  weighInEnd: timestamp('weigh_in_end', { withTimezone: true }),
  competeStart: timestamp('compete_start', { withTimezone: true }),
  competeEnd: timestamp('compete_end', { withTimezone: true }),
  sortOrder: smallint('sort_order').notNull().default(0),
}, (t) => [index('session_tournament_idx').on(t.tournamentId)]);

/**
 * Hạng mục. kind='weight' là hạng cân thường; kind='all_around' là hạng Toàn năng,
 * VĐV được đưa vào tự động từ các hạng nguồn (bảng allAroundSources).
 */
export const categories = pgTable('categories', {
  id: id(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
  kind: categoryKind('kind').notNull().default('weight'),
  hand: hand('hand').notNull(),
  gender: gender('gender').notNull(),
  label: text('label').notNull(),              // "-63kg", "Ngoại hạng"
  weightMinKg: kg('weight_min_kg'),            // > min (ví dụ +73: min=73, max=null)
  weightMaxKg: kg('weight_max_kg'),            // <= max + dung sai; null = không giới hạn trên
  birthYearMin: smallint('birth_year_min'),    // null = theo giải
  birthYearMax: smallint('birth_year_max'),
  capacity: integer('capacity'),
  bracketType: bracketType('bracket_type').notNull().default('single'),
  /** Chỉ cho all_around: lấy VĐV đạt hạng <= giá trị này (1 = chỉ HCV, 2 = HCV+HCB, 3 = cả HCĐ). */
  allAroundMaxPlace: smallint('all_around_max_place'),
  sortOrder: smallint('sort_order').notNull().default(0),
  createdAt: createdAt(),
}, (t) => [
  index('category_tournament_idx').on(t.tournamentId),
  check('all_around_place_chk', sql`${t.kind} <> 'all_around' OR ${t.allAroundMaxPlace} BETWEEN 1 AND 3`),
]);

export const allAroundSources = pgTable('all_around_sources', {
  allAroundCategoryId: uuid('all_around_category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  sourceCategoryId: uuid('source_category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
}, (t) => [uniqueIndex('all_around_src_uq').on(t.allAroundCategoryId, t.sourceCategoryId)]);

/** Giá theo đợt: online (có hạn) và tại chỗ. Giá theo tay + giá combo 2 tay. */
export const priceTiers = pgTable('price_tiers', {
  id: id(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  kind: priceTierKind('kind').notNull(),
  name: text('name').notNull(),
  validUntil: timestamp('valid_until', { withTimezone: true }), // null = không hết hạn
  singleHandPrice: money('single_hand_price').notNull(),
  bothHandsPrice: money('both_hands_price'),                    // null = không có combo
  sortOrder: smallint('sort_order').notNull().default(0),
}, (t) => [index('price_tier_tournament_idx').on(t.tournamentId)]);

/** Cơ cấu giải thưởng. categoryId null = áp dụng cho mọi hạng. place 4 = khuyến khích. */
export const prizes = pgTable('prizes', {
  id: id(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'cascade' }),
  place: smallint('place').notNull(),
  title: text('title').notNull(),        // "Nhất", "Cúp toàn năng"
  description: text('description'),      // "Huy chương vàng + cúp"
  cashAmount: money('cash_amount'),
}, (t) => [index('prize_tournament_idx').on(t.tournamentId)]);

/* ───────────────────────── VĐV & đăng ký ───────────────────────── */

/**
 * VĐV không cần tài khoản. Nhận diện tạm theo (SĐT chuẩn hóa + tên chuẩn hóa).
 * userId để sau này VĐV tạo tài khoản và nhận lại lịch sử; gộp trùng ở giai đoạn sau.
 */
export const athletes = pgTable('athletes', {
  id: id(),
  fullName: text('full_name').notNull(),
  nameNormalized: text('name_normalized').notNull(), // bỏ dấu, lowercase
  phone: varchar('phone', { length: 20 }).notNull(), // +849xxxxxxxx
  email: text('email'),
  birthYear: smallint('birth_year').notNull(),
  gender: gender('gender').notNull(),
  club: text('club'),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex('athlete_identity_uq').on(t.phone, t.nameNormalized),
  index('athlete_user_idx').on(t.userId),
  check('athlete_gender_chk', sql`${t.gender} <> 'open'`), // 'open' chỉ dùng cho hạng mục
]);

/**
 * Một VĐV có tối đa một registration mỗi giải; các hạng nằm ở registrationEntries.
 * Đăng ký thêm (online hoặc tại sân) = thêm entry vào registration cũ, cộng thêm vào amountDue,
 * paymentStatus tính lại (đang 'paid' có thể về 'partial'). Xem docs/database.md.
 */
export const registrations = pgTable('registrations', {
  id: id(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  athleteId: uuid('athlete_id').notNull().references(() => athletes.id),
  code: varchar('code', { length: 20 }).notNull(),            // "PT26-0083"
  transferRef: varchar('transfer_ref', { length: 30 }).notNull().unique(), // nội dung CK: "PT26 0083"
  ticketToken: varchar('ticket_token', { length: 40 }).notNull().unique(), // link vé riêng + mã QR
  status: registrationStatus('status').notNull().default('pending'),
  source: registrationSource('source').notNull().default('online'),
  priceTierId: uuid('price_tier_id').references(() => priceTiers.id),
  amountDue: money('amount_due').notNull(),
  amountPaid: money('amount_paid').notNull().default(0),
  paymentStatus: paymentStatus('payment_status').notNull().default('unpaid'),
  ageWarning: boolean('age_warning').notNull().default(false), // cảnh báo, không chặn
  consentAt: timestamp('consent_at', { withTimezone: true }),  // đồng ý xử lý dữ liệu (NĐ 13)
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  weighedKg: kg('weighed_kg'),
  weighedAt: timestamp('weighed_at', { withTimezone: true }),
  weighedBy: uuid('weighed_by').references(() => users.id),
  note: text('note'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex('registration_athlete_uq').on(t.tournamentId, t.athleteId),
  uniqueIndex('registration_code_uq').on(t.tournamentId, t.code),
  index('registration_status_idx').on(t.tournamentId, t.status, t.paymentStatus),
]);

/** Mỗi dòng = VĐV thi một hạng mục (một tay). Chuyển hạng: tạo dòng mới, dòng cũ status='moved'. */
export const registrationEntries = pgTable('registration_entries', {
  id: id(),
  registrationId: uuid('registration_id').notNull().references(() => registrations.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id),
  athleteId: uuid('athlete_id').notNull().references(() => athletes.id), // denormalize để ràng buộc unique
  status: entryStatus('status').notNull().default('active'),
  movedFromEntryId: uuid('moved_from_entry_id').references((): AnyPgColumn => registrationEntries.id),
  fee: money('fee').notNull().default(0),           // số tiền tính cho entry này lúc thêm (snapshot)
  priceTierId: uuid('price_tier_id').references(() => priceTiers.id), // đợt giá lúc thêm entry
  weighResult: weighResult('weigh_result'),         // gợi ý của hệ thống, BTC chốt
  autoAdded: boolean('auto_added').notNull().default(false), // true = vào hạng Toàn năng tự động
  seed: smallint('seed'),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('entry_athlete_category_uq').on(t.categoryId, t.athleteId).where(sql`${t.status} = 'active'`),
  index('entry_registration_idx').on(t.registrationId),
]);

/* ───────────────────────────── Thanh toán ───────────────────────────── */

/**
 * Mọi khoản tiền: giao dịch ngân hàng từ webhook SePay/Casso, tiền mặt, xác nhận tay.
 * registrationId null = giao dịch chưa ghép được (sai nội dung/số tiền) → hàng chờ BTC ghép tay.
 */
export const payments = pgTable('payments', {
  id: id(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id),
  registrationId: uuid('registration_id').references(() => registrations.id),
  method: paymentMethod('method').notNull(),
  provider: paymentProvider('provider').notNull().default('none'),
  providerTxnId: text('provider_txn_id'),   // chống ghi trùng khi webhook gửi lại
  amount: money('amount').notNull(),         // âm = hoàn tiền (giai đoạn sau)
  transferContent: text('transfer_content'),
  matchStatus: transactionMatch('match_status').notNull().default('matched'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  recordedBy: uuid('recorded_by').references(() => users.id), // null = tự động
  raw: jsonb('raw'),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('payment_provider_txn_uq').on(t.provider, t.providerTxnId).where(sql`${t.providerTxnId} IS NOT NULL`),
  index('payment_registration_idx').on(t.registrationId),
  index('payment_unmatched_idx').on(t.tournamentId, t.matchStatus),
]);

/** Khoản chi cho báo cáo thu chi (tùy chọn). Thu = tổng payments. */
export const expenses = pgTable('expenses', {
  id: id(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  amount: money('amount').notNull(),
  spentOn: date('spent_on'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: createdAt(),
});

/* ─────────────────────── Bảng đấu & bàn đấu ─────────────────────── */

export const armTables = pgTable('arm_tables', {
  id: id(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),                 // "Bàn 2"
  status: tableStatus('status').notNull().default('active'),
  refereeName: text('referee_name'),
  accessTokenHash: text('access_token_hash'),   // trọng tài vào tablet bằng mã của bàn
  sortOrder: smallint('sort_order').notNull().default(0),
}, (t) => [index('arm_table_tournament_idx').on(t.tournamentId)]);

export const brackets = pgTable('brackets', {
  id: id(),
  categoryId: uuid('category_id').notNull().unique().references(() => categories.id, { onDelete: 'cascade' }),
  type: bracketType('type').notNull(),
  status: bracketStatus('status').notNull().default('draft'),
  drawSeed: integer('draw_seed'), // để bốc thăm tái lập được khi kiểm tra
  thirdPlaceMatch: boolean('third_place_match').notNull().default(true), // loại đơn: đấu tranh hạng 3
  grandFinalReset: boolean('grand_final_reset').notNull().default(true), // loại kép: đấu lại nếu nhánh thua thắng CK
  generatedAt: timestamp('generated_at', { withTimezone: true }),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
});

/**
 * Trận đấu. Cây bảng đấu biểu diễn bằng con trỏ: người thắng đi tới nextMatchId/nextSlot,
 * người thua (loại kép) đi tới loserNextMatchId/loserNextSlot.
 */
export const matches = pgTable('matches', {
  id: id(),
  bracketId: uuid('bracket_id').notNull().references(() => brackets.id, { onDelete: 'cascade' }),
  side: bracketSide('side').notNull().default('winners'),
  round: smallint('round').notNull(),
  position: smallint('position').notNull(),
  number: smallint('number').notNull(),  // "Trận 2" — thứ tự hiển thị trong hạng
  redEntryId: uuid('red_entry_id').references(() => registrationEntries.id),
  blueEntryId: uuid('blue_entry_id').references(() => registrationEntries.id),
  winnerEntryId: uuid('winner_entry_id').references(() => registrationEntries.id),
  status: matchStatus('status').notNull().default('pending'),
  tableId: uuid('table_id').references(() => armTables.id, { onDelete: 'set null' }),
  queuePosition: integer('queue_position'), // thứ tự chờ trên bàn
  nextMatchId: uuid('next_match_id').references((): AnyPgColumn => matches.id),
  nextSlot: slot('next_slot'),
  loserNextMatchId: uuid('loser_next_match_id').references((): AnyPgColumn => matches.id),
  loserNextSlot: slot('loser_next_slot'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  version: integer('version').notNull().default(0), // optimistic lock: tablet gửi kèm version
}, (t) => [
  uniqueIndex('match_position_uq').on(t.bracketId, t.side, t.round, t.position),
  index('match_table_idx').on(t.tableId, t.status, t.queuePosition),
]);

/**
 * Nhật ký sự kiện trận (append-only): lỗi, cảnh cáo, kết quả, hoàn tác.
 * clientEventId do tablet sinh → bấm 2 lần / gửi lại khi mất mạng không bị ghi trùng.
 */
export const matchEvents = pgTable('match_events', {
  id: id(),
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  type: matchEventType('type').notNull(),
  entryId: uuid('entry_id').references(() => registrationEntries.id),
  payload: jsonb('payload'),
  clientEventId: uuid('client_event_id').notNull().unique(),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  actorTableId: uuid('actor_table_id').references(() => armTables.id),
  createdAt: createdAt(),
}, (t) => [index('match_event_match_idx').on(t.matchId, t.createdAt)]);

/** Xếp hạng cuối mỗi hạng mục; nguồn cho hạng Toàn năng, bằng khen, ảnh chia sẻ. */
export const categoryResults = pgTable('category_results', {
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  entryId: uuid('entry_id').notNull().references(() => registrationEntries.id),
  place: smallint('place').notNull(), // 1,2,3 (có trận tranh hạng 3), 4+ = khuyến khích
  finalizedAt: timestamp('finalized_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('result_entry_uq').on(t.categoryId, t.entryId)]);

/* ─────────────────────── Thông báo & nhật ký ─────────────────────── */

export const notifications = pgTable('notifications', {
  id: id(),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  kind: notificationKind('kind').notNull(),
  channels: notificationChannel('channels').array().notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  recipientsCount: integer('recipients_count').notNull().default(0),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: createdAt(),
});

/** Nhật ký thay đổi chung (admin xem). Mọi sửa kết quả / chuyển hạng / sửa tiền đều ghi vào đây. */
export const auditLogs = pgTable('audit_logs', {
  id: id(),
  tournamentId: uuid('tournament_id').references(() => tournaments.id, { onDelete: 'set null' }),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  actorTableId: uuid('actor_table_id').references(() => armTables.id),
  entity: text('entity').notNull(),   // 'match' | 'registration' | 'payment' | ...
  entityId: uuid('entity_id').notNull(),
  action: text('action').notNull(),   // 'result.set' | 'result.undo' | 'entry.move' | ...
  before: jsonb('before'),
  after: jsonb('after'),
  createdAt: createdAt(),
}, (t) => [index('audit_entity_idx').on(t.entity, t.entityId), index('audit_tournament_idx').on(t.tournamentId, t.createdAt)]);
