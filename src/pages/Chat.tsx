import { useEffect } from 'react'
import EmptyState from '../components/EmptyState'
import Composer from '../features/chat/Composer'
import MessageList from '../features/chat/MessageList'
import { markRead } from '../features/chat/unread'
import { useMe } from '../features/auth'
import { removeMessage, sendMessage, useChatReady, useDb } from '../lib/db'
import { canChat, canDeleteMessage } from '../lib/permissions'

/** 가족 대화방. 방은 하나뿐이고 가족 모두가 같은 내용을 봅니다. */
export default function Chat() {
  const db = useDb()
  const me = useMe()
  const ready = useChatReady()
  const messages = db.messages

  // 이 화면이 실제로 보이는 동안만 마지막 메시지까지 읽은 것으로 칩니다.
  // 앱이 뒤로 가 있는데(화면 꺼짐, 다른 앱) 메시지가 오면 읽은 게 아닙니다 —
  // 그때 읽음으로 남기면 다른 가족에게 거짓 '봤어요' 얼굴이 뜹니다.
  useEffect(() => {
    if (!me || messages.length === 0) return
    const latest = messages[messages.length - 1].createdAt
    const markIfVisible = () => {
      if (document.visibilityState === 'visible') markRead(me.id, latest)
    }
    markIfVisible()
    document.addEventListener('visibilitychange', markIfVisible)
    return () => document.removeEventListener('visibilitychange', markIfVisible)
  }, [me, messages])

  // 새 메시지가 오면 맨 아래로. 대화방은 항상 최신이 보여야 합니다.
  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight })
  }, [messages.length])

  if (!me || !canChat(me)) return null

  if (!ready) {
    return (
      <div className="card">
        <EmptyState
          emoji="🛠️"
          title="대화방을 아직 준비하지 않았어요"
          hint="어른이 Supabase 의 SQL Editor 에서 supabase/schema.sql 을 한 번 더 실행하면 열려요."
        />
      </div>
    )
  }

  return (
    // 입력 칸이 아래에 고정되어 있어서 그 높이만큼 여백을 둡니다.
    <div className="pb-28">
      <MessageList
        messages={messages}
        me={me}
        members={db.members}
        reads={db.chatReads}
        onDelete={canDeleteMessage(me) ? removeMessage : null}
      />
      <Composer onSend={(body) => void sendMessage(me.id, body)} />
    </div>
  )
}
