'use strict';
/**
 * ESLint flat config. Formatting is owned by Prettier (`npm run format`);
 * ESLint enforces correctness and maintainability rules shared by server and browser code.
 */
const js = require('@eslint/js');
const globals = require('globals');

/** Rules applied to every JavaScript file in the project. */
const shared = {
  'no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_|^next$', varsIgnorePattern: '^_', ignoreRestSiblings: true },
  ],
  eqeqeq: ['error', 'always'],
  curly: ['error', 'all'],
  'no-var': 'error',
  'prefer-const': 'error',
  'prefer-template': 'error',
  'object-shorthand': ['error', 'always'],
  'no-shadow': ['error', { builtinGlobals: false }],
  'no-param-reassign': ['error', { props: false }],
  'no-implicit-coercion': ['error', { allow: ['!!'] }],
  'no-nested-ternary': 'off',
  'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
  'no-throw-literal': 'error',
  'no-return-await': 'error',
  // Store adapters implement one async interface, so sync bodies in async methods are intentional.
  'require-await': 'off',
  'max-depth': ['error', 4],
  'max-params': ['error', 5],
  complexity: ['warn', 20],
};

module.exports = [
  { ignores: ['node_modules/**', 'data/**', '.vercel/**'] },
  js.configs.recommended,
  {
    files: ['server.js', 'src/**/*.js', 'test/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { ...shared, strict: ['error', 'global'] },
  },
  {
    files: ['public/js/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser } },
    rules: shared,
  },
  {
    files: ['test/**/*.js'],
    rules: { 'max-params': 'off' },
  },
];
