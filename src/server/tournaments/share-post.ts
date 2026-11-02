/** Tự sinh nội dung bài đăng để BTC copy vào group Facebook/Zalo. */
import { formatDayDate, formatTime, formatVnd } from '../shared/time';
import { GENDER_LABEL, HAND_LABEL, type CategoryGender, type Hand } from './templates';

export interface SharePostInput {
  name: string;
  startsAt: Date;
  venueName: string;
  venueAddress: string | null;
  registrationDeadline: Date | null;
  url: string;
  categories: { hand: Hand; gender: CategoryGender; label: string; kind: 'weight' | 'all_around' }[];
  priceTiers: { kind: 'online' | 'onsite'; name: string; singleHandPrice: number; bothHandsPrice: number | null }[];
  prizes: { title: string; description: string | null }[];
  contactPhone: string | null;
}

export function buildSharePost(t: SharePostInput): string {
  const lines: string[] = [];
  lines.push(`🏆 ${t.name.toUpperCase()}`);
  lines.push('');
  lines.push(`🗓 ${formatTime(t.startsAt)} · ${formatDayDate(t.startsAt)}`);
  lines.push(`📍 ${t.venueName}${t.venueAddress ? ` – ${t.venueAddress}` : ''}`);
  lines.push('');

  const groups = new Map<string, string[]>();
  for (const c of t.categories.filter((x) => x.kind === 'weight')) {
    const k = `${HAND_LABEL[c.hand]} · ${GENDER_LABEL[c.gender]}`;
    groups.set(k, [...(groups.get(k) ?? []), c.label]);
  }
  if (groups.size) {
    lines.push('💪 HẠNG MỤC');
    for (const [k, labels] of groups) lines.push(`• ${k}: ${labels.join(', ')}`);
    lines.push('');
  }

  if (t.priceTiers.length) {
    lines.push('💰 LỆ PHÍ');
    for (const p of t.priceTiers) {
      const combo = p.bothHandsPrice !== null ? ` · combo 2 tay ${formatVnd(p.bothHandsPrice)}` : '';
      lines.push(`• ${p.name}: ${p.singleHandPrice === 0 ? 'Miễn phí' : `${formatVnd(p.singleHandPrice)}/tay${combo}`}`);
    }
    lines.push('');
  }

  if (t.prizes.length) {
    lines.push('🥇 GIẢI THƯỞNG');
    for (const p of t.prizes) lines.push(`• ${p.title}${p.description ? `: ${p.description}` : ''}`);
    lines.push('');
  }

  if (t.registrationDeadline) lines.push(`⏰ Hạn đăng ký: ${formatTime(t.registrationDeadline)} · ${formatDayDate(t.registrationDeadline)}`);
  lines.push(`👉 Đăng ký online (không cần tài khoản): ${t.url}`);
  if (t.contactPhone) lines.push(`☎️ Liên hệ BTC: ${t.contactPhone}`);
  return lines.join('\n');
}
