// 안드로이드 바탕화면 위젯이 부르는 함수. 오늘의 일정과 마감을 한국어 줄로 만들어 줍니다.
//
// 인증은 '위젯 토큰'으로 합니다. 웹 화면의 설정 → 위젯 연결을 누르면 widget_token 에
// 한 줄이 생기고, 그 값이 폰의 위젯에 저장됩니다. 위젯은 그 토큰만 보냅니다 —
// 가족 계정의 비밀번호나 세션은 폰의 네이티브 쪽에 두지 않습니다.
//
// 위젯은 헤더 두 개를 보냅니다:
//   apikey: <publishable 키>   ← Supabase 게이트웨이가 요구 (Verify JWT 켜 둔 채로 통과)
//   X-Widget-Token: <위젯 토큰> ← 이 함수가 검사
// 배포 방법은 android/README.md.

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const TZ = 'Asia/Seoul'
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const dayFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
})
const timeFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
})

/** 'YYYY-MM-DD' (한국 기준) */
const dayKey = (d: Date) => dayFmt.format(d)
const time = (iso: string) => timeFmt.format(new Date(iso))

function dateLabel(key: string): string {
  const [, m, d] = key.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(`${key}T12:00:00Z`).getUTCDay()]
  return `${m}월 ${d}일 (${weekday})`
}

const clip = (s: string, n = 22) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

Deno.serve(async (req) => {
  try {
    return await handle(req)
  } catch (err) {
    // 원인을 숨기면 폰에서 '불러오지 못했어요 (500)' 만 보이고 고칠 수 없습니다.
    console.error('widget 함수 오류', err)
    return Response.json({ error: String(err) }, { status: 500 })
  }
})

async function handle(req: Request): Promise<Response> {
  const token =
    req.headers.get('x-widget-token')?.trim() ||
    (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return Response.json({ error: '토큰이 없습니다' }, { status: 401 })

  const { data: link } = await supabase
    .from('widget_token')
    .select('family_id, member_id')
    .eq('token', token)
    .maybeSingle()
  if (!link) return Response.json({ error: '토큰이 유효하지 않습니다' }, { status: 401 })

  // 가족 전원. 위젯 주인이 누구인지, 부모면 다른 사람 것에 이름표를 붙이는 데 씁니다.
  const { data: members } = await supabase
    .from('member')
    .select('id, name, role, avatar_emoji')
    .eq('family_id', link.family_id)
  const member = (members ?? []).find((m) => m.id === link.member_id)
  if (!member) return Response.json({ error: '구성원이 없습니다' }, { status: 401 })

  // 부모 위젯은 집 전체를, 아이 위젯은 자기 것만 봅니다 (앱의 권한 표와 같은 기준).
  const seesAll = member.role === 'parent'
  const tag = (id: string | null) => {
    if (!seesAll || !id || id === member.id) return ''
    const who = (members ?? []).find((m) => m.id === id)
    return who ? ` · ${who.avatar_emoji}${who.name}` : ''
  }

  const today = dayKey(new Date())
  const start = new Date(`${today}T00:00:00+09:00`).toISOString()
  const end = new Date(new Date(`${today}T00:00:00+09:00`).getTime() + 86_400_000).toISOString()

  // 오늘 일정. 어제 시작해 오늘까지 이어지는 것도 포함.
  let eventQuery = supabase
    .from('event')
    .select('title, starts_at, ends_at, all_day, owner_id')
    .eq('family_id', link.family_id)
    .lt('starts_at', end)
    .gte('ends_at', start)
  if (!seesAll) eventQuery = eventQuery.or(`owner_id.is.null,owner_id.eq.${link.member_id}`)
  const { data: events } = await eventQuery.order('starts_at')

  // 할일·숙제: 아직 확인 안 된 것 중 오늘 마감 + 이미 지난 것.
  let taskQuery = supabase
    .from('task')
    .select('title, kind, due_at, status, assignee_id')
    .eq('family_id', link.family_id)
    .neq('status', 'confirmed')
    .not('due_at', 'is', null)
    .lt('due_at', end)
  if (!seesAll) taskQuery = taskQuery.eq('assignee_id', link.member_id)
  const { data: tasks } = await taskQuery.order('due_at')

  const lines: string[] = []
  for (const e of events ?? []) {
    const when = e.all_day ? '하루 종일' : time(e.starts_at)
    lines.push(`🗓 ${when} ${clip(e.title)}${tag(e.owner_id)}`)
  }
  for (const t of tasks ?? []) {
    const icon = t.kind === 'homework' ? '📚' : '🧹'
    const overdue = dayKey(new Date(t.due_at)) < today
    const tail = t.status === 'done' ? '확인 기다림' : overdue ? '지남!' : `${time(t.due_at)}까지`
    lines.push(`${icon} ${clip(t.title)}${tag(t.assignee_id)} · ${tail}`)
  }

  return Response.json(
    {
      name: seesAll ? `${member.avatar_emoji} ${member.name} · 가족 전체` : `${member.avatar_emoji} ${member.name}`,
      date: dateLabel(today),
      lines,
      empty: '오늘은 비어 있어요 🎉',
      updatedAt: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
