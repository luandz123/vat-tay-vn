import { ImageResponse } from 'next/og';
import { loadGoogleFont } from '@/lib/og-font';
import { getPublicBoard } from '@/server/brackets/public';
import { isValidSlug } from '@/server/tournaments/slug';

/** Ảnh chia sẻ kết quả 1080×1350 (tỉ lệ 4:5 cho Facebook/Zalo): "Vô địch hạng -63kg tay phải". */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string; categoryId: string }> }) {
  const { slug, categoryId } = await params;
  const d = isValidSlug(slug) ? await getPublicBoard(slug) : null;
  const c = d?.categories.find((x) => x.id === categoryId);
  if (!d || !c || !c.results.length) return new Response('Chưa có kết quả', { status: 404 });
  const name = (place: number) => {
    const r = c.results.find((x) => x.place === place);
    return r ? d.entries[r.entryId]?.name ?? '' : '';
  };
  const club = (() => {
    const r = c.results.find((x) => x.place === 1);
    return r ? d.entries[r.entryId]?.club ?? '' : '';
  })();
  const [display, body] = await Promise.all([loadGoogleFont('Barlow Condensed', 800, true), loadGoogleFont('Barlow', 600)]);
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/^https?:\/\//, '');
  const hand = c.hand === 'left' ? 'tay trái' : 'tay phải';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#D9262E', color: 'white', fontFamily: 'Body' }}>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '72px 72px 0' }}>
          <div style={{ fontSize: 34, letterSpacing: 6, textTransform: 'uppercase' }}>{d.tournament.name}</div>
          <div style={{ fontFamily: 'Display', fontSize: 150, lineHeight: 0.9, textTransform: 'uppercase', marginTop: 28 }}>Vô địch</div>
          <div style={{ fontFamily: 'Display', fontSize: 110, lineHeight: 0.95, textTransform: 'uppercase' }}>{`${c.label} ${hand}`}</div>
        </div>
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', padding: '0 72px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: 'Display', fontSize: 130, lineHeight: 1, textTransform: 'uppercase' }}>{name(1)}</div>
            {club && <div style={{ fontSize: 40, marginTop: 12 }}>{club}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '0 72px 48px', fontSize: 40, gap: 8 }}>
          {name(2) && <div style={{ display: 'flex' }}>{`Nhì: ${name(2)}`}</div>}
          {name(3) && <div style={{ display: 'flex' }}>{`Ba: ${name(3)}`}</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0B0C10', padding: '28px 72px', fontSize: 32 }}>
          <span>{`${site}/${d.tournament.slug}`}</span>
          <span style={{ fontFamily: 'Display' }}>VẬTTAY.VN</span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: [
        { name: 'Display', data: display, weight: 800, style: 'italic' },
        { name: 'Body', data: body, weight: 600, style: 'normal' },
      ],
      headers: { 'Cache-Control': 'public, s-maxage=60' },
    },
  );
}
