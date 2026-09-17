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
import webpush from 'npm:web-push@3.6.7'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

webpush.setVapidDetails(
  // 푸시 서버가 문제가 있을 때 연락할 곳. 이메일 대신 앱 주소를 씁니다.
  Deno.env.get('VAPID_SUBJECT') ?? 'https://lmjpt.github.io/family-hub/',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: Record<string, unknown> | null
}

interface Notice {
  familyId: string
  /** 이 사람의 기기에는 보내지 않습니다 (본인이 쓴 것) */
  skipMemberId: string
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

async function buildNotice(payload: WebhookPayload): Promise<Notice | null> {
  if (payload.type !== 'INSERT' || !payload.record) return null
  const id = String(payload.record.id ?? '')
  if (!id) return null

  if (payload.table === 'message') {
    const { data: m } = await supabase.from('message').select('*').eq('id', id).maybeSingle()
    if (!m) return null
    return {
      familyId: m.family_id,
      skipMemberId: m.sender_id,
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
      skipMemberId: c.author_id,
      title: `${await memberName(c.author_id)} · ${clip(target, 40)}`,
      body: clip(c.body),
      url,
      tag: `comment-${c.task_id ?? c.event_id}`,
    }
  }

  return null
}

Deno.serve(async (req) => {
  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'JSON 이 아닙니다' }, { status: 400 })
  }

  const notice = await buildNotice(payload)
  if (!notice) return Response.json({ sent: 0, skipped: true })

  const { data: subs, error } = await supabase
    .from('push_subscription')
    .select('endpoint, p256dh, auth')
    .eq('family_id', notice.familyId)
    .neq('member_id', notice.skipMemberId)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const message = JSON.stringify({
    title: notice.title,
    body: notice.body,
    url: notice.url,
    tag: notice.tag,
  })

  let sent = 0
  let removed = 0
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          message,
          { TTL: 60 * 60 * 24 },
        )
        sent += 1
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        // 404/410 = 그 기기가 알림을 꺼서 더는 유효하지 않은 구독. 정리합니다.
        if (status === 404 || status === 410) {
          await supabase.from('push_subscription').delete().eq('endpoint', s.endpoint)
          removed += 1
        } else {
          console.error('푸시 실패', status, (err as Error).message)
        }
      }
    }),
  )

  return Response.json({ sent, removed })
})
