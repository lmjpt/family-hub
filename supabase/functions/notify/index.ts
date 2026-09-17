// 새 메시지·댓글이 생기면 가족의 다른 기기로 푸시 알림을 보냅니다.
//
// 흐름:  message/comment 에 INSERT → Database Webhook → 이 함수 → 웹 푸시
//
// 배포와 설정 방법은 supabase/PUSH.md 를 보세요.
// 필요한 secret: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (SUPABASE_URL 과
// SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 자동으로 넣어 줍니다).
//
// 이 함수는 service_role 로 동작하므로 RLS 를 지나갑니다. 브라우저에 절대 두지 않는
// 키가 여기서만 쓰이는 이유입니다. 그래서 웹훅이 준 record 를 믿지 않고
// 항상 DB 에서 다시 읽습니다.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendWebPush } from './webpush.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// 푸시 서명 키. npm:web-push 대신 옆 파일(webpush.ts)의 WebCrypto 구현을 씁니다.
const VAPID = {
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
  // 푸시 서버가 문제가 있을 때 연락할 곳. 이메일 대신 앱 주소를 씁니다.
  subject: Deno.env.get('VAPID_SUBJECT') ?? 'https://lmjpt.github.io/family-hub/',
}

interface WebhookPayload {
  /** 'TEST' 는 앱의 설정 → '테스트 알림 보내기' 가 보내는 것. 그 기기 하나에만 보냅니다. */
  type: 'INSERT' | 'UPDATE' | 'DELETE' | 'TEST'
  table?: string
  record?: Record<string, unknown> | null
  /** UPDATE 일 때 바뀌기 전 줄 (task 의 status 변화를 보는 데 씁니다) */
  old_record?: Record<string, unknown> | null
  /** TEST 일 때: 보낼 기기의 구독 endpoint */
  endpoint?: string
}

interface Subscription {
  endpoint: string
  p256dh: string
  auth: string
}

/** 한 기기로 보냅니다. 실패하면 사람이 읽을 원인 문구를 돌려줍니다. */
async function sendTo(sub: Subscription, message: string): Promise<string | null> {
  if (!VAPID.publicKey || !VAPID.privateKey) return 'VAPID secret 이 없습니다 (Edge Functions → Secrets)'
  try {
    // urgency high: 폰이 절전 상태여도 바로 깨워 전달합니다. 가족 대화는 미뤄질 이유가 없습니다.
    const r = await sendWebPush(sub, message, VAPID, { ttl: 60 * 60 * 24, urgency: 'high' })
    if (r.ok) return null
    // 404/410 = 그 기기가 알림을 꺼서(또는 폰이 권한 없음으로 판단해) 더는 유효하지 않은 구독. 정리합니다.
    if (r.status === 404 || r.status === 410) {
      await supabase.from('push_subscription').delete().eq('endpoint', sub.endpoint)
      return `구독이 만료되어 지웠습니다 (${r.status}). 그 폰에서 알림을 다시 켜 주세요.`
    }
    return `[${r.status}] ${r.body.slice(0, 160)}`.trim()
  } catch (err) {
    return `보내는 중 오류: ${err instanceof Error ? err.message : String(err)}`
  }
}

interface Notice {
  familyId: string
  /** 이 사람들의 기기에는 보내지 않습니다 (본인이 한 일) */
  skipMemberIds: string[]
  /** 있으면 이 사람들에게만 보냅니다 (없으면 가족 전체) */
  onlyMemberIds?: string[]
  title: string
  body: string
  /** 알림을 누르면 열 화면. 앱 루트 기준 상대 주소 */
  url: string
  tag: string
}

/** 긴 글은 알림에 다 들어가지 않으니 앞부분만. */
const clip = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

async function memberName(id: string): Promise<string> {
  const { data } = await supabase.from('member').select('name').eq('id', id).maybeSingle()
  return data?.name ?? '가족'
}

