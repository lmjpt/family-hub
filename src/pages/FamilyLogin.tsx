import { useState } from 'react'
import { useFamilyAuth } from '../features/familyAuth'
import { isSupabaseConfigured } from '../lib/supabase'

/**
 * 폰마다 한 번만 보는 화면입니다.
 * 어른이 여기까지 해 주면, 그 뒤로 아이는 얼굴만 누르면 됩니다.
 */
export default function FamilyLogin() {
  const { signIn } = useFamilyAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-5xl" aria-hidden="true">🔌</span>
        <h1 className="text-xl font-bold">서버 연결 정보가 없어요</h1>
        <p className="text-sm text-muted">
          프로젝트 폴더의 <code>.env.local</code> 파일에 Supabase 주소와 키를 넣고
          개발 서버를 껐다 켜 주세요.
        </p>
      </div>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const message = await signIn(email, password)
    if (message) setError(message)
    setBusy(false)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <span className="text-5xl" aria-hidden="true">🏠</span>
        <h1 className="mt-3 text-2xl font-bold">우리집</h1>
        <p className="mt-1 text-sm text-muted">
          이 기기에서 처음이네요. 가족 계정으로 한 번만 로그인해 주세요.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="family-email">
            가족 계정 이메일
          </label>
          <input
            id="family-email"
            type="email"
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="family-password">
            비밀번호
          </label>
          <input
            id="family-password"
            type="password"
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && <p className="text-sm font-semibold text-brand">{error}</p>}

        <button type="submit" disabled={busy} className="btn btn-primary w-full py-4 text-lg">
          {busy ? '들어가는 중…' : '들어가기'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted">
        한 번 로그인하면 이 기기에서는 다시 묻지 않아요.
      </p>
    </div>
  )
}
