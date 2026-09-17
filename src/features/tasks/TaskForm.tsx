import { useEffect, useState } from 'react'
import DateTimeField from '../../components/DateTimeField'
import Modal from '../../components/Modal'
import { addTask, removeTask, updateTask, useDb } from '../../lib/db'
import { dayKeyToIso, isoToSeoulInput, seoulInputToIso, todayKey } from '../../lib/date'
import type { Task, TaskKind } from '../../types'

/** 자주 쓰는 과목을 버튼으로 뽑아 두면 입력이 빨라집니다. */
const SUBJECTS = ['국어', '수학', '영어', '사회', '과학', '기타'] as const

interface Props {
  open: boolean
  kind: TaskKind
  /** null 이면 새로 만들기 */
  task: Task | null
  onClose: () => void
}

export default function TaskForm({ open, kind, task, onClose }: Props) {
  const db = useDb()
  const children = db.members.filter((m) => m.role === 'child')

  const [title, setTitle] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [hasDue, setHasDue] = useState(true)
  const [due, setDue] = useState('')
  const [subject, setSubject] = useState('')
  const [points, setPoints] = useState(3)

  useEffect(() => {
    if (!open) return
    if (task) {
      setTitle(task.title)
      setAssigneeId(task.assigneeId ?? '')
      setHasDue(task.dueAt !== null)
      setDue(isoToSeoulInput(task.dueAt ?? dayKeyToIso(todayKey(), '20:00')))
      setSubject(task.subject ?? '')
      setPoints(task.rewardPoints)
    } else {
      setTitle('')
      setAssigneeId(children[0]?.id ?? '')
      setHasDue(true)
      setDue(isoToSeoulInput(dayKeyToIso(todayKey(), kind === 'homework' ? '21:00' : '20:00')))
      setSubject(kind === 'homework' ? '국어' : '')
      setPoints(kind === 'homework' ? 5 : 3)
    }
    // children 은 매 렌더마다 새 배열이라 의존성에 넣으면 폼이 계속 초기화됩니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task, kind])

  const valid = title.trim().length > 0

  function save() {
    if (!valid) return
    const payload = {
      title: title.trim(),
      kind,
      assigneeId: assigneeId || null,
      dueAt: hasDue ? seoulInputToIso(due) : null,
      subject: kind === 'homework' ? subject || null : null,
      rewardPoints: Math.max(0, points),
    }
    if (task) updateTask(task.id, payload)
    else addTask({ ...payload, status: 'todo' })
    onClose()
  }

  function handleDelete() {
    if (!task) return
    if (!window.confirm(`'${task.title}'을(를) 지울까요?`)) return
    removeTask(task.id)
    onClose()
  }

  const noun = kind === 'homework' ? '숙제' : '할일'

  return (
    <Modal
      open={open}
      title={task ? `${noun} 고치기` : `${noun} 추가`}
      onClose={onClose}
      footer={
        <>
          {task && (
            <button type="button" onClick={handleDelete} className="btn btn-ghost">
              삭제
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!valid}
            className="btn btn-primary flex-1"
          >
            저장
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="task-title">
            {kind === 'homework' ? '어떤 숙제인가요?' : '무슨 할일인가요?'}
          </label>
          <input
            id="task-title"
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'homework' ? '예) 수학 익힘책 24쪽' : '예) 신발 정리'}
            autoFocus
          />
        </div>

        {kind === 'homework' && (
          <div>
            <span className="label">과목</span>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSubject(s)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                    subject === s
                      ? 'border-brand bg-brand-soft text-ink'
                      : 'border-line bg-paper text-muted'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="label" htmlFor="task-assignee">
            누가 하나요?
          </label>
          <select
            id="task-assignee"
            className="field"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">담당 없음</option>
            {db.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.avatarEmoji} {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={hasDue}
              onChange={(e) => setHasDue(e.target.checked)}
              className="h-5 w-5 accent-[#e8795a]"
            />
            <span className="font-semibold">마감 정하기</span>
          </label>
          {hasDue && <DateTimeField className="mt-2" value={due} onChange={setDue} />}
        </div>

        <div>
          <label className="label" htmlFor="task-points">
            다 하면 줄 칭찬 점수
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPoints((p) => Math.max(0, p - 1))}
              className="btn btn-ghost h-12 w-12 text-xl"
              aria-label="점수 줄이기"
            >
              −
            </button>
            <input
              id="task-points"
              type="number"
              min={0}
              className="field text-center text-lg font-bold"
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
            />
            <button
              type="button"
              onClick={() => setPoints((p) => p + 1)}
              className="btn btn-ghost h-12 w-12 text-xl"
              aria-label="점수 늘리기"
            >
              +
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            점수는 부모가 <b>확인</b>을 눌렀을 때 들어갑니다.
          </p>
        </div>
      </div>
    </Modal>
  )
}
