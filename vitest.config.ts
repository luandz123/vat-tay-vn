import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // tsconfig để jsx: preserve cho Next.js; test cần biên dịch JSX (bằng khen PDF)
  oxc: { jsx: { runtime: 'automatic' } },
  test: { include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] },
});
