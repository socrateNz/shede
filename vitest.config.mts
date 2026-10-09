import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests des calculs métier (prévisions, coût matière, TVA, achats, périodes, pagination) :
// fonctions pures, sans base ni serveur. Lancer : pnpm test
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
