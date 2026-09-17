import Avatar from '../../components/Avatar'
import { confirmTask, updateTask, useDb } from '../../lib/db'
import { dueLabel, isOverdue } from '../../lib/date'
import { canConfirmTask, canCreateTask, canToggleTask } from '../../lib/permissions'
import { useMe } from '../auth'
import CommentButton from '../comments/CommentButton'
import type { Task } from '../../types'

interface Props {
  task: Task
  onEdit: (task: Task) => void
}

export default function TaskRow({ task, onEdit }: Props) {
  const db = useDb()
  const me = useMe()
  const assignee = db.members.find((m) => m.id === task.assigneeId) ?? null

  const canToggle = canToggleTask(me, task) && task.status !== 'confirmed'
  const canConfirm = canConfirmTask(me) && task.status === 'done'
  const overdue = task.status === 'todo' && isOverdue(task.dueAt)

  function toggle() {
    if (!canToggle) return
    updateTask(task.id, { status: task.status === 'todo' ? 'done' : 'todo' })
  }

  return (
    <li className="card flex items-center gap-3 px-3 py-3">
      <button
        type="button"
        onClick={toggle}
        disabled={!canToggle}
        aria-label={task.status === 'todo' ? '다 했어요' : '아직 안 했어요'}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-xl transition-colors ${
          task.status === 'todo'
            ? 'border-line bg-paper'
            : 'border-praise bg-praise-soft'
        } ${canToggle ? 'active:scale-95' : 'cursor-default opacity-80'}`}
      >
        {task.status === 'todo' ? '' : task.status === 'done' ? '✓' : '⭐'}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate font-semibold ${
            task.status === 'confirmed' ? 'text-muted line-through' : ''
          }`}
        >
          {task.subject && (
            <span className="mr-1.5 rounded-md bg-cream px-1.5 py-0.5 text-xs font-bold text-muted">
              {task.subject}
            </span>
          )}
          {task.title}
        </p>

        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
          {assignee && (
            <span className="inline-flex items-center gap-1">
              <Avatar member={assignee} size="sm" />
              {assignee.name}
            </span>
          )}
          <span className={overdue ? 'font-semibold text-brand' : ''}>
            {dueLabel(task.dueAt)}
          </span>
          {task.rewardPoints > 0 && task.status !== 'confirmed' && (
            <span className="font-semibold text-praise">+{task.rewardPoints}점</span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {canConfirm && (
          <button
            type="button"
            onClick={() => me && confirmTask(task.id, me.id)}
            className="btn btn-primary px-3 py-2 text-sm"
          >
            확인
          </button>
        )}
        {task.status === 'done' && !canConfirm && (
          <span className="px-2 text-xs font-semibold text-muted">확인 기다리는 중</span>
        )}
        <CommentButton title={task.title} target={{ taskId: task.id }} />
        {canCreateTask(me) && (
          <button
            type="button"
            onClick={() => onEdit(task)}
            aria-label="고치기"
            className="rounded-lg px-2 py-2 text-muted hover:bg-cream"
          >
            ⋯
          </button>
        )}
      </div>
    </li>
  )
}
