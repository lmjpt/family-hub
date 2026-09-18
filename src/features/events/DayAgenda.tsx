import EmptyState from '../../components/EmptyState'
import { useDb } from '../../lib/db'
import { dayKey, formatDayLabel, formatShort, formatTime } from '../../lib/date'
import CommentButton from '../comments/CommentButton'
import type { FamilyEvent, Task } from '../../types'

interface Props {
  /** 이 날에 걸친 일정 (시작 순) */
  events: FamilyEvent[]
  /** 이 날 마감인 할일·숙제 (확인 안 된 것만) */
  tasks: Task[]
  onOpenEvent: (event: FamilyEvent) => void
}

/** 목록에 보일 시간 표기. 하루 안이면 '10:00 – 11:00', 여러 날이면 날짜까지. */
function eventWhen(e: FamilyEvent): string {
  const multiDay = dayKey(e.startsAt) !== dayKey(e.endsAt)
  if (e.allDay) {
    return multiDay
      ? `${formatDayLabel(dayKey(e.startsAt))} ~ ${formatDayLabel(dayKey(e.endsAt))} 하루 종일`
      : '하루 종일'
  }
  return multiDay
    ? `${formatShort(e.startsAt)} ~ ${formatShort(e.endsAt)}`
    : `${formatTime(e.startsAt)} – ${formatTime(e.endsAt)}`
}

/**
 * 고른 날 하루의 일정과 마감 목록. 일정 탭 맨 위에 놓여 "오늘 뭐 있지" 에 바로 답합니다.
 * 데이터 고르기(어느 날의 무엇)와 제목·버튼은 Calendar 가 하고, 여기서는 목록만 그립니다.
 */
export default function DayAgenda({ events, tasks, onOpenEvent }: Props) {
  const db = useDb()
  const member = (id: string | null) => db.members.find((m) => m.id === id) ?? null
  const color = (id: string | null) => member(id)?.color ?? '#b9ada0'

  return (
    <>
      {events.length === 0 && tasks.length === 0 ? (
        <div className="card">
          <EmptyState emoji="🗓️" title="이 날은 비어 있어요" />
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((event) => {
            const owner = member(event.ownerId)
            return (
              <li key={event.id} className="card flex items-center gap-1 pr-2">
                <button
                  type="button"
                  onClick={() => onOpenEvent(event)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-l-[1.25rem] px-4 py-3 text-left hover:bg-cream"
                >
                  <span
                    className="h-10 w-1.5 shrink-0 rounded-full"
                    style={{ background: color(event.ownerId) }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{event.title}</span>
                    <span className="block text-sm text-muted">
                      {eventWhen(event)}
                      {' · '}
                      {owner ? `${owner.avatarEmoji} ${owner.name}` : '가족 전체'}
                    </span>
                  </span>
                </button>
                <CommentButton title={event.title} target={{ eventId: event.id }} />
              </li>
            )
          })}

          {tasks.map((task) => {
            const who = member(task.assigneeId)
            return (
              <li key={task.id} className="card flex items-center gap-3 px-4 py-3 opacity-90">
                <span className="text-xl" aria-hidden="true">
                  {task.kind === 'homework' ? '📚' : '🧹'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{task.title}</span>
                  <span className="block text-sm text-muted">
                    {task.dueAt ? `마감 ${formatTime(task.dueAt)}` : '마감 없음'}
                    {who ? ` · ${who.avatarEmoji} ${who.name}` : ''}
                  </span>
                </span>
                <CommentButton title={task.title} target={{ taskId: task.id }} />
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
