import path from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rootDir = __dirname;

// Frontend: загружаем конфиг из frontend/ и ограничиваем файлы префиксом frontend/
const frontendConfig = (await import('./frontend/eslint.config.js')).default;
const scopePatterns = (arr, prefix) => {
  const list = Array.isArray(arr) ? arr : [arr];
  return list.map((x) =>
    typeof x === 'string' ? (x.startsWith('!') ? `!${prefix}${x.slice(1)}` : `${prefix}${x}`) : x
  );
};
const frontendScoped = frontendConfig.map((block) => {
  if (block.ignores) {
    return { ...block, ignores: scopePatterns(block.ignores, 'frontend/') };
  }
  const files = block.files ? scopePatterns(block.files, 'frontend/') : ['frontend/**'];
  return { ...block, files };
});

// Backend: FlatCompat по backend/.eslintrc.cjs
const compat = new FlatCompat({ baseDirectory: path.join(rootDir, 'backend') });
const backendConfig = compat.extends('airbnb-base', 'plugin:@typescript-eslint/recommended');

const backendScoped = backendConfig.map((block) => ({
  ...block,
  files: block.files ? block.files.map((f) => `backend/${f}`) : ['backend/**/*.ts', 'backend/**/*.js'],
}));
const backendGlobals = {
  files: ['backend/**/*.ts', 'backend/**/*.js'],
  languageOptions: {
    globals: { Express: 'readonly' },
  },
  rules: {
    'no-console': 'off',
    'no-underscore-dangle': 'off',
    'import/no-unresolved': 'off',
    'import/extensions': [
      'error',
      'ignorePackages',
      { js: 'never', jsx: 'never', ts: 'never', tsx: 'never' },
    ],
  },
};

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.config.js',
      '**/*.config.cjs',
      '**/*.config.mjs',
      '**/*.config.ts',
      '**/yarn.lock',
    ],
  },
  ...frontendScoped,
  ...backendScoped,
  backendGlobals,
];
