import { useEffect, useState } from 'react'
import { disablePush, enablePush, getPushState, sendTestPush } from '../../lib/push'
import type { PushState } from '../../lib/push'
import { useMe } from '../auth'

/** 설정 화면의 '알림' 칸. 이 기기에서 알림을 켜고 끕니다. */
export default function NotificationSettings() {
  const me = useMe()
  const [state, setState] = useState<PushState | 'busy'>('busy')
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState('')
  const [testing, setTesting] = useState(false)

  async function test() {
    setTesting(true)
    setTestResult('보내는 중…')
    try {
      setTestResult(await sendTestPush())
    } finally {
      setTesting(false)
    }
  }

  useEffect(() => {
    void getPushState().then(setState)
  }, [])

  async function toggle() {
    if (!me || state === 'busy') return
    setError('')
    const before = state
    setState('busy')
    try {
      if (before === 'on') {
        await disablePush()
      } else {
        const err = await enablePush(me.id)
        if (err) setError(err)
      }
    } finally {
      setState(await getPushState())
    }
  }

  // 'denied' 도 눌러 볼 수 있게 둡니다. 안드로이드 앱에서는 이 상태에서 누르는 게
  // 곧 앱 권한 창을 띄우는 길입니다 (lib/push.ts 의 설명 참고).
  const canToggle = state === 'on' || state === 'off' || state === 'denied'

  return (
    <section className="space-y-2">
      <h3 className="text-base font-bold">알림</h3>
      <div className="card flex items-center gap-3 px-4 py-3">
        <span className="text-2xl" aria-hidden="true">
          🔔
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">이 기기에서 알림 받기</span>
          <span className="block text-sm text-muted">
            {state === 'busy' && '확인하는 중…'}
            {state === 'on' && '앱을 닫아 두어도 새 대화와 댓글을 알려 줍니다.'}
            {state === 'off' && '켜면 앱을 닫아 두어도 새 대화와 댓글을 알려 줍니다.'}
            {state === 'need-install' &&
              '아이폰은 Safari 의 공유 버튼 → "홈 화면에 추가" 로 설치한 다음, 그 아이콘으로 열어서 켤 수 있어요.'}
            {state === 'denied' &&
              '아직 허용되지 않았어요. 켜기를 누르면 권한을 묻는 창이 뜹니다. 창이 안 뜨면 폰 설정 → 애플리케이션 → 우리집 → 알림을 켜 주세요.'}
            {state === 'unsupported' && '이 브라우저에서는 알림을 쓸 수 없어요.'}
          </span>
          {error && <span className="block text-sm text-brand">{error}</span>}
        </span>
        <button
          type="button"
          onClick={toggle}
          disabled={!canToggle}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
            state === 'on' ? 'bg-brand text-white' : 'border border-line bg-paper text-muted'
          } disabled:opacity-50`}
          aria-pressed={state === 'on'}
        >
          {state === 'on' ? '켜짐' : state === 'busy' ? '…' : '켜기'}
        </button>
      </div>

      {/* 알림이 안 올 때 어디가 문제인지 폰에서 바로 보는 길 */}
      {state === 'on' && (
        <div className="flex flex-wrap items-center gap-3 px-1">
          <button
            type="button"
            onClick={() => void test()}
            disabled={testing}
            className="text-sm font-semibold text-muted underline underline-offset-4"
          >
            이 기기로 테스트 알림 보내기
          </button>
          {testResult && <span className="text-sm break-words text-muted">{testResult}</span>}
        </div>
      )}
    </section>
  )
}