const TZ = 'Asia/Seoul'
const dueFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TZ, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
})
/** '9월 18일 21:00까지' */
function dueLabel(iso: string | null): string {
  if (!iso) return ''
  const p = Object.fromEntries(dueFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return ` · ${p.month}월 ${p.day}일 ${p.hour}:${p.minute}까지`
}

/**
 * 할일·숙제가 새로 배정됐을 때 (새로 만들었거나 담당자를 바꿨을 때) → 그 담당자에게.
 * 사진에서 여러 개를 한 번에 넣으면 알림도 여러 개 오므로, 같은 tag 로 묶어 마지막 것만 남깁니다.
 */
async function assignedNotice(id: string): Promise<Notice | null> {
  const { data: t } = await supabase.from('task').select('*').eq('id', id).maybeSingle()
  if (!t || !t.assignee_id) return null
  const kind = t.kind === 'homework' ? '숙제' : '할일'
  return {
    familyId: t.family_id,
    skipMemberIds: [],
    onlyMemberIds: [t.assignee_id],
    title: `새 ${kind}가 왔어요`,
    body: `${clip(t.title)}${dueLabel(t.due_at)}`,
    url: t.kind === 'homework' ? './#/homework' : './#/tasks',
    tag: `assigned-${t.assignee_id}`,
  }
}

/**
 * 할일·숙제의 상태가 바뀌었을 때.
 *   todo → done      아이가 다 했다고 체크 → 부모들에게 "확인해 주세요"
 *   done → confirmed 부모가 확인(포인트 지급) → 그 아이에게 "잘했어요"
 * 그 밖의 변화(체크 취소 등)는 알리지 않습니다.
 */
async function taskNotice(id: string, oldStatus: unknown): Promise<Notice | null> {
  const { data: t } = await supabase.from('task').select('*').eq('id', id).maybeSingle()
  if (!t || t.status === oldStatus) return null

  const { data: members } = await supabase
    .from('member')
    .select('id, name, role')
    .eq('family_id', t.family_id)
  const assignee = (members ?? []).find((m) => m.id === t.assignee_id)
  const parents = (members ?? []).filter((m) => m.role === 'parent').map((m) => m.id)
  const kind = t.kind === 'homework' ? '숙제' : '할일'
  const url = t.kind === 'homework' ? './#/homework' : './#/tasks'

  if (t.status === 'done') {
    if (parents.length === 0) return null
    return {
      familyId: t.family_id,
      skipMemberIds: assignee ? [assignee.id] : [],
      onlyMemberIds: parents,
      title: `${assignee?.name ?? '누군가'} · ${kind} 다 했어요`,
      body: `${clip(t.title)} — 확인해 주세요`,
      url,
      tag: `task-${t.id}`,
    }
  }

  if (t.status === 'confirmed' && assignee) {
    const points = Number(t.reward_points ?? 0)
    return {
      familyId: t.family_id,
      skipMemberIds: [],
      onlyMemberIds: [assignee.id],
      title: `${kind} 확인 완료${points > 0 ? ` · +${points}점` : ''}`,
      body: `${clip(t.title)} 잘했어요 ⭐`,
      url,
      tag: `task-${t.id}`,
    }
  }

  return null
}

async function buildNotice(payload: WebhookPayload): Promise<Notice | null> {
  if (!payload.record) return null
  const id = String(payload.record.id ?? '')
  if (!id) return null

  if (payload.table === 'task') {
    if (payload.type === 'INSERT') return assignedNotice(id)
    if (payload.type === 'UPDATE') {
      // 담당자가 바뀌었으면 새 담당자에게, 아니면 상태 변화로 봅니다.
      const oldAssignee = payload.old_record?.assignee_id ?? null
      if (payload.record.assignee_id && payload.record.assignee_id !== oldAssignee) {
        return assignedNotice(id)
      }
      return taskNotice(id, payload.old_record?.status)
    }
    return null
  }
  if (payload.type !== 'INSERT') return null

  if (payload.table === 'message') {
    const { data: m } = await supabase.from('message').select('*').eq('id', id).maybeSingle()
    if (!m) return null
    return {
      familyId: m.family_id,
      skipMemberIds: [m.sender_id],
      title: await memberName(m.sender_id),
      body: clip(m.body),
      url: './#/chat',
      tag: 'chat',
    }
  }

  if (payload.table === 'comment') {
    const { data: c } = await supabase.from('comment').select('*').eq('id', id).maybeSingle()
    if (!c) return null

    let target = ''
    let url = './#/'
    if (c.task_id) {
      const { data: t } = await supabase
        .from('task')
        .select('title, kind')
        .eq('id', c.task_id)
        .maybeSingle()
      target = t?.title ?? '할일'
      url = t?.kind === 'homework' ? './#/homework' : './#/tasks'
    } else if (c.event_id) {
      const { data: e } = await supabase
        .from('event')
        .select('title')
        .eq('id', c.event_id)
        .maybeSingle()
      target = e?.title ?? '일정'
    }

    return {
      familyId: c.family_id,
      skipMemberIds: [c.author_id],
      title: `${await memberName(c.author_id)} · ${clip(target, 40)}`,
      body: clip(c.body),
      url,
      tag: `comment-${c.task_id ?? c.event_id}`,
    }
  }

  return null
}

// 앱(브라우저)에서 테스트 알림을 요청할 때 필요한 CORS 응답. 트리거(서버→서버)에는 무관합니다.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const res = await handle(req)
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v)
  return res
})

async function handle(req: Request): Promise<Response> {
  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'JSON 이 아닙니다' }, { status: 400 })
  }

  // 테스트: 앱에서 누른 기기 한 대에만 보내고, 결과를 그대로 돌려줍니다.
  if (payload.type === 'TEST') {
    if (!payload.endpoint) return Response.json({ error: 'endpoint 가 없습니다' }, { status: 400 })
    const { data: sub } = await supabase
      .from('push_subscription')
      .select('endpoint, p256dh, auth')
      .eq('endpoint', payload.endpoint)
      .maybeSingle()
    if (!sub) {
      return Response.json({ sent: 0, errors: ['이 기기의 구독이 서버에 없습니다. 알림을 끄고 다시 켜 보세요.'] })
    }
    const err = await sendTo(sub, JSON.stringify({
      title: '우리집 테스트 알림',
      body: '이 알림이 보이면 준비가 다 된 거예요 🎉',
      url: './#/settings',
      tag: 'test',
    }))
    return Response.json({ sent: err ? 0 : 1, errors: err ? [err] : [] })
  }

  const notice = await buildNotice(payload)
  if (!notice) return Response.json({ sent: 0, skipped: true })

  const { data: allSubs, error } = await supabase
    .from('push_subscription')
    .select('endpoint, p256dh, auth, member_id')
    .eq('family_id', notice.familyId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const subs = (allSubs ?? []).filter(
    (s) =>
      !notice.skipMemberIds.includes(s.member_id) &&
      (!notice.onlyMemberIds || notice.onlyMemberIds.includes(s.member_id)),
  )

  const message = JSON.stringify({
    title: notice.title,
    body: notice.body,
    url: notice.url,
    tag: notice.tag,
  })

  const results = await Promise.all(subs.map((s) => sendTo(s, message)))
  const errors = results.filter((r): r is string => r !== null)
  if (errors.length) console.error('푸시 실패', errors)

  // 트리거 쪽 기록(net._http_response)에도 이 JSON 이 남아 나중에 원인을 볼 수 있습니다.
  return Response.json({ sent: results.length - errors.length, errors })
}
