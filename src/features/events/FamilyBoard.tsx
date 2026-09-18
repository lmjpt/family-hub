import type { ReactNode } from 'react'
import Avatar from '../../components/Avatar'
import { useDb } from '../../lib/db'
import { formatTime } from '../../lib/date'
import type { FamilyEvent, Task } from '../../types'

interface Props {
  /** 이 날에 걸친 일정 */
  events: FamilyEvent[]
  /** 이 날 마감인 할일·숙제 (확인된 것 포함 — 다 했는지가 보여야 하니까) */
  tasks: Task[]
  onOpenEvent: (event: FamilyEvent) => void
}

const STATUS_MARK = { todo: '☐', done: '✓', confirmed: '⭐' } as const

/**
 * 고른 날 하루를 가족 구성원별로 한 표에. 줄 = 사람, 칸 = 일정 / 할일 / 숙제.
 * "오늘 우리 집 누가 뭐 하지" 를 한눈에 보는 부모용 화면입니다. 가족 전체 일정은 맨 윗줄.
 */
export default function FamilyBoard({ events, tasks, onOpenEvent }: Props) {
  const db = useDb()
  const familyEvents = events.filter((e) => e.ownerId === null)

  return (
    <div className="card divide-y divide-line overflow-hidden">
      {familyEvents.length > 0 && (
        <Row
          who={
            <>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-lg" aria-hidden="true">
                🏠
              </span>
              <span className="text-xs font-bold">가족 전체</span>
            </>
          }
          events={familyEvents}
          tasks={[]}
          onOpenEvent={onOpenEvent}
        />
      )}
      {db.members.map((m) => (
        <Row
          key={m.id}
          who={
            <>
              <Avatar member={m} size="sm" />
              <span className="text-xs font-bold">{m.name}</span>
            </>
          }
          events={events.filter((e) => e.ownerId === m.id)}
          tasks={tasks.filter((t) => t.assigneeId === m.id)}
          onOpenEvent={onOpenEvent}
        />
      ))}
    </div>
  )
}

function Row({
  who,
  events,
  tasks,
  onOpenEvent,
}: {
  who: ReactNode
  events: FamilyEvent[]
  tasks: Task[]
  onOpenEvent: (event: FamilyEvent) => void
}) {
  const chores = tasks.filter((t) => t.kind === 'chore')
  const homework = tasks.filter((t) => t.kind === 'homework')
  return (
    <div className="flex gap-3 px-3 py-3">
      <div className="flex w-12 shrink-0 flex-col items-center gap-1 text-center">{who}</div>
      <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
        <Cell label="일정">
          {events.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onOpenEvent(e)}
              className="block w-full truncate text-left hover:underline"
              title={e.title}
            >
              {e.allDay ? '' : `${formatTime(e.startsAt)} `}
              {e.title}
            </button>
          ))}
        </Cell>
        <Cell label="할일">
          {chores.map((t) => (
            <TaskLine key={t.id} task={t} />
          ))}
        </Cell>
        <Cell label="숙제">
          {homework.map((t) => (
            <TaskLine key={t.id} task={t} />
          ))}
        </Cell>
      </div>
    </div>
  )
}

function Cell({ label, children }: { label: string; children: ReactNode[] }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold text-muted">{label}</p>
      {children.length === 0 ? (
        <p className="text-sm text-muted/60">—</p>
      ) : (
        <div className="space-y-0.5 text-sm">{children}</div>
      )}
    </div>
  )
}

function TaskLine({ task }: { task: Task }) {
  const done = task.status !== 'todo'
  return (
    <p className={`truncate ${done ? 'text-muted' : ''}`} title={task.title}>
      <span className={task.status === 'confirmed' ? 'text-praise' : ''}>
        {STATUS_MARK[task.status]}
      </span>{' '}
      <span className={task.status === 'confirmed' ? 'line-through' : ''}>{task.title}</span>
    </p>
  )
}
