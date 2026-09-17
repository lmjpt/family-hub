// '어디까지 읽었나'를 두 곳에 기억합니다.
//   · 기기(localStorage): 탭의 숫자 배지용. 서버가 없어도, 테이블이 없어도 돕니다.
//   · 서버(chat_read): 다른 가족 화면에 "여기까지 봤어요" 얼굴을 붙이는 용도.

import { useSyncExternalStore } from 'react'
import { markChatRead } from '../../lib/db'
import type { Member, Message } from '../../types'

const key = (memberId: string) => `family-hub-chat-read-${memberId}`

const listeners = new Set<() => void>()
let version = 0

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getVersion = () => version

/** 마지막으로 읽은 메시지 시각(ms). 없으면 0. */
function lastReadAt(memberId: string): number {
  return Number(localStorage.getItem(key(memberId)) ?? 0)
}

/** 대화방을 실제로 보고 있을 때만 호출합니다. 더 옛날 시각으로는 되돌리지 않습니다. */
export function markRead(memberId: string, latestIso: string) {
  // 서버 쪽은 자기 나름대로 '뒤로 가지 않기'를 검사하므로 항상 알려 줍니다.
  markChatRead(memberId, latestIso)

  const at = new Date(latestIso).getTime()
  if (!Number.isFinite(at) || at <= lastReadAt(memberId)) return
  localStorage.setItem(key(memberId), String(at))
  version += 1
  for (const l of listeners) l()
}

/** 내가 아직 안 읽은, 다른 사람이 보낸 메시지 수. */
export function useUnreadCount(me: Member | null, messages: Message[]): number {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  if (!me) return 0
  const since = lastReadAt(me.id)
  return messages.filter(
    (m) => m.senderId !== me.id && new Date(m.createdAt).getTime() > since,
  ).length
}
