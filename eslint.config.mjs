import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/**', 'reports/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }],
      'no-restricted-properties': [
        'error',
        {
          property: 'waitForTimeout',
          message: 'Fixed sleeps are not allowed. Wait on a locator, URL, response or expect.poll condition instead.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'setTimeout', message: 'Fixed sleeps are not allowed. Use condition-based waiting.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='globalThis'][property.name='setTimeout']",
          message: 'Fixed sleeps are not allowed. Use condition-based waiting.',
        },
      ],
    },
  },
  {
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly' },
    },
  },
);
