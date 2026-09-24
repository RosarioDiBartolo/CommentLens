import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'test-results']),
  { files: ['**/*.{js,jsx,ts,tsx}'], extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  { files: ['src/**/*.{jsx,tsx}'], extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite] },
  { files: ['src/**/*.ts'], extends: [reactHooks.configs.flat.recommended] },
])
