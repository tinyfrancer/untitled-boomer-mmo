import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import noOnlyTests from 'eslint-plugin-no-only-tests';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['tests/**/*.ts'],
    plugins: { 'no-only-tests': noOnlyTests },
    // A stray `.only` makes green CI a lie rather than a failure: the run
    // passes having skipped every other case in the file.
    rules: { 'no-only-tests/no-only-tests': 'error' },
  },
  eslintConfigPrettier,
);
