// 안드로이드 바탕화면 위젯이 부르는 함수. 오늘의 일정과 마감을 한국어 줄로 만들어 줍니다.
//
// 인증은 '위젯 토큰'으로 합니다. 웹 화면의 설정 → 위젯 연결을 누르면 widget_token 에
// 한 줄이 생기고, 그 값이 폰의 위젯에 저장됩니다. 위젯은 그 토큰만 보냅니다 —
// 가족 계정의 비밀번호나 세션은 폰의 네이티브 쪽에 두지 않습니다.
//
// Verify JWT 는 꺼야 합니다 (토큰이 JWT 가 아님). 배포 방법은 android/README.md.

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

const clip = (s: string, n = 28) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

Deno.serve(async (req) => {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return Response.json({ error: '토큰이 없습니다' }, { status: 401 })

  const { data: link } = await supabase
    .from('widget_token')
    .select('family_id, member_id')
    .eq('token', token)
    .maybeSingle()
  if (!link) return Response.json({ error: '토큰이 유효하지 않습니다' }, { status: 401 })

  const { data: member } = await supabase
    .from('member')
    .select('name, avatar_emoji')
    .eq('id', link.member_id)
    .maybeSingle()
  if (!member) return Response.json({ error: '구성원이 없습니다' }, { status: 401 })

  const today = dayKey(new Date())
  const start = new Date(`${today}T00:00:00+09:00`).toISOString()
  const end = new Date(new Date(`${today}T00:00:00+09:00`).getTime() + 86_400_000).toISOString()

  // 오늘 일정: 내 것 + 가족 전체 것. 어제 시작해 오늘까지 이어지는 것도 포함.
  const { data: events } = await supabase
    .from('event')
    .select('title, starts_at, ends_at, all_day, owner_id')
    .eq('family_id', link.family_id)
    .or(`owner_id.is.null,owner_id.eq.${link.member_id}`)
    .lt('starts_at', end)
    .gte('ends_at', start)
    .order('starts_at')

  // 내 할일·숙제: 아직 확인 안 된 것 중 오늘 마감 + 이미 지난 것.
  const { data: tasks } = await supabase
    .from('task')
    .select('title, kind, due_at, status')
    .eq('family_id', link.family_id)
    .eq('assignee_id', link.member_id)
    .neq('status', 'confirmed')
    .not('due_at', 'is', null)
    .lt('due_at', end)
    .order('due_at')

  const lines: string[] = []
  for (const e of events ?? []) {
    const when = e.all_day ? '하루 종일' : time(e.starts_at)
    lines.push(`🗓 ${when} ${clip(e.title)}`)
  }
  for (const t of tasks ?? []) {
    const icon = t.kind === 'homework' ? '📚' : '🧹'
    const overdue = dayKey(new Date(t.due_at)) < today
    const tail = t.status === 'done' ? '확인 기다림' : overdue ? '지남!' : `${time(t.due_at)}까지`
    lines.push(`${icon} ${clip(t.title)} · ${tail}`)
  }

  return Response.json(
    {
      name: `${member.avatar_emoji} ${member.name}`,
      date: dateLabel(today),
      lines,
      empty: '오늘은 비어 있어요 🎉',
      updatedAt: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
})
