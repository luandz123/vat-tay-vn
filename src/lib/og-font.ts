/** Tải font Google (có dấu tiếng Việt) cho next/og — font mặc định của Satori thiếu dấu. */
const cache = new Map<string, Promise<ArrayBuffer>>();

export function loadGoogleFont(family: string, weight: number, italic = false): Promise<ArrayBuffer> {
  const key = `${family}:${weight}:${italic}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:ital,wght@${italic ? 1 : 0},${weight}&subset=vietnamese`;
      // User-agent cũ để Google trả về TTF (Satori không đọc WOFF2)
      const css = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1)' } })).text();
      const src = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1];
      if (!src) throw new Error('Không tải được font');
      return (await fetch(src)).arrayBuffer();
    })();
    cache.set(key, p);
  }
  return p;
}
