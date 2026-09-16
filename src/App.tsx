import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useMe } from './features/auth'
import { useFamilyAuth } from './features/familyAuth'
import { useDbError, useDbStatus } from './lib/db'
import Calendar from './pages/Calendar'
import FamilyLogin from './pages/FamilyLogin'
import Homework from './pages/Homework'
import Login from './pages/Login'
import Points from './pages/Points'
import Settings from './pages/Settings'
import Tasks from './pages/Tasks'

/**
 * 화면에 들어가기까지 세 개의 문을 지납니다.
 *   1. 가족 계정 로그인 (기기마다 한 번)
 *   2. 서버에서 가족 데이터 읽기
 *   3. 누구세요 (앱을 열 때마다)
 */
export default function App() {
  const { session, checking } = useFamilyAuth()
  const status = useDbStatus()
  const error = useDbError()
  const me = useMe()

  if (checking) return <Splash message="" />
  if (!session) return <FamilyLogin />

  if (status === 'loading' || status === 'idle') {
    return <Splash message="우리집 내용을 불러오는 중…" />
  }

  if (status === 'error') {
    return (
      <Splash emoji="😵" message="서버에 연결하지 못했어요." hint="새로고침해 보세요.">
        {/* 원인을 숨기면 고칠 수가 없습니다. 그대로 보여 줍니다. */}
        {error && (
          <p className="mt-2 max-w-sm rounded-xl bg-paper px-4 py-3 text-left font-mono text-xs break-words text-muted">
            {error}
          </p>
        )}
      </Splash>
    )
  }

  if (!me) return <Login />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Calendar />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/homework" element={<Homework />} />
        <Route path="/points" element={<Points />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function Splash({
  emoji = '🏠',
  message,
  hint,
  children,
}: {
  emoji?: string
  message: string
  hint?: string
  children?: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-5xl" aria-hidden="true">
        {emoji}
      </span>
      {message && <p className="font-semibold">{message}</p>}
      {hint && <p className="text-sm text-muted">{hint}</p>}
      {children}
    </div>
  )
}
