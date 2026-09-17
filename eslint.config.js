import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // supabase/functions 는 Deno 에서 도는 서버 코드라 브라우저 규칙으로 검사하지 않습니다.
  { ignores: ['dist', 'supabase/functions'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // CLAUDE.md: any 금지
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
)
