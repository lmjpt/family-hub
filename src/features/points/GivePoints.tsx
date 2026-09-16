import { useEffect, useState } from 'react'
import Modal from '../../components/Modal'
import { addPointEntry } from '../../lib/db'
import { useMe } from '../auth'
import type { Member } from '../../types'

/**
 * 자주 쓰는 이유를 버튼으로 준비해 둡니다.
 * 매번 타이핑해야 하면 결국 아무도 안 쓰게 됩니다.
 */
const PRAISE_REASONS = [
  '스스로 했어요',
  '동생을 도와줬어요',
  '정리정돈 잘했어요',
  '약속을 지켰어요',
  '인사를 잘했어요',
  '책을 읽었어요',
]

const MINUS_REASONS = [
  '약속을 안 지켰어요',
  '숙제를 미뤘어요',
  '형제와 다퉜어요',
  '거친 말을 했어요',
]

interface Props {
  open: boolean
  member: Member
  /** 'praise' = 칭찬(+), 'minus' = 벌점(−) */
  mode: 'praise' | 'minus'
  onClose: () => void
}

export default function GivePoints({ open, member, mode, onClose }: Props) {
  const me = useMe()
  const praise = mode === 'praise'
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState(praise ? 3 : 2)

  useEffect(() => {
    if (!open) return
    setReason('')
    setAmount(praise ? 3 : 2)
  }, [open, praise])

  const valid = reason.trim().length > 0 && amount > 0

  function save() {
    if (!valid || !me) return
    addPointEntry({
      memberId: member.id,
      points: praise ? amount : -amount,
      reason: reason.trim(),
      givenBy: me.id,
    })
    onClose()
  }

  const reasons = praise ? PRAISE_REASONS : MINUS_REASONS
  const accent = praise ? 'text-praise' : 'text-minus'

  return (
    <Modal
      open={open}
      title={praise ? `${member.name} 칭찬하기` : `${member.name} 기록 남기기`}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={save}
          disabled={!valid}
          className="btn btn-primary flex-1"
        >
          {praise ? `칭찬 +${amount}점 주기` : `−${amount}점 기록하기`}
        </button>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="label">{praise ? '어떤 걸 잘했나요?' : '무슨 일이 있었나요?'}</span>
          <div className="flex flex-wrap gap-2">
            {reasons.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                  reason === r
                    ? 'border-brand bg-brand-soft text-ink'
                    : 'border-line bg-paper text-muted'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="point-reason">
            직접 쓰기
          </label>
          <input
            id="point-reason"
            className="field"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={praise ? '예) 설거지를 도와줬어요' : '예) 늦게까지 게임했어요'}
          />
        </div>

        <div>
          <span className="label">점수</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAmount((v) => Math.max(1, v - 1))}
              className="btn btn-ghost h-12 w-12 text-xl"
              aria-label="점수 줄이기"
            >
              −
            </button>
            <span className={`flex-1 text-center text-3xl font-bold ${accent}`}>
              {praise ? '+' : '−'}
              {amount}
            </span>
            <button
              type="button"
              onClick={() => setAmount((v) => v + 1)}
              className="btn btn-ghost h-12 w-12 text-xl"
              aria-label="점수 늘리기"
            >
              +
            </button>
          </div>
        </div>

        {!praise && (
          <p className="rounded-xl bg-minus-soft px-4 py-3 text-sm text-muted">
            기록은 아이도 볼 수 있어요. 왜 그랬는지 한 줄 남겨 두면 나중에 같이
            이야기하기 좋습니다.
          </p>
        )}
      </div>
    </Modal>
  )
}
