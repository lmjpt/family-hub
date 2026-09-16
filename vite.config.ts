import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 상대 경로로 뽑습니다. 그래야 도메인 최상위든
  // 'id.github.io/우리집/' 같은 하위 경로든 그대로 동작합니다.
  base: './',
  server: {
    port: 5173,
    // 같은 집 안의 다른 기기(태블릿, 폰)에서 접속해 볼 수 있게 열어둔다.
    host: true,
  },
})
