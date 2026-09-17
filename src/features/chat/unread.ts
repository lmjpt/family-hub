// '어디까지 읽었나'는 기기에만 기억합니다 (localStorage).
// 서버에 읽음 상태를 두면 테이블이 하나 더 필요한데, 가족 대화방에
// '읽음 표시' 까지는 과합니다. 탭에 숫자 배지를 띄우는 용도로만 씁니다.

import { useSyncExternalStore } from 'react'
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

/** 대화방을 보고 있을 때 호출합니다. 더 옛날 시각으로는 되돌리지 않습니다. */
export function markRead(memberId: string, latestIso: string) {
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
