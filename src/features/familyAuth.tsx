// 가족 계정 로그인.
//
// 로그인은 두 단계입니다.
//   1단계 (여기)  가족 계정 — 폰마다 한 번만. 이게 있어야 서버의 우리집 데이터에 닿습니다.
//   2단계 (auth.tsx) 누구세요 — 얼굴 누르기 + PIN. 앱을 열 때마다.
//
// 아이가 이메일·비밀번호를 외울 필요가 없도록 나눴습니다.
// 어른이 아이 폰에 한 번 로그인해 주면, 그 뒤로 아이는 얼굴만 누릅니다.

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { startFamily, stopFamily } from '../lib/db'

interface FamilyAuthValue {
  session: Session | null
  /** 처음 켤 때 저장된 로그인을 확인하는 동안 true */
  checking: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const FamilyAuthContext = createContext<FamilyAuthValue | null>(null)

export function FamilyAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setChecking(false)
      if (data.session) void startFamily(data.session.user.id)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      // 이 콜백 안에서 곧바로 다른 supabase 호출을 하면 안 됩니다.
      // 인증 잠금이 걸린 채로 실행돼서 요청이 멈추거나 인증 없이 나갑니다.
      // setTimeout 으로 한 박자 미뤄서 잠금이 풀린 뒤에 부릅니다.
      setTimeout(() => {
        if (next) void startFamily(next.user.id)
        else void stopFamily()
      }, 0)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<FamilyAuthValue>(
    () => ({
      session,
      checking,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (!error) return null
        // 원문은 영어라 그대로 보여 주면 가족이 이해하기 어렵습니다.
        if (error.message.includes('Invalid login credentials')) {
          return '이메일이나 비밀번호가 맞지 않아요.'
        }
        if (error.message.includes('Email not confirmed')) {
          return '계정이 아직 확인되지 않았어요. Supabase 에서 Auto Confirm 을 켜 주세요.'
        }
        return `로그인하지 못했습니다: ${error.message}`
      },
      async signOut() {
        await supabase.auth.signOut()
      },
    }),
    [session, checking],
  )

  return <FamilyAuthContext value={value}>{children}</FamilyAuthContext>
}

export function useFamilyAuth(): FamilyAuthValue {
  const ctx = useContext(FamilyAuthContext)
  if (!ctx) {
    throw new Error('useFamilyAuth 는 FamilyAuthProvider 안에서만 쓸 수 있습니다.')
  }
  return ctx
}
