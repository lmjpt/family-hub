// '누구세요' 단계.
//
// 기기는 누구였는지 기억합니다. 다만 부모는 앱을 새로 열 때 PIN 을 다시 묻습니다.
//   · 아이(PIN 없음)  → 앱을 열면 바로 들어갑니다. 마찰 없음
//   · 부모(PIN 있음)  → 얼굴은 기억하되 숫자 4자리를 다시 넣습니다
//
// 각자 자기 폰에서 쓰는 걸 전제로 한 선택입니다. 아이가 부모 폰을 집어들어도
// 부모 권한(칭찬 점수 주기, 숙제 만들기)까지 따라오지는 않게 하려는 겁니다.
//
// 이건 남을 막는 보안이 아니라 집안에서의 최소한의 구분입니다.
// 진짜 잠금은 폰 자체의 잠금화면이 합니다.

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useDb } from '../lib/db'
import type { Member } from '../types'

const SESSION_KEY = 'family-hub-session'

interface SessionValue {
  /** PIN 확인까지 끝난 사람. 화면은 이 값으로 움직입니다. */
  me: Member | null
  /** 기억은 하고 있지만 PIN 을 다시 받아야 하는 사람 */
  pending: Member | null
  /** PIN 이 맞으면 true, 틀리면 false */
  login: (memberId: string, pin: string) => boolean
  /** 기억을 지우고 처음(얼굴 고르기)으로 */
  logout: () => void
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const db = useDb()
  const [meId, setMeId] = useState<string | null>(() =>
    localStorage.getItem(SESSION_KEY),
  )
  // 이번에 앱을 켠 뒤로 PIN 을 확인했는지. 일부러 저장하지 않습니다 —
  // 저장하면 '새로 열 때 다시 묻기'가 성립하지 않습니다.
  const [verified, setVerified] = useState(false)

  const login = useCallback(
    (memberId: string, pin: string) => {
      const member = db.members.find((m) => m.id === memberId)
      if (!member) return false
      if (member.pin && member.pin !== pin) return false
      localStorage.setItem(SESSION_KEY, memberId)
      setMeId(memberId)
      setVerified(true)
      return true
    },
    [db.members],
  )

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setMeId(null)
    setVerified(false)
  }, [])

  const value = useMemo<SessionValue>(() => {
    // 기억해 둔 사람이 그 사이 삭제됐을 수 있으니 항상 현재 목록에서 찾습니다.
    const remembered = db.members.find((m) => m.id === meId) ?? null
    const needsPin = remembered !== null && remembered.pin !== '' && !verified
    return {
      me: needsPin ? null : remembered,
      pending: needsPin ? remembered : null,
      login,
      logout,
    }
  }, [db.members, meId, verified, login, logout])

  return <SessionContext value={value}>{children}</SessionContext>
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession 은 SessionProvider 안에서만 쓸 수 있습니다.')
  return ctx
}

/** 로그인한 구성원. 아직 확인 전이면 null. */
export function useMe(): Member | null {
  return useSession().me
}
