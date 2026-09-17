import { useEffect, useState } from 'react'
import Avatar from '../../components/Avatar'
import Modal from '../../components/Modal'
import { giftPoints, totalPoints, useDb } from '../../lib/db'
import type { Member } from '../../types'

interface Props {
  open: boolean
  /** 선물하는 사람 (= 로그인한 사람) */
  from: Member
  onClose: () => void
}

/** 내 포인트를 가족에게 선물하는 창. 받는 사람 → 점수 → (한마디) 순서. */
export default function GiftPoints({ open, from, onClose }: Props) {
  const db = useDb()
  const balance = totalPoints(db.points, from.id)
  const others = db.members.filter((m) => m.id !== from.id)

  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState(1)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setToId(others.length === 1 ? others[0].id : '')
    setAmount(Math.min(5, Math.max(1, balance)))
    setMessage('')
    setError('')
    // others 는 렌더마다 새 배열이라 의존성에 넣으면 폼이 계속 초기화됩니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const to = others.find((m) => m.id === toId) ?? null
  const valid = to !== null && amount >= 1 && amount <= balance
  const clamp = (v: number) => Math.min(balance, Math.max(1, v))

  function save() {
    if (!to) return
    const err = giftPoints({ fromId: from.id, toId: to.id, points: amount, message })
    if (err) {
      setError(err)
      return
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      title="포인트 선물하기"
      onClose={onClose}
      footer={
        <button type="button" onClick={save} disabled={!valid} className="btn btn-primary flex-1">
          {to ? `🎁 ${to.name}에게 ${amount}점 선물` : '받을 사람을 골라요'}
        </button>
      }
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-praise-soft px-4 py-3 text-sm">
          내가 가진 점수 <b className="text-praise">{balance}점</b> 안에서 줄 수 있어요.
        </p>

        <div>
          <span className="label">누구에게 줄까요?</span>
          <div className="flex flex-wrap gap-2">
            {others.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setToId(m.id)}
                className={`flex items-center gap-2 rounded-full border py-1.5 pr-4 pl-1.5 text-sm font-semibold ${
                  toId === m.id ? 'border-brand bg-brand-soft text-ink' : 'border-line bg-paper text-muted'
                }`}
              >
                <Avatar member={m} size="sm" />
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">얼마나 줄까요?</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAmount((v) => clamp(v - 1))}
              className="btn btn-ghost h-12 w-12 text-xl"
              aria-label="점수 줄이기"
            >
              −
            </button>
            <span className="flex-1 text-center text-3xl font-bold text-praise">{amount}</span>
            <button
              type="button"
              onClick={() => setAmount((v) => clamp(v + 1))}
              className="btn btn-ghost h-12 w-12 text-xl"
              aria-label="점수 늘리기"
            >
              +
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[1, 5, 10, 20].filter((n) => n <= balance).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAmount(n)}
                className="rounded-xl border border-line bg-paper px-3 py-1.5 text-sm font-semibold text-muted"
              >
                {n}점
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmount(balance)}
              className="rounded-xl border border-line bg-paper px-3 py-1.5 text-sm font-semibold text-muted"
            >
              전부 ({balance}점)
            </button>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="gift-message">
            한마디 (없어도 돼요)
          </label>
          <input
            id="gift-message"
            className="field"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="예) 생일 축하해!"
            maxLength={60}
          />
        </div>

        {error && <p className="text-sm text-brand">{error}</p>}

        <p className="text-xs text-muted">
          선물은 두 사람의 기록에 모두 남아요. 준 사람은 −, 받은 사람은 +.
        </p>
      </div>
    </Modal>
  )
}
