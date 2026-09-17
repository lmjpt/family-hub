// 푸시 알림 (Web Push).
//
// 앱을 닫아 둔 폰에도 새 대화·댓글을 알려 주기 위한 것입니다.
//   1. public/sw.js 서비스 워커를 등록합니다 (알림 받기·누르기만 담당, 캐시 없음)
//   2. 브라우저에서 구독을 만들어 push_subscription 테이블에 저장합니다
//   3. 서버 쪽 Edge Function(supabase/functions/notify)이 새 글이 생기면
//      이 구독들로 알림을 보냅니다
//
// 아이폰은 Safari 의 '홈 화면에 추가'로 설치한 앱에서만 알림이 됩니다.

import { deletePushSubscription, savePushSubscription } from './db'

/**
 * VAPID 공개 키. 비밀이 아니라서 코드에 둡니다. 짝이 되는 비밀 키는
 * supabase/vapid-keys.local 에 있고 Edge Function 의 secret 으로만 들어갑니다.
 * 키를 새로 만들면 이미 켜 둔 기기의 구독은 모두 무효가 되니 바꾸지 마세요.
 */
export const VAPID_PUBLIC_KEY =
  'BPDOBXRV1yB9J_Ig1crrb5zlvdQJ94XeiDMwSVTS0O_UMVqLVjJl2PGkB6iDfu6IJvHUL_BVMEO06cFO2S60DkU'

export type PushState =
  | 'unsupported' // 이 브라우저는 푸시를 못 합니다
  | 'need-install' // 아이폰: 홈 화면에 추가해야 됩니다
  | 'denied' // 사용자가 알림을 거부해 둔 상태. 폰 설정에서만 되돌릴 수 있습니다
  | 'on'
  | 'off'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** iOS 는 홈 화면에 설치된 웹앱에서만 푸시가 됩니다. */
export function needsHomeScreenInstall(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return ios && !standalone
}

/**
 * 알림을 보내는 Edge Function 주소. 저장소 폴더는 functions/notify 지만, 실제로 배포된
 * 함수 이름은 대시보드 편집기가 붙인 'smooth-handler' 입니다 (supabase/PUSH.md 참고).
 */
const NOTIFY_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smooth-handler`

/**
 * 이 기기 한 대에 테스트 알림을 보내 달라고 서버에 요청합니다.
 * 성공/실패 원인을 사람이 읽을 문구로 돌려줍니다. 알림이 안 올 때 어디가 문제인지
 * 폰 화면에서 바로 보려는 것입니다.
 */
export async function sendTestPush(): Promise<string> {
  const sub = await currentSubscription()
  if (!sub) return '이 기기는 아직 알림이 켜져 있지 않아요.'
  try {
    const res = await fetch(NOTIFY_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''}`,
      },
      body: JSON.stringify({ type: 'TEST', endpoint: sub.endpoint }),
    })
    const text = await res.text()
    if (!res.ok) return `서버 응답 ${res.status}: ${text.slice(0, 200)}`
    const json = JSON.parse(text) as { sent?: number; errors?: string[]; error?: string }
    if (json.error) return `서버 오류: ${json.error}`
    if (json.sent && json.sent > 0) return '테스트 알림을 보냈어요. 잠시 뒤 알림이 뜨는지 봐 주세요.'
    return `보내지 못했어요: ${(json.errors ?? []).join(' / ') || '원인 없음'}`
  } catch (err) {
    return `요청 실패: ${err instanceof Error ? err.message : String(err)}`
  }
}

/** 앱을 켤 때마다 불러도 됩니다. 이미 등록돼 있으면 그대로 돌려줍니다. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    // 상대 경로: GitHub Pages 의 /family-hub/ 같은 하위 경로에서도 맞게 잡힙니다.
    return await navigator.serviceWorker.register('./sw.js')
  } catch (err) {
    console.warn('서비스 워커를 등록하지 못했습니다', err)
    return null
  }
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/**
 * 'denied' 라고 해서 버튼을 잠그지 마세요. 안드로이드 앱(TWA) 안에서는 앱이 아직 알림
 * 권한을 받지 않은 상태가 여기서 'denied' 로 보입니다. 그래도 requestPermission() 을
 * 부르면 크롬이 앱의 권한 창을 띄워 주므로, 시도는 항상 할 수 있어야 합니다.
 */
export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return needsHomeScreenInstall() ? 'need-install' : 'unsupported'
  if (await currentSubscription()) return 'on'
  return Notification.permission === 'denied' ? 'denied' : 'off'
}

/** 안드로이드 앱(TWA) 안에서 열렸는지. 안내 문구를 고를 때 씁니다. */
export function inAndroidApp(): boolean {
  return (
    /Android/i.test(navigator.userAgent) &&
    (window.matchMedia('(display-mode: standalone)').matches || document.referrer.startsWith('android-app://'))
  )
}

/** 이 기기에서 알림을 켭니다. 실패하면 화면에 보여 줄 문구를 돌려줍니다. */
export async function enablePush(memberId: string): Promise<string | null> {
  if (!pushSupported()) {
    return needsHomeScreenInstall()
      ? '아이폰은 먼저 홈 화면에 추가한 뒤에 켤 수 있어요.'
      : '이 브라우저에서는 알림을 쓸 수 없어요.'
  }
  const reg = await registerServiceWorker()
  if (!reg) return '알림 준비에 실패했어요.'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return inAndroidApp()
      ? '알림이 허용되지 않았어요. 폰 설정 → 애플리케이션 → 우리집 → 알림을 켜고 다시 눌러 주세요. 그래도 안 되면 크롬 → 설정 → 사이트 설정 → 알림에서 lmjpt.github.io 차단을 지워 주세요.'
      : '알림이 허용되지 않았어요. 브라우저 주소창의 잠금 아이콘 → 권한 → 알림을 허용해 주세요.'
  }

  await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toKeyBuffer(VAPID_PUBLIC_KEY),
    }))

  const err = await saveSubscription(memberId, sub)
  if (err) {
    await sub.unsubscribe()
    return `서버에 저장하지 못했어요: ${err}`
  }
  return null
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription()
  if (!sub) return
  await deletePushSubscription(sub.endpoint)
  await sub.unsubscribe()
}

/**
 * 앱을 열 때 부릅니다. 이 기기에 구독이 있으면 지금 로그인한 사람으로 다시 묶어
 * 둡니다. 같은 폰에서 다른 사람으로 바꿔 들어와도 알림이 제대로 걸러지게 하려는
 * 것입니다 (본인이 쓴 글은 본인 기기에 알리지 않으므로).
 */
export async function syncPushSubscription(memberId: string): Promise<void> {
  const sub = await currentSubscription()
  if (sub) await saveSubscription(memberId, sub)
}

async function saveSubscription(memberId: string, sub: PushSubscription): Promise<string | null> {
  const json = sub.toJSON()
  return savePushSubscription(memberId, {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  })
}

/** base64url 공개 키 → pushManager.subscribe 가 받는 바이트. */
function toKeyBuffer(base64url: string): ArrayBuffer {
  const padded = base64url.padEnd(Math.ceil(base64url.length / 4) * 4, '=')
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const buffer = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i)
  return buffer
}
