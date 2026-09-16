import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useMe } from './features/auth'
import Calendar from './pages/Calendar'
import Homework from './pages/Homework'
import Login from './pages/Login'
import Points from './pages/Points'
import Settings from './pages/Settings'
import Tasks from './pages/Tasks'

export default function App() {
  const me = useMe()

  // 로그인 전에는 다른 화면을 아예 만들지 않습니다.
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
