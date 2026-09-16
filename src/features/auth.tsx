// 가족용 앱이라 이메일/비밀번호 대신 '누구세요?' + PIN 방식을 씁니다.
// 아이들은 보통 PIN 없이 얼굴(이모지)만 누르면 들어옵니다.
//
// 이건 남을 막는 보안이 아니라 '엄마 계정으로 실수로 들어가는 것'을 막는 장치입니다.
// 인터넷에 올릴 계획이 생기면 진짜 인증으로 바꿔야 합니다.

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useDb } from '../lib/db'
import type { Member } from '../types'

const SESSION_KEY = 'family-hub-session'

interface SessionValue {
  me: Member | null
  /** PIN 이 맞으면 true, 틀리면 false */
  login: (memberId: string, pin: string) => boolean
  logout: () => void
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const db = useDb()
  const [meId, setMeId] = useState<string | null>(() =>
    localStorage.getItem(SESSION_KEY),
  )

  const login = useCallback(
    (memberId: string, pin: string) => {
      const member = db.members.find((m) => m.id === memberId)
      if (!member) return false
      if (member.pin && member.pin !== pin) return false
      localStorage.setItem(SESSION_KEY, memberId)
      setMeId(memberId)
      return true
    },
    [db.members],
  )

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setMeId(null)
  }, [])

  // 로그인한 구성원이 삭제됐을 수 있으니 항상 현재 목록에서 다시 찾습니다.
  const me = useMemo(
    () => db.members.find((m) => m.id === meId) ?? null,
    [db.members, meId],
  )

  const value = useMemo<SessionValue>(
    () => ({ me, login, logout }),
    [me, login, logout],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession 은 SessionProvider 안에서만 쓸 수 있습니다.')
  return ctx
}

/** 로그인한 구성원. 로그인 전이면 null. */
export function useMe(): Member | null {
  return useSession().me
}
