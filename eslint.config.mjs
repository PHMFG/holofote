import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import expo from 'eslint-config-expo/flat.js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/coverage/',
    '**/.turbo/',
    'apps/mobile/.expo/',
    'apps/mobile/ios/',
    'apps/mobile/android/',
    'apps/mobile/expo-env.d.ts',
    // Roda no Plugin API do Figma (global `figma`, return no topo), não no Node.
    'packages/tokens/figma/',
  ]),
  {
    // Node: server, worker, pacotes e arquivos de configuração da raiz.
    files: ['**/*.{ts,mts,cts,js,mjs,cjs}'],
    ignores: ['apps/mobile/**'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    // App: regras do Expo (React, hooks, imports).
    files: ['apps/mobile/**/*.{ts,tsx,js}'],
    extends: [expo],
  },
  prettier,
]);
