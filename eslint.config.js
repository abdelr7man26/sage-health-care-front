import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react },
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Vite uses the automatic JSX runtime, so these mark components/variables
      // referenced only in JSX as "used" — without them no-unused-vars produces
      // false positives for every component rendered in JSX.
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      // Arabic Unicode ranges in regexes/comments legitimately end at U+FEFF,
      // which the rule otherwise flags. Allow it in regexes and comments.
      'no-irregular-whitespace': ['error', { skipComments: true, skipRegExps: true }],
    },
  },
  // Node config files (run by Node/Vite, not the browser).
  {
    files: ['**/*.config.js'],
    languageOptions: { globals: globals.node },
  },
  // Service worker — has its own global scope (self, clients, …).
  {
    files: ['public/sw.js'],
    languageOptions: { globals: globals.serviceworker },
  },
])
