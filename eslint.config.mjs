import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts'],
    plugins: { '@typescript-eslint': typescriptEslint },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      // Enforce module isolation: no cross-module imports
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*/modules/cooperative/*'],
              message: 'Do not import from cooperative module directly. Use Kafka events or REST API.',
            },
            {
              group: ['*/modules/product/*'],
              message: 'Do not import from product module directly. Use Kafka events or REST API.',
            },
            {
              group: ['*/modules/certification/*'],
              message: 'Do not import from certification module directly. Use Kafka events or REST API.',
            },
            {
              group: ['*/modules/notification/*'],
              message: 'Do not import from notification module directly. Use Kafka events or REST API.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/cooperative/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../product/**',
                '../../product/**',
                '../certification/**',
                '../../certification/**',
                '../notification/**',
                '../../notification/**',
              ],
              message: 'Cross-module imports are forbidden. Use Kafka events.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/product/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../cooperative/**',
                '../../cooperative/**',
                '../certification/**',
                '../../certification/**',
                '../notification/**',
                '../../notification/**',
              ],
              message: 'Cross-module imports are forbidden. Use Kafka events.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/certification/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../cooperative/**',
                '../../cooperative/**',
                '../product/**',
                '../../product/**',
                '../notification/**',
                '../../notification/**',
              ],
              message: 'Cross-module imports are forbidden. Use Kafka events.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/modules/notification/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../cooperative/**',
                '../../cooperative/**',
                '../product/**',
                '../../product/**',
                '../certification/**',
                '../../certification/**',
              ],
              message: 'Cross-module imports are forbidden. Use Kafka events.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.js'],
  },
];
