import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { renderCertificates } from '@/server/results/certificate';
import { PLACE_LABEL, getResultsForUser } from '@/server/results/service';
import { AppError } from '@/server/shared/errors';
import { formatVnd } from '@/server/shared/time';
import { HAND_LABEL } from '@/server/tournaments/templates';

export const runtime = 'nodejs';

/** PDF bằng khen: ?hang=<categoryId> cho một hạng, bỏ trống = cả giải. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  try {
    const { tournament, results } = await getResultsForUser(user.id, id);
    const only = request.nextUrl.searchParams.get('hang');
    const org = await db.query.organizations.findFirst({ where: eq(organizations.id, tournament.organizationId) });
    const items = results
      .filter((r) => !only || r.category.id === only)
      .flatMap((r) =>
        r.placings.map((p) => ({
          athleteName: p.name,
          club: p.club,
          placeLabel: PLACE_LABEL[p.place] ?? `hạng ${p.place}`,
          categoryLabel: `${r.category.kind === 'all_around' ? r.category.label : `${HAND_LABEL[r.category.hand]} ${r.category.gender === 'female' ? 'Nữ' : r.category.gender === 'male' ? 'Nam' : ''} ${r.category.label}`}`.replace(/\s+/g, ' '),
          prize: p.prize ? [p.prize.description, p.prize.cashAmount ? formatVnd(p.prize.cashAmount) : null].filter(Boolean).join(' + ') || null : null,
        })),
      );
    if (!items.length) return NextResponse.json({ error: 'Chưa có kết quả để in bằng khen' }, { status: 404 });
    const pdf = await renderCertificates({ name: tournament.name, organizationName: org?.name ?? '', startsAt: tournament.startsAt, venueName: tournament.venueName }, items);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="bang-khen-${tournament.slug}.pdf"` },
    });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
