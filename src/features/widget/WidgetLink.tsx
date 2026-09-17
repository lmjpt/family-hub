import { useState } from 'react'
import { createWidgetToken } from '../../lib/db'
import { useMe } from '../auth'

const APK_URL = 'https://github.com/lmjpt/family-hub/releases/latest/download/family-hub.apk'
const PACKAGE = 'io.github.lmjpt.familyhub'

/** 안드로이드 폰에서만 뜨는 '바탕화면 위젯' 칸. 아이폰·PC 에서는 아무것도 그리지 않습니다. */
export default function WidgetLink() {
  const me = useMe()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!/Android/i.test(navigator.userAgent) || !me) return null

  async function connect() {
    if (!me) return
    setBusy(true)
    setError('')
    const result = await createWidgetToken(me.id)
    setBusy(false)
    if ('error' in result) {
      setError(`연결 정보를 만들지 못했어요: ${result.error}`)
      return
    }
    // 크롬이 이 주소를 우리 앱(WidgetLinkActivity)에 넘겨 줍니다.
    // 앱이 없으면 fallback 주소(APK 내려받기)로 갑니다.
    const fallback = encodeURIComponent(APK_URL)
    window.location.href =
      `intent://widget?token=${result.token}#Intent;scheme=familyhub;package=${PACKAGE};` +
      `S.browser_fallback_url=${fallback};end`
  }

  return (
    <section className="space-y-2">
      <h3 className="text-base font-bold">바탕화면 위젯 (안드로이드)</h3>
      <div className="card space-y-3 px-4 py-4">
        <p className="text-sm text-muted">
          바탕화면에서 <b>{me.name}</b>의 오늘 일정과 마감을 바로 봅니다. 누르면 앱이
          열려요.
        </p>
        <ol className="space-y-1.5 text-sm">
          <li>
            <span className="font-bold">1.</span> 아직 앱이 없으면{' '}
            <a className="font-semibold text-brand underline underline-offset-4" href={APK_URL}>
              우리집 앱(APK) 내려받기
            </a>
            를 눌러 설치해요.
          </li>
          <li>
            <span className="font-bold">2.</span> 설치한 <b>우리집 앱</b>을 열고 이 화면에서
            아래 버튼을 눌러요.
          </li>
          <li>
            <span className="font-bold">3.</span> 바탕화면 빈 곳을 길게 눌러 <b>위젯</b> →{' '}
            <b>우리집 오늘</b>을 추가해요.
          </li>
        </ol>
        <button
          type="button"
          onClick={() => void connect()}
          disabled={busy}
          className="btn btn-primary w-full"
        >
          {busy ? '준비 중…' : '📌 위젯 연결'}
        </button>
        {error && <p className="text-sm text-brand">{error}</p>}
        <p className="text-xs text-muted">
          다른 사람으로 바꿔 쓰는 폰이면 그 사람으로 들어와서 다시 누르면 위젯이 그 사람 것으로
          바뀝니다.
        </p>
      </div>
    </section>
  )
}
