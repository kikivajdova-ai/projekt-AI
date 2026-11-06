import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules', 'supabase/migrations'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // console jen pro varování a chyby (bez dat uživatelů)
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
);
