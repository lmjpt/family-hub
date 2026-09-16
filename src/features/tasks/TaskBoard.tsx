import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Avatar from '../../components/Avatar'
import EmptyState from '../../components/EmptyState'
import { useDb } from '../../lib/db'
import { canCreateTask } from '../../lib/permissions'
import { useMe } from '../auth'
import ImportFromPhoto from './ImportFromPhoto'
import TaskForm from './TaskForm'
import TaskRow from './TaskRow'
import type { Task, TaskKind } from '../../types'

interface Props {
  kind: TaskKind
  title: string
  emoji: string
  /** 숙제는 아이별로 묶어 보는 게 편해서 true 로 씁니다. */
  groupByMember?: boolean
}

/** 마감 빠른 순. 마감 없는 것은 맨 뒤로. */
function byDue(a: Task, b: Task): number {
  if (a.dueAt === b.dueAt) return a.title.localeCompare(b.title)
  if (!a.dueAt) return 1
  if (!b.dueAt) return -1
  return a.dueAt.localeCompare(b.dueAt)
}

export default function TaskBoard({ kind, title, emoji, groupByMember = false }: Props) {
  const db = useDb()
  const me = useMe()

  // 아이가 열면 기본으로 자기 것만 보여 줍니다. 부모는 전체.
  const [filter, setFilter] = useState<string>(() =>
    me?.role === 'child' ? me.id : '',
  )
  const [editing, setEditing] = useState<Task | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [showDone, setShowDone] = useState(false)

  const visible = useMemo(
    () =>
      db.tasks
        .filter((t) => t.kind === kind)
        .filter((t) => !filter || t.assigneeId === filter)
        .sort(byDue),
    [db.tasks, kind, filter],
  )

  const todo = visible.filter((t) => t.status === 'todo')
  const waiting = visible.filter((t) => t.status === 'done')
  const finished = visible.filter((t) => t.status === 'confirmed')

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(task: Task) {
    setEditing(task)
    setFormOpen(true)
  }

  const groups = useMemo(() => {
    if (!groupByMember) return null
    const children = db.members.filter((m) => m.role === 'child')
    return children.map((child) => ({
      member: child,
      tasks: visible.filter(
        (t) => t.assigneeId === child.id && (showDone || t.status !== 'confirmed'),
      ),
    }))
  }, [groupByMember, db.members, visible, showDone])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        {canCreateTask(me) && (
          <div className="flex gap-2">
            {/* 학원 숙제는 사진으로 오는 일이 많아서 사진에서 바로 가져옵니다. */}
            {kind === 'homework' && (
              <button
                type="button"
                onClick={() => setPhotoOpen(true)}
                className="btn btn-ghost py-2"
              >
                📷 사진
              </button>
            )}
            <button type="button" onClick={openNew} className="btn btn-primary py-2">
              + 추가
            </button>
          </div>
        )}
      </div>

      {/* 누구 것만 볼지 고르는 줄 */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          type="button"
          onClick={() => setFilter('')}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
            filter === ''
              ? 'border-brand bg-brand-soft'
              : 'border-line bg-paper text-muted'
          }`}
        >
          전체
        </button>
        {db.members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setFilter(m.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border py-1.5 pr-4 pl-1.5 text-sm font-semibold ${
              filter === m.id
                ? 'border-brand bg-brand-soft'
                : 'border-line bg-paper text-muted'
            }`}
          >
            <Avatar member={m} size="sm" />
            {m.name}
          </button>
        ))}
      </div>

      {groups ? (
        <div className="space-y-4">
          {groups.map(({ member, tasks }) => (
            <section key={member.id} className="space-y-2">
              <h3 className="flex items-center gap-2 text-base font-bold">
                <Avatar member={member} size="sm" />
                {member.name}
                <span className="text-sm font-semibold text-muted">
                  남은 숙제 {tasks.filter((t) => t.status === 'todo').length}개
                </span>
              </h3>
              {tasks.length === 0 ? (
                <div className="card">
                  <EmptyState emoji="🎉" title="숙제 없음" />
                </div>
              ) : (
                <ul className="space-y-2">
                  {tasks.map((task) => (
                    <TaskRow key={task.id} task={task} onEdit={openEdit} />
                  ))}
                </ul>
              )}
            </section>
          ))}

          {groups.length === 0 && (
            <div className="card">
              <EmptyState
                emoji="👶"
                title="자녀가 없어요"
                hint="설정에서 가족 구성원을 먼저 추가해 주세요."
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="w-full py-2 text-sm font-semibold text-muted"
          >
            {showDone ? '끝난 숙제 숨기기' : '끝난 숙제 보기'}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <Section title="남은 일" count={todo.length} emptyEmoji="🎉" emptyText="다 했어요!">
            {todo.map((task) => (
              <TaskRow key={task.id} task={task} onEdit={openEdit} />
            ))}
          </Section>

          {waiting.length > 0 && (
            <Section title="확인 기다리는 중" count={waiting.length}>
              {waiting.map((task) => (
                <TaskRow key={task.id} task={task} onEdit={openEdit} />
              ))}
            </Section>
          )}

          {finished.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="w-full py-2 text-sm font-semibold text-muted"
              >
                {showDone ? '끝난 일 숨기기' : `끝난 일 ${finished.length}개 보기`}
              </button>
              {showDone && (
                <ul className="mt-2 space-y-2">
                  {finished.map((task) => (
                    <TaskRow key={task.id} task={task} onEdit={openEdit} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {!canCreateTask(me) && todo.length === 0 && !groups && (
        <p className="text-center text-sm text-muted">
          {emoji} 새로운 건 부모님이 올려 주실 거예요.
        </p>
      )}

      <TaskForm
        open={formOpen}
        kind={kind}
        task={editing}
        onClose={() => setFormOpen(false)}
      />

      <ImportFromPhoto open={photoOpen} onClose={() => setPhotoOpen(false)} />
    </div>
  )
}

function Section({
  title,
  count,
  children,
  emptyEmoji,
  emptyText,
}: {
  title: string
  count: number
  children: ReactNode
  emptyEmoji?: string
  emptyText?: string
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-base font-bold">
        {title} <span className="text-muted">{count}</span>
      </h3>
      {count === 0 ? (
        emptyEmoji ? (
          <div className="card">
            <EmptyState emoji={emptyEmoji} title={emptyText ?? ''} />
          </div>
        ) : null
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </section>
  )
}
