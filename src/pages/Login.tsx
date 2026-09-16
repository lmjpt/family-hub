import { useState } from 'react'
import Avatar from '../components/Avatar'
import { useSession } from '../features/auth'
import { useDb } from '../lib/db'
import type { Member } from '../types'

export default function Login() {
  const db = useDb()
  const { login } = useSession()
  const [picked, setPicked] = useState<Member | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  function choose(member: Member) {
    // PIN 이 없는 사람(주로 아이들)은 얼굴만 누르면 바로 들어갑니다.
    if (!member.pin) {
      login(member.id, '')
      return
    }
    setPicked(member)
    setPin('')
    setError(false)
  }

  function press(digit: string) {
    if (!picked || pin.length >= 4) return
    const next = pin + digit
    setPin(next)
    setError(false)
    if (next.length === 4 && !login(picked.id, next)) {
      setError(true)
      setPin('')
    }
  }

  if (picked) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-6">
        <Avatar member={picked} size="xl" selected />
        <p className="text-xl font-bold">{picked.name}</p>

        <div className="flex gap-3" aria-label="비밀번호 입력 상태">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-4 w-4 rounded-full border-2 ${
                i < pin.length ? 'border-brand bg-brand' : 'border-line bg-paper'
              }`}
            />
          ))}
        </div>

        <p className={`h-5 text-sm ${error ? 'text-brand' : 'text-muted'}`}>
          {error ? '비밀번호가 달라요. 다시 눌러 보세요.' : '비밀번호 4자리'}
        </p>

        <div className="grid w-full grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => press(d)}
              className="card py-5 text-2xl font-bold active:bg-cream"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setPicked(null)
              setPin('')
            }}
            className="py-5 text-sm font-semibold text-muted"
          >
            뒤로
          </button>
          <button
            type="button"
            onClick={() => press('0')}
            className="card py-5 text-2xl font-bold active:bg-cream"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => setPin((p) => p.slice(0, -1))}
            className="py-5 text-xl text-muted"
            aria-label="한 글자 지우기"
          >
            ⌫
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <p className="text-sm font-semibold text-muted">{db.family.name}</p>
        <h1 className="mt-1 text-3xl font-bold">누구세요?</h1>
      </div>

      <ul className="grid w-full grid-cols-2 gap-4">
        {db.members.map((member) => (
          <li key={member.id}>
            <button
              type="button"
              onClick={() => choose(member)}
              className="card flex w-full flex-col items-center gap-2 py-6 active:bg-cream"
            >
              <Avatar member={member} size="lg" />
              <span className="text-base font-bold">{member.name}</span>
              <span className="text-xs text-muted">
                {member.role === 'parent' ? '부모' : '자녀'}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {db.members.length === 0 && (
        <p className="text-center text-sm text-muted">
          구성원이 없습니다. 브라우저 저장소를 비우면 예시 가족이 다시 생깁니다.
        </p>
      )}
    </div>
  )
}
