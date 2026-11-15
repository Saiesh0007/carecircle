'use strict';
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'data/**', '.vercel/**'] },
  js.configs.recommended,
  {
    files: ['server.js', 'src/**/*.js', 'test/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      curly: ['error', 'multi-line'],
    },
  },
  {
    files: ['public/js/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser } },
    rules: { eqeqeq: ['error', 'always'], 'no-var': 'error', 'prefer-const': 'error' },
  },
];
