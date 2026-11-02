/** Schema validate input của wizard tạo giải (dùng chung server action và form client). */
import { z } from 'zod';
import { parseVnLocal } from '../shared/time';

const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const optInt = (min: number, max: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === '') return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: 'custom', message: `Cần số nguyên từ ${min} đến ${max}` });
        return z.NEVER;
      }
      return n;
    });
const optKg = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || n >= 1000) {
      ctx.addIssue({ code: 'custom', message: 'Cân nặng không hợp lệ' });
      return z.NEVER;
    }
    return Math.round(n * 100) / 100;
  });
const vnDateTime = (required: boolean) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) {
        if (required) ctx.addIssue({ code: 'custom', message: 'Bắt buộc' });
        return null;
      }
      const d = parseVnLocal(v);
      if (!d) {
        ctx.addIssue({ code: 'custom', message: 'Thời gian không hợp lệ' });
        return z.NEVER;
      }
      return d;
    });
const money = z
  .union([z.number(), z.string()])
  .transform((v, ctx) => {
    const n = Number(String(v).replace(/[.\s,đ]/g, ''));
    if (!Number.isInteger(n) || n < 0 || n > 100_000_000) {
      ctx.addIssue({ code: 'custom', message: 'Số tiền không hợp lệ' });
      return z.NEVER;
    }
    return n;
  });
const optMoney = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(String(v).replace(/[.\s,đ]/g, ''));
    if (!Number.isInteger(n) || n < 0 || n > 100_000_000) {
      ctx.addIssue({ code: 'custom', message: 'Số tiền không hợp lệ' });
      return z.NEVER;
    }
    return n;
  });

export const createDraftInput = z.object({
  organizationId: z.uuid(),
  name: z.string().trim().min(3, 'Tên giải tối thiểu 3 ký tự').max(150),
});

export const infoInput = z.object({
  name: z.string().trim().min(3, 'Tên giải tối thiểu 3 ký tự').max(150),
  slug: z.string().trim().toLowerCase().min(3).max(60),
  description: optText(5000),
  rules: optText(20000),
  notes: optText(3000),
  startsAt: vnDateTime(false),
  endsAt: vnDateTime(false),
  venueName: optText(200),
  venueAddress: optText(300),
  mapsUrl: optText(500).refine((v) => v === null || /^https:\/\//.test(v), 'Link Google Maps phải bắt đầu bằng https://'),
  registrationDeadline: vnDateTime(false),
  capacity: optInt(1, 10000),
  birthYearMin: optInt(1900, 2100),
  birthYearMax: optInt(1900, 2100),
  weightToleranceKg: optKg.transform((v) => v ?? 0),
  phone: optText(20),
  zalo: optText(200),
  facebook: optText(300),
  tiktok: optText(300),
});

export const categoryInput = z.object({
  key: z.string().min(1).max(64),
  kind: z.enum(['weight', 'all_around']),
  hand: z.enum(['left', 'right']),
  gender: z.enum(['male', 'female', 'open']),
  label: z.string().trim().min(1, 'Thiếu tên hạng').max(40),
  weightMinKg: optKg,
  weightMaxKg: optKg,
  birthYearMin: optInt(1900, 2100),
  birthYearMax: optInt(1900, 2100),
  capacity: optInt(1, 1000),
  allAroundMaxPlace: optInt(1, 3),
  allAroundSourceKeys: z.array(z.string()).max(50).default([]),
});
export const categoriesInput = z.object({ categories: z.array(categoryInput).max(80) });

export const priceTierInput = z.object({
  key: z.string().min(1).max(64),
  kind: z.enum(['online', 'onsite']),
  name: z.string().trim().min(1, 'Thiếu tên đợt').max(60),
  validUntil: vnDateTime(false),
  singleHandPrice: money,
  bothHandsPrice: optMoney,
});
export const pricingInput = z.object({ tiers: z.array(priceTierInput).max(10) });

export const sessionInput = z.object({
  key: z.string().min(1).max(64),
  name: z.string().trim().min(1, 'Thiếu tên phiên').max(60),
  weighInStart: vnDateTime(false),
  weighInEnd: vnDateTime(false),
  competeStart: vnDateTime(false),
  competeEnd: vnDateTime(false),
});
export const prizeInput = z.object({
  key: z.string().min(1).max(64),
  categoryKey: z.string().nullable().default(null),
  place: z.number().int().min(1).max(10),
  title: z.string().trim().min(1, 'Thiếu tên giải thưởng').max(60),
  description: optText(200),
  cashAmount: optMoney,
});
export const scheduleInput = z.object({
  sessions: z.array(sessionInput).max(10),
  /** categoryId → session key (hoặc null) */
  assignments: z.record(z.string(), z.string().nullable()),
  prizes: z.array(prizeInput).max(60),
});

export type InfoInput = z.input<typeof infoInput>;
export type CategoryInput = z.input<typeof categoryInput>;
export type PriceTierInput = z.input<typeof priceTierInput>;
export type SessionInput = z.input<typeof sessionInput>;
export type PrizeInput = z.input<typeof prizeInput>;
