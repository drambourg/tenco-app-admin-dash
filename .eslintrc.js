// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

module.exports = {
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'airbnb-base',
    'plugin:prettier/recommended',
    'plugin:jsonc/recommended-with-jsonc',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  // ESlint default behavior ignores file/folders starting with "." - https://github.com/eslint/eslint/issues/10341
  ignorePatterns: ['dist/', '!.vscode/'],
  overrides: [
    {
      files: ['*.json', '*.json5', '*.jsonc'],
      parser: 'jsonc-eslint-parser',
    },
    {
      files: ['package-lock.json', 'tsconfig.json'],
      rules: {
        'jsonc/sort-keys': 0,
        'sort-keys-fix/sort-keys-fix': 'off',
      },
    },
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['sort-destructure-keys', 'sort-keys-fix', '@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/no-shadow': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { ignoreRestSiblings: true },
    ],
    'arrow-body-style': ['error', 'as-needed'],
    'consistent-return': 0,
    'func-names': 0,
    'import/extensions': 0,
    'jsonc/sort-keys': 'warn',
    'lines-between-class-members': 0,
    'no-await-in-loop': 0,
    'no-console': 'off',
    'no-restricted-syntax': 0,
    'no-shadow': 'off',
    'prettier/prettier': 'warn',
    'sort-destructure-keys/sort-destructure-keys': 'warn',
    'sort-keys-fix/sort-keys-fix': 'warn',
  },
  settings: {
    'import/resolver': {
      node: {
        paths: [path.resolve(__dirname, 'src')],
      },
      typescript: true,
    },
  },
};
