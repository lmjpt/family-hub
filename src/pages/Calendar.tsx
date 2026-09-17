import { useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import CommentButton from '../features/comments/CommentButton'
import EventForm from '../features/events/EventForm'
import { useMe } from '../features/auth'
import { useDb } from '../lib/db'
import {
  WEEKDAYS,
  addDays,
  dayKey,
  formatDayLabel,
  formatMonthLabel,
  formatShort,
  formatTime,
  monthGrid,
  shiftMonth,
  todayKey,
} from '../lib/date'
import { canCreateEvent } from '../lib/permissions'
import type { FamilyEvent } from '../types'

/**
 * 일정이 걸쳐 있는 날짜 키들 (시작일 ~ 끝나는 날, 포함).
 * 끝이 정확히 다음 날 0시면 그 날은 빼줍니다 — "금 18:00 ~ 토 00:00" 은 금요일 일정입니다.
 * 잘못 입력해 몇 달짜리가 되어도 달력이 무거워지지 않게 60일에서 끊습니다.
 */
function eventDays(e: FamilyEvent): string[] {
  const start = dayKey(e.startsAt)
  let end = dayKey(e.endsAt)
  if (end > start && formatTime(e.endsAt) === '00:00') end = addDays(end, -1)
  const days = [start]
  let cur = start
  while (cur < end && days.length < 60) {
    cur = addDays(cur, 1)
    days.push(cur)
  }
  return days
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

export default function Calendar() {
  const db = useDb()
  const me = useMe()
  const today = todayKey()

  const [cursor, setCursor] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }))
  const [selected, setSelected] = useState(today)
  const [editing, setEditing] = useState<FamilyEvent | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const grid = useMemo(
    () => monthGrid(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  )

  /**
   * 날짜별로 일정을 미리 묶어 둡니다. 42칸을 돌면서 매번 필터링하지 않기 위해.
   * 금~토처럼 여러 날에 걸친 일정은 그 사이 모든 날에 들어갑니다.
   */
  const eventsByDay = useMemo(() => {
    const map = new Map<string, FamilyEvent[]>()
    for (const e of db.events) {
      for (const key of eventDays(e)) {
        const list = map.get(key)
        if (list) list.push(e)
        else map.set(key, [e])
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    }
    return map
  }, [db.events])

  const tasksByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of db.tasks) {
      if (!t.dueAt || t.status === 'confirmed') continue
      const key = dayKey(t.dueAt)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [db.tasks])

  const memberColor = (id: string | null) =>
    id === null ? '#b9ada0' : (db.members.find((m) => m.id === id)?.color ?? '#b9ada0')

  const selectedEvents = eventsByDay.get(selected) ?? []
  const selectedTasks = db.tasks.filter(
    (t) => t.dueAt && dayKey(t.dueAt) === selected && t.status !== 'confirmed',
  )
  const monthPrefix = `${cursor.year}-${String(cursor.month).padStart(2, '0')}`

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(event: FamilyEvent) {
    setEditing(event)
    setFormOpen(true)
  }

  function goToday() {
    setCursor({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) })
    setSelected(today)
  }

  return (
    <div className="space-y-4">
      {/* 고른 날의 일정·마감. 앱을 열면 오늘 것이 바로 보여야 해서 달력보다 위에 둡니다. */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">
            {selected === today ? '오늘 · ' : ''}
            {formatDayLabel(selected)}
          </h3>
          {canCreateEvent(me) && (
            <button type="button" onClick={openNew} className="btn btn-primary py-2">
              + 일정
            </button>
          )}
        </div>

        {selectedEvents.length === 0 && selectedTasks.length === 0 ? (
          <div className="card">
            <EmptyState emoji="🗓️" title="이 날은 비어 있어요" />
          </div>
        ) : (
          <ul className="space-y-2">
            {selectedEvents.map((event) => {
              const owner = db.members.find((m) => m.id === event.ownerId)
              return (
                <li key={event.id} className="card flex items-center gap-1 pr-2">
                  <button
                    type="button"
                    onClick={() => openEdit(event)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-l-[1.25rem] px-4 py-3 text-left hover:bg-cream"
                  >
                    <span
                      className="h-10 w-1.5 shrink-0 rounded-full"
                      style={{ background: memberColor(event.ownerId) }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {event.title}
                      </span>
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

            {selectedTasks.map((task) => {
              const who = db.members.find((m) => m.id === task.assigneeId)
              return (
                <li
                  key={task.id}
                  className="card flex items-center gap-3 px-4 py-3 opacity-90"
                >
                  <span className="text-xl" aria-hidden="true">
                    {task.kind === 'homework' ? '📚' : '🧹'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{task.title}</span>
                    <span className="block text-sm text-muted">
                      마감 {formatTime(task.dueAt!)}
                      {who ? ` · ${who.avatarEmoji} ${who.name}` : ''}
                    </span>
                  </span>
                  <CommentButton title={task.title} target={{ taskId: task.id }} />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="지난 달"
            onClick={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}
            className="rounded-lg px-3 py-2 text-xl text-muted hover:bg-paper"
          >
            ‹
          </button>
          <h2 className="min-w-32 text-center text-lg font-bold">
            {formatMonthLabel(cursor.year, cursor.month)}
          </h2>
          <button
            type="button"
            aria-label="다음 달"
            onClick={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}
            className="rounded-lg px-3 py-2 text-xl text-muted hover:bg-paper"
          >
            ›
          </button>
        </div>
        <button
          type="button"
          onClick={goToday}
          className="rounded-lg border border-line bg-paper px-3 py-2 text-sm font-semibold"
        >
          오늘
        </button>
      </div>

      <div className="card overflow-hidden p-2">
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`py-2 text-center text-xs font-bold ${
                i === 0 ? 'text-brand' : i === 6 ? 'text-minus' : 'text-muted'
              }`}
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px">
          {grid.map((key) => {
            const inMonth = key.startsWith(monthPrefix)
            const isToday = key === today
            const isSelected = key === selected
            const dayEvents = eventsByDay.get(key) ?? []
            const dueCount = tasksByDay.get(key) ?? 0

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`flex h-16 flex-col items-center gap-1 rounded-xl pt-1.5 transition-colors ${
                  isSelected ? 'bg-brand-soft' : 'hover:bg-cream'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                    isToday ? 'bg-brand font-bold text-white' : ''
                  } ${inMonth ? 'text-ink' : 'text-muted/50'} ${
                    isSelected && !isToday ? 'font-bold' : ''
                  }`}
                >
                  {Number(key.slice(8, 10))}
                </span>

                <span className="flex h-1.5 items-center gap-0.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: memberColor(e.ownerId) }}
                    />
                  ))}
                </span>

                {dueCount > 0 && (
                  <span className="text-[10px] leading-none font-semibold text-praise">
                    할일 {dueCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <EventForm
        open={formOpen}
        event={editing}
        defaultDay={selected}
        onClose={() => setFormOpen(false)}
      />
    </div>
  )
}
