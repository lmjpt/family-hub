import { useEffect, useState } from 'react'
import DateTimeField from '../../components/DateTimeField'
import Modal from '../../components/Modal'
import { addEvent, removeEvent, updateEvent, useDb } from '../../lib/db'
import { dayKeyToIso, isoToSeoulInput, seoulInputToIso } from '../../lib/date'
import { canCreateFamilyEvent, canEditEvent } from '../../lib/permissions'
import { useMe } from '../auth'
import type { FamilyEvent } from '../../types'

interface Props {
  open: boolean
  /** null 이면 새로 만들기 */
  event: FamilyEvent | null
  /** 새로 만들 때 기본 날짜 */
  defaultDay: string
  onClose: () => void
}

export default function EventForm({ open, event, defaultDay, onClose }: Props) {
  const db = useDb()
  const me = useMe()

  const [title, setTitle] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [ownerId, setOwnerId] = useState<string>('')
  const [memo, setMemo] = useState('')

  // 모달이 열릴 때마다 폼을 대상에 맞게 다시 채웁니다.
  useEffect(() => {
    if (!open) return
    if (event) {
      setTitle(event.title)
      setAllDay(event.allDay)
      setStart(isoToSeoulInput(event.startsAt))
      setEnd(isoToSeoulInput(event.endsAt))
      setOwnerId(event.ownerId ?? '')
      setMemo(event.memo)
    } else {
      setTitle('')
      setAllDay(false)
      setStart(isoToSeoulInput(dayKeyToIso(defaultDay, '09:00')))
      setEnd(isoToSeoulInput(dayKeyToIso(defaultDay, '10:00')))
      // 아이가 만들면 자동으로 자기 일정. 부모는 기본이 '가족 전체'.
      setOwnerId(me?.role === 'child' ? me.id : '')
      setMemo('')
    }
  }, [open, event, defaultDay, me])

  if (!me) return null

  const canPickFamily = canCreateFamilyEvent(me)
  const editable = event ? canEditEvent(me, event) : true
  const valid = title.trim().length > 0 && start !== '' && end !== ''

  function save() {
    if (!valid || !me) return
    // 끝 시간을 시작보다 앞으로 넣어도 앱이 이상해지지 않게 바로잡습니다.
    const startsAt = seoulInputToIso(start)
    const endsAt = seoulInputToIso(end < start ? start : end)
    const payload = {
      title: title.trim(),
      startsAt,
      endsAt,
      allDay,
      ownerId: ownerId || null,
      memo: memo.trim(),
    }
    if (event) updateEvent(event.id, payload)
    else addEvent(payload)
    onClose()
  }

  function handleDelete() {
    if (!event) return
    if (!window.confirm(`'${event.title}' 일정을 지울까요?`)) return
    removeEvent(event.id)
    onClose()
  }

  return (
    <Modal
      open={open}
      title={event ? '일정 고치기' : '일정 추가'}
      onClose={onClose}
      footer={
        <>
          {event && editable && (
            <button type="button" onClick={handleDelete} className="btn btn-ghost">
              삭제
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!valid || !editable}
            className="btn btn-primary flex-1"
          >
            저장
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="event-title">
            무슨 일정인가요?
          </label>
          <input
            id="event-title"
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예) 치과 가기"
            autoFocus
          />
        </div>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-5 w-5 accent-[#e8795a]"
          />
          <span className="font-semibold">하루 종일</span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="event-start">
              시작
            </label>
            <DateTimeField id="event-start" value={start} onChange={setStart} />
          </div>
          <div>
            <label className="label" htmlFor="event-end">
              끝
            </label>
            <DateTimeField id="event-end" value={end} onChange={setEnd} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="event-owner">
            누구 일정인가요?
          </label>
          <select
            id="event-owner"
            className="field"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            disabled={!canPickFamily}
          >
            <option value="">가족 전체</option>
            {db.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.avatarEmoji} {m.name}
              </option>
            ))}
          </select>
          {!canPickFamily && (
            <p className="mt-1.5 text-xs text-muted">
              가족 전체 일정은 부모만 만들 수 있어요.
            </p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="event-memo">
            메모 (없어도 돼요)
          </label>
          <textarea
            id="event-memo"
            className="field"
            rows={2}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        {!editable && (
          <p className="text-sm text-brand">이 일정은 고칠 수 없어요.</p>
        )}
      </div>
    </Modal>
  )
}
