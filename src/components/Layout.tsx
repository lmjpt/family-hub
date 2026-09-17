import { NavLink, Outlet } from 'react-router-dom'
import { useDb } from '../lib/db'
import { useSession } from '../features/auth'
import { useUnreadCount } from '../features/chat/unread'
import Avatar from './Avatar'

const NAV = [
  { to: '/', emoji: '📅', label: '일정' },
  { to: '/tasks', emoji: '🧹', label: '할일' },
  { to: '/homework', emoji: '📚', label: '숙제' },
  { to: '/chat', emoji: '💬', label: '대화' },
  { to: '/points', emoji: '⭐', label: '포인트' },
  { to: '/settings', emoji: '⚙️', label: '설정' },
] as const

export default function Layout() {
  const db = useDb()
  const { me, logout } = useSession()
  const unread = useUnreadCount(me, db.messages)

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-cream/90 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-bold">{db.family.name}</h1>
        {me && (
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 rounded-full border border-line bg-paper py-1 pr-3 pl-1"
            title="누르면 다른 사람으로 바꿉니다"
          >
            <Avatar member={me} size="sm" />
            <span className="text-sm font-semibold">{me.name}</span>
          </button>
        )}
      </header>

      {/* 아래 네비게이션 높이만큼 여백을 둬서 마지막 항목이 가리지 않게 합니다. */}
      <main className="flex-1 px-4 pt-4 pb-28">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-2xl border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="flex">
          {NAV.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `relative flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold transition-colors ${
                    isActive ? 'text-brand' : 'text-muted'
                  }`
                }
              >
                <span className="text-2xl leading-none" aria-hidden="true">
                  {item.emoji}
                </span>
                {item.label}
                {item.to === '/chat' && unread > 0 && (
                  <span
                    className="absolute top-1 right-1/2 -mr-6 min-w-5 rounded-full bg-brand px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white"
                    aria-label={`안 읽은 메시지 ${unread}개`}
                  >
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
