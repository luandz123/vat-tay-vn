/** Bằng khen PDF (A4 ngang), một trang mỗi VĐV đạt giải. Font Barlow có dấu tiếng Việt. */
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { formatDayDate } from '../shared/time';

let fontsReady: Promise<void> | null = null;

async function ttf(family: string, weight: number, italic = false) {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:ital,wght@${italic ? 1 : 0},${weight}&subset=vietnamese`;
  const css = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1)' } })).text();
  const src = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1];
  if (!src) throw new Error('Không tải được font');
  return src;
}

function ensureFonts() {
  fontsReady ??= (async () => {
    const [regular, semibold, display] = await Promise.all([ttf('Barlow', 400), ttf('Barlow', 600), ttf('Barlow Condensed', 800, true)]);
    Font.register({ family: 'Barlow', fonts: [{ src: regular, fontWeight: 400 }, { src: semibold, fontWeight: 600 }] });
    Font.register({ family: 'BarlowCondensed', fonts: [{ src: display, fontWeight: 800, fontStyle: 'italic' }] });
    Font.registerHyphenationCallback((w) => [w]);
  })();
  return fontsReady;
}

export interface CertificateItem {
  athleteName: string;
  club: string | null;
  placeLabel: string;
  categoryLabel: string;
  prize: string | null;
}

const s = StyleSheet.create({
  page: { fontFamily: 'Barlow', padding: 36, backgroundColor: '#ffffff' },
  frame: { flex: 1, borderWidth: 6, borderColor: '#0B0C10', padding: 30, alignItems: 'center', justifyContent: 'space-between' },
  band: { position: 'absolute', top: 0, left: 0, right: 0, height: 14, backgroundColor: '#D9262E' },
  org: { fontSize: 14, letterSpacing: 3, color: '#3c404b', textTransform: 'uppercase', marginTop: 10 },
  title: { fontFamily: 'BarlowCondensed', fontWeight: 800, fontStyle: 'italic', fontSize: 72, color: '#D9262E', textTransform: 'uppercase' },
  sub: { fontSize: 16, color: '#3c404b' },
  name: { fontFamily: 'BarlowCondensed', fontWeight: 800, fontStyle: 'italic', fontSize: 54, color: '#0B0C10', textTransform: 'uppercase', textAlign: 'center' },
  achieve: { fontSize: 22, fontWeight: 600, color: '#0B0C10', textAlign: 'center' },
  foot: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', fontSize: 12, color: '#3c404b' },
  sign: { alignItems: 'center', width: 200 },
});

export async function renderCertificates(t: { name: string; organizationName: string; startsAt: Date | null; venueName: string | null }, items: CertificateItem[]) {
  await ensureFonts();
  return renderToBuffer(
    <Document title={`Bằng khen · ${t.name}`} author={t.organizationName}>
      {items.map((it, i) => (
        <Page key={i} size="A4" orientation="landscape" style={s.page}>
          <View style={s.frame}>
            <View style={s.band} />
            <Text style={s.org}>{t.organizationName}</Text>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={s.title}>Giấy chứng nhận</Text>
              <Text style={s.sub}>Ban tổ chức {t.name} chứng nhận vận động viên</Text>
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={s.name}>{it.athleteName}</Text>
              {it.club ? <Text style={s.sub}>{it.club}</Text> : null}
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={s.achieve}>Đạt giải {it.placeLabel} · {it.categoryLabel}</Text>
              {it.prize ? <Text style={s.sub}>{it.prize}</Text> : null}
            </View>
            <View style={s.foot}>
              <Text>{[t.venueName, t.startsAt ? formatDayDate(t.startsAt) : null].filter(Boolean).join(' · ')}</Text>
              <View style={s.sign}>
                <Text>TM. Ban tổ chức</Text>
                <Text style={{ marginTop: 50 }}>(Ký, ghi rõ họ tên)</Text>
              </View>
            </View>
          </View>
        </Page>
      ))}
    </Document>,
  );
}
