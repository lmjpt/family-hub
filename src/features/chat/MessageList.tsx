import { useMemo } from 'react'
import Avatar from '../../components/Avatar'
import EmptyState from '../../components/EmptyState'
import { dayKey, formatDayLabel, formatTime } from '../../lib/date'
import type { ChatRead, Member, Message } from '../../types'

interface Props {
  messages: Message[]
  me: Member
  members: Member[]
  /** 구성원마다 어디까지 읽었나. 그 자리 아래에 얼굴을 붙입니다 */
  reads: ChatRead[]
  /** null 이면 지우기 버튼을 보이지 않습니다 */
  onDelete: ((id: string) => void) | null
}

/**
 * 각 사람(나는 빼고)이 마지막으로 읽은 메시지를 찾습니다.
 * 결과: 메시지 id → 그 자리까지 읽은 사람들
 */
function readMarkers(
  messages: Message[],
  members: Member[],
  reads: ChatRead[],
  meId: string,
): Map<string, Member[]> {
  const map = new Map<string, Member[]>()
  for (const read of reads) {
    if (read.memberId === meId) continue
    const member = members.find((m) => m.id === read.memberId)
    if (!member) continue
    const at = new Date(read.lastReadAt).getTime()
    // 뒤에서부터 찾으면 대개 한두 개만 보고 끝납니다 (다들 최근까지 읽었으므로).
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (new Date(messages[i].createdAt).getTime() <= at) {
        const list = map.get(messages[i].id)
        if (list) list.push(member)
        else map.set(messages[i].id, [member])
        break
      }
    }
  }
  return map
}

/** 대화 말풍선 목록. 내 것은 오른쪽, 다른 사람 것은 얼굴과 함께 왼쪽. */
export default function MessageList({ messages, me, members, reads, onDelete }: Props) {
  const markers = useMemo(
    () => readMarkers(messages, members, reads, me.id),
    [messages, members, reads, me.id],
  )

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
            {/* 여기까지 읽은 사람들의 얼굴. "엄마는 여기까지 봤다"가 한눈에 보이게. */}
            {markers.has(m.id) && (
              <div
                className="mt-1 flex items-center justify-end gap-1 pr-1"
                aria-label={`${markers.get(m.id)!.map((x) => x.name).join(', ')} 읽음`}
                title={`${markers.get(m.id)!.map((x) => x.name).join(', ')} 여기까지 봤어요`}
              >
                <span className="text-[10px] font-semibold text-muted">여기까지</span>
                {markers.get(m.id)!.map((member) => (
                  <Avatar key={member.id} member={member} size="xs" />
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
