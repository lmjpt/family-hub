import { useMemo, useState } from 'react'
import DayAgenda from '../features/events/DayAgenda'
import EventForm from '../features/events/EventForm'
import { useMe } from '../features/auth'
import { useDb } from '../lib/db'
import {
  WEEKDAYS,
  addDays,
  dayKey,
  formatMonthLabel,
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
      <DayAgenda
        day={selected}
        isToday={selected === today}
        events={selectedEvents}
        tasks={selectedTasks}
        onAdd={canCreateEvent(me) ? openNew : undefined}
        onOpenEvent={openEdit}
      />

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
