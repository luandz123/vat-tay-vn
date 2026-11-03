/**
 * Chặn lỗi đã gặp trên production: file server import một HẰNG SỐ/hàm từ file 'use client'
 * (phía server chỉ nhận được tham chiếu client → "x.findIndex is not a function").
 * Quy tắc: từ file 'use client', file server chỉ được import component (tên viết hoa) và type.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '..');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
  });
const isClient = (p: string) => /^\s*['"]use client['"]/.test(readFileSync(p, 'utf8'));

function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? path.join(SRC, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    try {
      if (statSync(c).isFile()) return c;
    } catch {
      /* thử tiếp */
    }
  }
  return null;
}

describe('ranh giới server/client', () => {
  it('file server chỉ import component (hoặc type) từ file use client', () => {
    const problems: string[] = [];
    for (const f of files(SRC).filter((x) => !isClient(x))) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/import\s+(type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g)) {
        if (m[1]) continue;
        const target = resolve(f, m[3]!);
        if (!target || !isClient(target)) continue;
        // file 'use client' chỉ chứa server action thì không áp dụng ('use server' riêng)
        for (const raw of m[2]!.split(',')) {
          const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]!;
          if (!name || raw.trim().startsWith('type ')) continue;
          if (!/^[A-Z](?=[A-Za-z0-9]*[a-z])[A-Za-z0-9]*$/.test(name)) problems.push(`${path.relative(SRC, f)}: '${name}' từ ${path.relative(SRC, target)}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
