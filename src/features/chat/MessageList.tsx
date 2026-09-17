import Avatar from '../../components/Avatar'
import EmptyState from '../../components/EmptyState'
import { dayKey, formatDayLabel, formatTime } from '../../lib/date'
import type { Member, Message } from '../../types'

interface Props {
  messages: Message[]
  me: Member
  members: Member[]
  /** null 이면 지우기 버튼을 보이지 않습니다 */
  onDelete: ((id: string) => void) | null
}

/** 대화 말풍선 목록. 내 것은 오른쪽, 다른 사람 것은 얼굴과 함께 왼쪽. */
export default function MessageList({ messages, me, members, onDelete }: Props) {
  if (messages.length === 0) {
    return (
      <div className="card">
        <EmptyState
          emoji="👋"
          title="아직 대화가 없어요"
          hint="아래에서 첫 인사를 보내 보세요."
        />
      </div>
    )
  }

  return (
    <ol className="space-y-2">
      {messages.map((m, i) => {
        const mine = m.senderId === me.id
        const sender = members.find((x) => x.id === m.senderId) ?? null
        const day = dayKey(m.createdAt)
        const newDay = i === 0 || dayKey(messages[i - 1].createdAt) !== day
        // 같은 사람이 이어서 보내면 얼굴과 이름은 처음 한 번만.
        const sameSender = !newDay && messages[i - 1].senderId === m.senderId

        return (
          <li key={m.id}>
            {newDay && (
              <p className="my-4 text-center text-xs font-semibold text-muted">
                {formatDayLabel(day)}
              </p>
            )}
            <div className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
              {!mine && (
                <span className="w-8 shrink-0">
                  {!sameSender && sender && <Avatar member={sender} size="sm" />}
                </span>
              )}
              <div className={`flex max-w-[78%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                {!mine && !sameSender && (
                  <span className="mb-0.5 px-1 text-xs font-semibold text-muted">
                    {sender?.name ?? '누군가'}
                  </span>
                )}
                <div className={`flex items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
                  <p
                    className={`rounded-2xl px-4 py-2.5 text-base leading-snug break-words whitespace-pre-wrap ${
                      mine
                        ? 'rounded-br-md bg-brand-soft text-ink'
                        : 'rounded-bl-md border border-line bg-paper text-ink'
                    }`}
                  >
                    {m.body}
                  </p>
                  <span className="mb-1 shrink-0 text-[11px] text-muted">
                    {formatTime(m.createdAt)}
                  </span>
                </div>
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('이 메시지를 지울까요?')) onDelete(m.id)
                    }}
                    className="mt-0.5 px-1 text-[11px] font-semibold text-muted hover:underline"
                  >
                    지우기
                  </button>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
