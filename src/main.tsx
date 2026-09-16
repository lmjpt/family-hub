import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { SessionProvider } from './features/auth'
import { FamilyAuthProvider } from './features/familyAuth'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*
      주소에 #을 쓰는 방식(HashRouter)입니다. 보기엔 조금 덜 예쁘지만,
      어떤 정적 호스팅에 올려도 새로고침할 때 404가 나지 않습니다.
      홈 화면에 추가해서 쓰면 주소창이 안 보이니 실사용에는 차이가 없습니다.
    */}
    <HashRouter>
      <FamilyAuthProvider>
        <SessionProvider>
          <App />
        </SessionProvider>
      </FamilyAuthProvider>
    </HashRouter>
  </StrictMode>,
)
