import { useEffect, useState } from 'react'
import Modal from '../../components/Modal'
import { addMember, removeMember, updateMember } from '../../lib/db'
import { MEMBER_COLORS, MEMBER_EMOJIS } from '../../lib/seed'
import type { Member, Role } from '../../types'

interface Props {
  open: boolean
  /** null 이면 새 구성원 */
  member: Member | null
  onClose: () => void
}

export default function MemberForm({ open, member, onClose }: Props) {
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('child')
  const [emoji, setEmoji] = useState<string>(MEMBER_EMOJIS[0])
  const [color, setColor] = useState<string>(MEMBER_COLORS[0])
  const [pin, setPin] = useState('')

  useEffect(() => {
    if (!open) return
    if (member) {
      setName(member.name)
      setRole(member.role)
      setEmoji(member.avatarEmoji)
      setColor(member.color)
      setPin(member.pin)
    } else {
      setName('')
      setRole('child')
      setEmoji(MEMBER_EMOJIS[0])
      setColor(MEMBER_COLORS[0])
      setPin('')
    }
  }, [open, member])

  const pinValid = pin === '' || /^\d{4}$/.test(pin)
  const valid = name.trim().length > 0 && pinValid

  function save() {
    if (!valid) return
    const payload = {
      name: name.trim(),
      role,
      avatarEmoji: emoji,
      color,
      pin,
      birthDate: member?.birthDate ?? null,
    }
    if (member) updateMember(member.id, payload)
    else addMember(payload)
    onClose()
  }

  function handleDelete() {
    if (!member) return
    const ok = window.confirm(
      `${member.name}을(를) 지우면 그 사람의 일정, 할일, 포인트 기록도 함께 사라집니다. 정말 지울까요?`,
    )
    if (!ok) return
    removeMember(member.id)
    onClose()
  }

  return (
    <Modal
      open={open}
      title={member ? '구성원 고치기' : '구성원 추가'}
      onClose={onClose}
      footer={
        <>
          {member && (
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
          <label className="label" htmlFor="member-name">
            이름
          </label>
          <input
            id="member-name"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예) 엄마, 지우"
            autoFocus
          />
        </div>

        <div>
          <span className="label">역할</span>
          <div className="grid grid-cols-2 gap-2">
            {(['parent', 'child'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-xl border px-4 py-3 font-semibold ${
                  role === r
                    ? 'border-brand bg-brand-soft'
                    : 'border-line bg-paper text-muted'
                }`}
              >
                {r === 'parent' ? '부모' : '자녀'}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">
            부모만 할일·숙제를 만들고 점수를 줄 수 있어요.
          </p>
        </div>

        <div>
          <span className="label">얼굴</span>
          <div className="flex flex-wrap gap-2">
            {MEMBER_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`h-12 w-12 rounded-xl border text-2xl ${
                  emoji === e ? 'border-brand bg-brand-soft' : 'border-line bg-paper'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">색깔</span>
          <div className="flex flex-wrap gap-2">
            {MEMBER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`색 ${c}`}
                className="h-11 w-11 rounded-full"
                style={{
                  background: c,
                  boxShadow: color === c ? `0 0 0 3px #fff, 0 0 0 6px ${c}` : undefined,
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="member-pin">
            비밀번호 4자리 (비워 두면 바로 로그인)
          </label>
          <input
            id="member-pin"
            className="field"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="예) 0000"
          />
          {!pinValid && (
            <p className="mt-1.5 text-xs text-brand">숫자 4자리로 적어 주세요.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
