import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    coverage: {
      // Istanbul rather than v8, which is the faster default: v8 can only
      // report a file some test imported, and emits every other one as 0/0
      // statements — which the reporters round up to 100%. A directory with no
      // tests at all is exactly what this is here to find, and v8 scores it
      // perfect. Istanbul instruments from the source, so an unimported file
      // reads 0% of its real statement count.
      provider: 'istanbul',
      include: ['src/**/*.ts'],
      // The two modules that boot a page rather than compute anything; smoke
      // is their cover and always will be.
      exclude: ['src/main.ts', 'src/render3d/start3d.ts'],
      reporter: ['text-summary', 'text'],
      // Reported, never gated: no `thresholds`. The number is worth reading
      // and not worth passing.
    },
  },
});
