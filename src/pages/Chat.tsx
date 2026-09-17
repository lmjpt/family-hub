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

  // 이 화면을 보고 있으면 마지막 메시지까지 읽은 것으로 칩니다.
  useEffect(() => {
    if (!me || messages.length === 0) return
    markRead(me.id, messages[messages.length - 1].createdAt)
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
        onDelete={canDeleteMessage(me) ? removeMessage : null}
      />
      <Composer onSend={(body) => void sendMessage(me.id, body)} />
    </div>
  )
}
