// ─────────────────────────────────────────────────────────────
// 데이터 계층. 앱의 나머지 부분은 여기를 통해서만 데이터를 읽고 씁니다.
//
// 저장소는 Supabase(PostgreSQL)입니다. 가족 구성원이 각자 폰에서 같은
// 내용을 보고, 한 사람이 바꾸면 다른 사람 화면에 바로 반영됩니다.
//
// 동작 방식:
//   1. 로그인하면 가족 데이터를 한 번에 모두 읽어 메모리에 둡니다 (state)
//   2. 화면은 항상 이 메모리 사본을 그립니다 — 그래서 즉시 반응합니다
//   3. 바꿀 때는 메모리를 먼저 고치고(낙관적 갱신) 서버에 보냅니다
//   4. 서버가 실패하면 서버 내용을 다시 읽어 되돌립니다
//   5. 다른 기기에서 바뀌면 실시간 구독이 알려 주고 다시 읽습니다
//
// 데이터 양이 가족 하나 분량이라 '바뀌면 전체를 다시 읽는' 단순한 방식으로
// 충분합니다. 부분 갱신으로 최적화하려 하지 마세요 — 틀리기만 쉽습니다.
// ─────────────────────────────────────────────────────────────

import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { starterMembers, starterRewards } from './seed'
import type {
  ChatRead,
  Comment,
  Family,
  FamilyEvent,
  Member,
  Message,
  PointEntry,
  Reward,
  Task,
} from '../types'

export interface DbShape {
  family: Family
  members: Member[]
  events: FamilyEvent[]
  tasks: Task[]
  points: PointEntry[]
  rewards: Reward[]
  /** 최근 대화만 (오래된 순). 전부 다 들고 있지는 않습니다. */
  messages: Message[]
  /** 일정·할일에 달린 댓글 전부 (오래된 순) */
  comments: Comment[]
  /** 대화방에서 구성원마다 어디까지 읽었나 */
  chatReads: ChatRead[]
}

/** 아직 아무것도 못 읽었을 때의 빈 상태 */
const EMPTY: DbShape = {
  family: { id: '', name: '우리집' },
  members: [],
  events: [],
  tasks: [],
  points: [],
  rewards: [],
  messages: [],
  comments: [],
  chatReads: [],
}

/**
 * 대화는 쌓이기만 하므로 최근 것만 읽습니다. 가족 대화방에서 이보다 위로
 * 올라가 볼 일은 거의 없고, 있으면 그때 '더 보기'를 붙이면 됩니다.
 */
const MESSAGE_LIMIT = 200

export type DbStatus = 'idle' | 'loading' | 'ready' | 'error'

export function newId(): string {
  return crypto.randomUUID()
}

// ── DB 줄 ↔ 앱 객체 변환 ──────────────────────────────────────
// DB 는 snake_case, 앱 안은 camelCase 입니다. 변환은 여기서만 합니다.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

const toMember = (r: Row): Member => ({
  id: r.id,
  familyId: r.family_id,
  name: r.name,
  role: r.role,
  color: r.color,
  birthDate: r.birth_date,
  avatarEmoji: r.avatar_emoji,
  pin: r.pin ?? '',
})

const fromMember = (m: Partial<Member>): Row => prune({
  id: m.id,
  family_id: m.familyId,
  name: m.name,
  role: m.role,
  color: m.color,
  birth_date: m.birthDate,
  avatar_emoji: m.avatarEmoji,
  pin: m.pin,
})

const toEvent = (r: Row): FamilyEvent => ({
  id: r.id,
  familyId: r.family_id,
  title: r.title,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  allDay: r.all_day,
  ownerId: r.owner_id,
  memo: r.memo ?? '',
  seriesId: r.series_id ?? null,
})

const fromEvent = (e: Partial<FamilyEvent>): Row => prune({
  id: e.id,
  family_id: e.familyId,
  title: e.title,
  starts_at: e.startsAt,
  ends_at: e.endsAt,
  all_day: e.allDay,
  owner_id: e.ownerId,
  memo: e.memo,
  series_id: e.seriesId,
})

const toTask = (r: Row): Task => ({
  id: r.id,
  familyId: r.family_id,
  title: r.title,
  kind: r.kind,
  assigneeId: r.assignee_id,
  dueAt: r.due_at,
  status: r.status,
  subject: r.subject,
  rewardPoints: r.reward_points ?? 0,
})

const fromTask = (t: Partial<Task>): Row => prune({
  id: t.id,
  family_id: t.familyId,
  title: t.title,
  kind: t.kind,
  assignee_id: t.assigneeId,
  due_at: t.dueAt,
  status: t.status,
  subject: t.subject,
  reward_points: t.rewardPoints,
})

const toPoint = (r: Row): PointEntry => ({
  id: r.id,
  familyId: r.family_id,
  memberId: r.member_id,
  points: r.points,
  reason: r.reason,
  givenBy: r.given_by,
  createdAt: r.created_at,
  taskId: r.task_id,
})

const fromPoint = (p: Partial<PointEntry>): Row => prune({
  id: p.id,
  family_id: p.familyId,
  member_id: p.memberId,
  points: p.points,
  reason: p.reason,
  given_by: p.givenBy,
  created_at: p.createdAt,
  task_id: p.taskId,
})

const toReward = (r: Row): Reward => ({
  id: r.id,
  familyId: r.family_id,
  title: r.title,
  costPoints: r.cost_points,
  active: r.active,
})

const fromReward = (r: Partial<Reward>): Row => prune({
  id: r.id,
  family_id: r.familyId,
  title: r.title,
  cost_points: r.costPoints,
  active: r.active,
})

const toMessage = (r: Row): Message => ({
  id: r.id,
  familyId: r.family_id,
  senderId: r.sender_id,
  body: r.body,
  createdAt: r.created_at,
})

const fromMessage = (m: Partial<Message>): Row => prune({
  id: m.id,
  family_id: m.familyId,
  sender_id: m.senderId,
  body: m.body,
  created_at: m.createdAt,
})

const toChatRead = (r: Row): ChatRead => ({
  memberId: r.member_id,
  lastReadAt: r.last_read_at,
})

const toComment = (r: Row): Comment => ({
  id: r.id,
  familyId: r.family_id,
  eventId: r.event_id,
  taskId: r.task_id,
  authorId: r.author_id,
  body: r.body,
  createdAt: r.created_at,
})

const fromComment = (c: Partial<Comment>): Row => prune({
  id: c.id,
  family_id: c.familyId,
  event_id: c.eventId,
  task_id: c.taskId,
  author_id: c.authorId,
  body: c.body,
  created_at: c.createdAt,
})

/** undefined 인 칸을 빼서, 부분 수정이 다른 칸을 null 로 덮어쓰지 않게 합니다. */
function prune(row: Row): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(row)) if (v !== undefined) out[k] = v
  return out
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── 상태 ──────────────────────────────────────────────────────

let state: DbShape = EMPTY
let status: DbStatus = 'idle'
let familyId = ''
/** 연결에 실패했을 때 화면에 그대로 보여 줄 원인. 없으면 빈 문자열. */
let lastError = ''
/**
 * message 테이블이 아직 없으면(schema.sql 을 다시 실행하기 전) false.
 * 대화방만 '준비 중' 으로 보여 주고 나머지 앱은 그대로 돕니다.
 */
let chatReady = true
/** comment 테이블이 없으면 false. 댓글 버튼을 숨기고 나머지는 그대로 돕니다. */
let commentsReady = true
/** chat_read 테이블이 없으면 false. 읽음 표시만 빠지고 대화는 그대로 됩니다. */
let readsReady = true
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

function setState(next: DbShape) {
  state = next
  notify()
}

function setStatus(next: DbStatus) {
  status = next
  notify()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const getState = (): DbShape => state
const getStatus = (): DbStatus => status
const getError = (): string => lastError
const getChatReady = (): boolean => chatReady
const getCommentsReady = (): boolean => commentsReady

/** 대화방을 쓸 수 있는지. false 면 서버에 message 테이블이 없는 것입니다. */
export function useChatReady(): boolean {
  return useSyncExternalStore(subscribe, getChatReady, getChatReady)
}

/** 댓글을 쓸 수 있는지. false 면 서버에 comment 테이블이 없는 것입니다. */
export function useCommentsReady(): boolean {
  return useSyncExternalStore(subscribe, getCommentsReady, getCommentsReady)
}

/** 연결 실패 원인. 화면에 그대로 보여 주기 위한 것입니다. */
export function useDbError(): string {
  return useSyncExternalStore(subscribe, getError, getError)
}

/** 오류 객체에서 사람이 읽을 만한 내용을 뽑아냅니다. */
function describe(err: unknown): string {
  if (!err) return '알 수 없는 오류'
  if (typeof err === 'string') return err
  const e = err as { message?: string; details?: string; hint?: string; code?: string }
  return [e.code && `[${e.code}]`, e.message, e.details, e.hint].filter(Boolean).join(' ')
}

/** 가족 데이터 전체. 바뀌면 컴포넌트가 다시 그려집니다. */
export function useDb(): DbShape {
  return useSyncExternalStore(subscribe, getState, getState)
}

/** 'loading' 동안에는 화면 대신 안내를 보여 주세요. */
export function useDbStatus(): DbStatus {
  return useSyncExternalStore(subscribe, getStatus, getStatus)
}

// ── 읽기 ──────────────────────────────────────────────────────

async function loadAll(id: string): Promise<void> {
  const [family, members, events, tasks, points, rewards, messages, comments, reads] =
    await Promise.all([
      supabase.from('family').select('*').eq('id', id).single(),
      supabase.from('member').select('*').eq('family_id', id).order('created_at'),
      supabase.from('event').select('*').eq('family_id', id),
      supabase.from('task').select('*').eq('family_id', id),
      supabase.from('point_entry').select('*').eq('family_id', id),
      supabase.from('reward').select('*').eq('family_id', id),
      supabase
        .from('message')
        .select('*')
        .eq('family_id', id)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_LIMIT),
      supabase.from('comment').select('*').eq('family_id', id).order('created_at'),
      supabase.from('chat_read').select('*').eq('family_id', id),
    ])

  const failed = [family, members, events, tasks, points, rewards].find((r) => r.error)
  if (failed?.error) throw failed.error

  // 나중에 추가된 테이블(대화, 댓글, 읽음)은 없어도 앱 전체가 멈추면 안 됩니다.
  // schema.sql 을 다시 실행하기 전까지 그 기능만 '준비 중'으로 둡니다.
  if (messages.error) console.warn('대화방을 읽지 못했습니다', messages.error)
  if (comments.error) console.warn('댓글을 읽지 못했습니다', comments.error)
  if (reads.error) console.warn('읽음 표시를 읽지 못했습니다', reads.error)
  chatReady = !messages.error
  commentsReady = !comments.error
  readsReady = !reads.error

  setState({
    family: { id: family.data!.id, name: family.data!.name },
    members: (members.data ?? []).map(toMember),
    events: (events.data ?? []).map(toEvent),
    tasks: (tasks.data ?? []).map(toTask),
    points: (points.data ?? []).map(toPoint),
    rewards: (rewards.data ?? []).map(toReward),
    messages: (messages.data ?? []).map(toMessage).reverse(),
    comments: (comments.data ?? []).map(toComment),
    chatReads: (reads.data ?? []).map(toChatRead),
  })
}

/** 서버 내용을 다시 읽어 화면을 맞춥니다. 실패해도 조용히 넘어갑니다. */
async function reload(): Promise<void> {
  if (!familyId) return
  try {
    await loadAll(familyId)
  } catch (err) {
    console.error('데이터를 다시 읽지 못했습니다', err)
  }
}

/**
 * 이 계정의 가족을 찾고, 없으면 처음 한 번 만들어 줍니다.
 * (구성원 4명 + 보상 3개. 일정·할일은 넣지 않습니다.)
 */
async function ensureFamily(userId: string): Promise<string> {
  const existing = await supabase
    .from('family')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)
    .maybeSingle()
  if (existing.error) throw existing.error
  if (existing.data) return existing.data.id

  const created = await supabase
    .from('family')
    .insert({ owner_id: userId, name: '우리집' })
    .select('id')
    .single()
  if (created.error) throw created.error
  const id = created.data.id

  const members = starterMembers().map((m) => fromMember({ ...m, familyId: id }))
  const rewards = starterRewards().map((r) => fromReward({ ...r, familyId: id }))
  const [mRes, rRes] = await Promise.all([
    supabase.from('member').insert(members),
    supabase.from('reward').insert(rewards),
  ])
  if (mRes.error) throw mRes.error
  if (rRes.error) throw rRes.error

  return id
}

// ── 실시간 ────────────────────────────────────────────────────

let channel: ReturnType<typeof supabase.channel> | null = null

function watch(id: string) {
  channel = supabase.channel(`family-${id}`)
  const tables = ['family', 'member', 'event', 'task', 'point_entry', 'reward']
  // 없는 테이블을 구독하면 채널 전체가 실패하므로 있을 때만 넣습니다.
  if (chatReady) tables.push('message')
  if (commentsReady) tables.push('comment')
  if (readsReady) tables.push('chat_read')
  for (const table of tables) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        // family 테이블만 기준 칼럼 이름이 다릅니다.
        filter: table === 'family' ? `id=eq.${id}` : `family_id=eq.${id}`,
      },
      // 내가 방금 한 변경도 여기로 돌아오지만, 이미 같은 내용이라
      // 다시 읽어도 화면은 그대로입니다.
      () => void reload(),
    )
  }
  channel.subscribe()
}

/** 로그인 직후 호출합니다. 가족을 준비하고 데이터를 읽고 실시간 구독을 켭니다. */
export async function startFamily(userId: string): Promise<void> {
  // 같은 로그인으로 두 번 들어오는 경우가 있어 (탭 복귀, 토큰 갱신) 막아 둡니다.
  if (status === 'loading' || (status === 'ready' && familyId)) return

  setStatus('loading')
  lastError = ''
  try {
    familyId = await ensureFamily(userId)
    await loadAll(familyId)
    watch(familyId)
    setStatus('ready')
  } catch (err) {
    console.error('가족 데이터를 불러오지 못했습니다', err)
    lastError = describe(err)
    setStatus('error')
  }
}

/** 로그아웃할 때 호출합니다. */
export async function stopFamily(): Promise<void> {
  if (channel) {
    await supabase.removeChannel(channel)
    channel = null
  }
  familyId = ''
  state = EMPTY
  lastError = ''
  setStatus('idle')
}

// ── 쓰기 도우미 ───────────────────────────────────────────────

/**
 * 화면을 먼저 바꾸고 서버에 보냅니다.
 * 서버가 거절하면 서버 내용을 다시 읽어 되돌립니다.
 */
function write(optimistic: DbShape, remote: () => PromiseLike<{ error: unknown }>) {
  setState(optimistic)
  void (async () => {
    const { error } = await remote()
    if (error) {
      console.error('저장하지 못했습니다', error)
      await reload()
    }
  })()
}

// ── 구성원 ────────────────────────────────────────────────────

export function addMember(input: Omit<Member, 'id' | 'familyId'>): Member {
  const member: Member = { ...input, id: newId(), familyId }
  write({ ...state, members: [...state.members, member] }, () =>
    supabase.from('member').insert(fromMember(member)),
  )
  return member
}

export function updateMember(id: string, changes: Partial<Member>) {
  write(
    { ...state, members: state.members.map((m) => (m.id === id ? { ...m, ...changes } : m)) },
    () => supabase.from('member').update(fromMember(changes)).eq('id', id),
  )
}

/**
 * 구성원을 지우면 그 사람에게 달려 있던 것들도 함께 사라집니다.
 * (DB 의 on delete cascade 가 처리하므로 여기서는 화면만 맞춥니다.)
 */
export function removeMember(id: string) {
  write(
    {
      ...state,
      members: state.members.filter((m) => m.id !== id),
      events: state.events.filter((e) => e.ownerId !== id),
      tasks: state.tasks.filter((t) => t.assigneeId !== id),
      points: state.points.filter((p) => p.memberId !== id),
    },
    () => supabase.from('member').delete().eq('id', id),
  )
}

// 가족 이름은 글자를 칠 때마다 바뀝니다. 타이핑이 멈춘 뒤에 한 번만 보냅니다.
let renameTimer: ReturnType<typeof setTimeout> | undefined

export function renameFamily(name: string) {
  setState({ ...state, family: { ...state.family, name } })
  clearTimeout(renameTimer)
  renameTimer = setTimeout(() => {
    void supabase.from('family').update({ name }).eq('id', familyId)
  }, 600)
}

// ── 일정 ──────────────────────────────────────────────────────

export function addEvent(input: Omit<FamilyEvent, 'id' | 'familyId' | 'seriesId'>) {
  const event: FamilyEvent = { ...input, id: newId(), familyId, seriesId: null }
  write({ ...state, events: [...state.events, event] }, () =>
    supabase.from('event').insert(fromEvent(event)),
  )
  return event
}

/**
 * 반복 일정: 같은 내용을 여러 날짜에 한 번에 만듭니다. 전부 같은 seriesId 를 가져서
 * '이 반복 전체 지우기' 가 됩니다. 규칙은 저장하지 않습니다 — 날짜마다 실제 줄입니다.
 */
export function addEventSeries(
  base: Omit<FamilyEvent, 'id' | 'familyId' | 'seriesId' | 'startsAt' | 'endsAt'>,
  occurrences: { startsAt: string; endsAt: string }[],
) {
  if (occurrences.length === 0) return []
  const seriesId = newId()
  const events: FamilyEvent[] = occurrences.map((o) => ({
    ...base,
    ...o,
    id: newId(),
    familyId,
    seriesId,
  }))
  write({ ...state, events: [...state.events, ...events] }, async () => {
    const res = await supabase.from('event').insert(events.map(fromEvent))
    // series_id 컬럼이 아직 없는 서버(schema.sql 재실행 전)면 묶음 없이라도 저장합니다.
    if (res.error && (res.error as { code?: string }).code === '42703') {
      return supabase
        .from('event')
        .insert(events.map((e) => fromEvent({ ...e, seriesId: undefined })))
    }
    return res
  })
  return events
}

/** 반복으로 만든 일정을 한 번에 지웁니다. 댓글은 cascade 로 함께 사라집니다. */
export function removeEventSeries(seriesId: string) {
  const ids = new Set(state.events.filter((e) => e.seriesId === seriesId).map((e) => e.id))
  write(
    {
      ...state,
      events: state.events.filter((e) => !ids.has(e.id)),
      comments: state.comments.filter((c) => !c.eventId || !ids.has(c.eventId)),
    },
    () => supabase.from('event').delete().eq('series_id', seriesId),
  )
}

export function updateEvent(id: string, changes: Partial<FamilyEvent>) {
  write(
    { ...state, events: state.events.map((e) => (e.id === id ? { ...e, ...changes } : e)) },
    () => supabase.from('event').update(fromEvent(changes)).eq('id', id),
  )
}

export function removeEvent(id: string) {
  // 댓글은 DB 의 cascade 가 함께 지우므로 화면만 맞춥니다.
  write(
    {
      ...state,
      events: state.events.filter((e) => e.id !== id),
      comments: state.comments.filter((c) => c.eventId !== id),
    },
    () => supabase.from('event').delete().eq('id', id),
  )
}

// ── 할일 / 숙제 ───────────────────────────────────────────────

export function addTask(input: Omit<Task, 'id' | 'familyId'>) {
  const task: Task = { ...input, id: newId(), familyId }
  write({ ...state, tasks: [...state.tasks, task] }, () =>
    supabase.from('task').insert(fromTask(task)),
  )
  return task
}

export function updateTask(id: string, changes: Partial<Task>) {
  write(
    { ...state, tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...changes } : t)) },
    () => supabase.from('task').update(fromTask(changes)).eq('id', id),
  )
}

export function removeTask(id: string) {
  write(
    {
      ...state,
      tasks: state.tasks.filter((t) => t.id !== id),
      comments: state.comments.filter((c) => c.taskId !== id),
    },
    () => supabase.from('task').delete().eq('id', id),
  )
}

/**
 * 부모가 할일/숙제를 확인 처리합니다.
 * 포인트는 '확인'하는 이 순간에만 지급됩니다 (아이가 체크만 했을 때는 안 줌).
 *
 * 같은 숙제로 두 번 지급되는 것은 DB 의 유니크 인덱스가 최종적으로 막습니다
 * (point_entry_task_once). 여기 검사는 헛걸음을 줄이기 위한 것입니다.
 */
export function confirmTask(taskId: string, parentId: string) {
  const task = state.tasks.find((t) => t.id === taskId)
  if (!task || task.status === 'confirmed') return

  const alreadyPaid = state.points.some((p) => p.taskId === taskId)
  const entry: PointEntry | null =
    task.rewardPoints > 0 && task.assigneeId && !alreadyPaid
      ? {
          id: newId(),
          familyId,
          memberId: task.assigneeId,
          points: task.rewardPoints,
          reason: `${task.kind === 'homework' ? '숙제' : '할일'} 완료: ${task.title}`,
          givenBy: parentId,
          createdAt: new Date().toISOString(),
          taskId,
        }
      : null

  write(
    {
      ...state,
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, status: 'confirmed' } : t)),
      points: entry ? [...state.points, entry] : state.points,
    },
    async () => {
      const updated = await supabase
        .from('task')
        .update({ status: 'confirmed' })
        .eq('id', taskId)
      if (updated.error || !entry) return updated

      const inserted = await supabase.from('point_entry').insert(fromPoint(entry))
      // 23505 = 이미 이 숙제로 점수가 나갔다는 뜻. 오류가 아닙니다.
      const code = (inserted.error as { code?: string } | null)?.code
      return code === '23505' ? { error: null } : inserted
    },
  )
}

// ── 포인트 ────────────────────────────────────────────────────

export function addPointEntry(input: {
  memberId: string
  points: number
  reason: string
  givenBy: string
}) {
  const entry: PointEntry = {
    ...input,
    id: newId(),
    familyId,
    createdAt: new Date().toISOString(),
    taskId: null,
  }
  write({ ...state, points: [...state.points, entry] }, () =>
    supabase.from('point_entry').insert(fromPoint(entry)),
  )
  return entry
}

/**
 * 포인트 기록은 지우지 않습니다.
 * 잘못 준 점수는 반대 부호 기록을 추가해서 상쇄합니다 —
 * 나중에 아이와 이야기할 때 무슨 일이 있었는지 남아야 하기 때문입니다.
 */
export function cancelPointEntry(entryId: string, byMemberId: string) {
  const target = state.points.find((p) => p.id === entryId)
  if (!target) return
  addPointEntry({
    memberId: target.memberId,
    points: -target.points,
    reason: `취소: ${target.reason}`,
    givenBy: byMemberId,
  })
}

/** 총점은 저장하지 않고 항상 이력에서 계산합니다. */
export function totalPoints(points: PointEntry[], memberId: string): number {
  return points.reduce((sum, p) => (p.memberId === memberId ? sum + p.points : sum), 0)
}

/**
 * 내 포인트를 가족에게 선물합니다. 기록 두 줄(주는 쪽 −, 받는 쪽 +)이 같은 시각으로 남고,
 * 총점은 항상 이력의 합이므로 두 사람 잔액이 저절로 맞습니다. 가진 것보다 많이는 못 줍니다.
 * 성공하면 null, 안 되면 화면에 보여 줄 문구를 돌려줍니다.
 */
export function giftPoints(input: {
  fromId: string
  toId: string
  points: number
  message: string
}): string | null {
  const points = Math.floor(input.points)
  if (input.fromId === input.toId) return '자기 자신에게는 선물할 수 없어요.'
  if (points <= 0) return '1점 이상이어야 해요.'
  const balance = totalPoints(state.points, input.fromId)
  if (points > balance) return `가진 점수(${balance}점)보다 많이 줄 수 없어요.`
  const from = state.members.find((m) => m.id === input.fromId)
  const to = state.members.find((m) => m.id === input.toId)
  if (!from || !to) return '구성원을 찾을 수 없어요.'

  const now = new Date().toISOString()
  const note = input.message.trim() ? ` "${input.message.trim()}"` : ''
  const given: PointEntry = {
    id: newId(),
    familyId,
    memberId: from.id,
    points: -points,
    reason: `선물 → ${to.name}${note}`,
    givenBy: from.id,
    createdAt: now,
    taskId: null,
  }
  const received: PointEntry = {
    ...given,
    id: newId(),
    memberId: to.id,
    points,
    reason: `선물 ← ${from.name}${note}`,
  }
  write({ ...state, points: [...state.points, given, received] }, () =>
    supabase.from('point_entry').insert([fromPoint(given), fromPoint(received)]),
  )
  return null
}

// ── 보상 ──────────────────────────────────────────────────────

export function addReward(input: Omit<Reward, 'id' | 'familyId'>) {
  const reward: Reward = { ...input, id: newId(), familyId }
  write({ ...state, rewards: [...state.rewards, reward] }, () =>
    supabase.from('reward').insert(fromReward(reward)),
  )
  return reward
}

export function updateReward(id: string, changes: Partial<Reward>) {
  write(
    { ...state, rewards: state.rewards.map((r) => (r.id === id ? { ...r, ...changes } : r)) },
    () => supabase.from('reward').update(fromReward(changes)).eq('id', id),
  )
}

export function removeReward(id: string) {
  write({ ...state, rewards: state.rewards.filter((r) => r.id !== id) }, () =>
    supabase.from('reward').delete().eq('id', id),
  )
}

/** 보상 교환 = 포인트를 쓰는 것이므로 음수 기록이 하나 남습니다. */
export function redeemReward(rewardId: string, memberId: string, byMemberId: string) {
  const reward = state.rewards.find((r) => r.id === rewardId)
  if (!reward) return
  addPointEntry({
    memberId,
    points: -reward.costPoints,
    reason: `보상 교환: ${reward.title}`,
    givenBy: byMemberId,
  })
}

// ── 대화 ──────────────────────────────────────────────────────

export function sendMessage(senderId: string, body: string) {
  const text = body.trim()
  if (!text) return null
  const message: Message = {
    id: newId(),
    familyId,
    senderId,
    body: text.slice(0, 1000),
    createdAt: new Date().toISOString(),
  }
  write({ ...state, messages: [...state.messages, message] }, () =>
    supabase.from('message').insert(fromMessage(message)),
  )
  return message
}

export function removeMessage(id: string) {
  write({ ...state, messages: state.messages.filter((m) => m.id !== id) }, () =>
    supabase.from('message').delete().eq('id', id),
  )
}

/**
 * 대화방을 보고 있는 사람이 '여기까지 읽었다'고 서버에 남깁니다.
 * 다른 가족 화면에는 그 자리에 이 사람 얼굴이 붙습니다.
 * 뒤로 가는 시각은 무시합니다 (옛 기기가 늦게 보내는 경우).
 */
export function markChatRead(memberId: string, lastReadAt: string) {
  if (!readsReady) return
  const at = new Date(lastReadAt).getTime()
  const current = state.chatReads.find((r) => r.memberId === memberId)
  if (!Number.isFinite(at) || (current && new Date(current.lastReadAt).getTime() >= at)) return

  write(
    {
      ...state,
      chatReads: [
        ...state.chatReads.filter((r) => r.memberId !== memberId),
        { memberId, lastReadAt },
      ],
    },
    () =>
      supabase
        .from('chat_read')
        .upsert(
          { family_id: familyId, member_id: memberId, last_read_at: lastReadAt },
          { onConflict: 'member_id' },
        ),
  )
}

// ── 댓글 ──────────────────────────────────────────────────────

export function addComment(input: {
  eventId?: string
  taskId?: string
  authorId: string
  body: string
}) {
  const text = input.body.trim()
  if (!text) return null
  const comment: Comment = {
    id: newId(),
    familyId,
    eventId: input.eventId ?? null,
    taskId: input.taskId ?? null,
    authorId: input.authorId,
    body: text.slice(0, 1000),
    createdAt: new Date().toISOString(),
  }
  write({ ...state, comments: [...state.comments, comment] }, () =>
    supabase.from('comment').insert(fromComment(comment)),
  )
  return comment
}

export function removeComment(id: string) {
  write({ ...state, comments: state.comments.filter((c) => c.id !== id) }, () =>
    supabase.from('comment').delete().eq('id', id),
  )
}

// ── 안드로이드 위젯 토큰 ──────────────────────────────────────
// 위젯은 웹 세션을 볼 수 없어서, 대신 쓸 긴 임의 문자열을 하나 만들어 폰에 건네줍니다.

export async function createWidgetToken(memberId: string): Promise<{ token: string } | { error: string }> {
  const token = (newId() + newId()).replace(/-/g, '')
  const { error } = await supabase
    .from('widget_token')
    .insert({ token, family_id: familyId, member_id: memberId })
  return error ? { error: describe(error) } : { token }
}

// ── 푸시 알림 구독 ────────────────────────────────────────────
// 화면에 그리는 데이터가 아니라 메모리 상태에는 두지 않고 서버에만 씁니다.

export interface PushKeys {
  endpoint: string
  p256dh: string
  auth: string
}

/** 이 기기의 구독을 저장합니다. 같은 기기면 덮어씁니다. 실패하면 원인 문구를 돌려줍니다. */
export async function savePushSubscription(
  memberId: string,
  keys: PushKeys,
): Promise<string | null> {
  const { error } = await supabase.from('push_subscription').upsert(
    {
      family_id: familyId,
      member_id: memberId,
      endpoint: keys.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: 'endpoint' },
  )
  return error ? describe(error) : null
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await supabase.from('push_subscription').delete().eq('endpoint', endpoint)
}

// ── 백업 ──────────────────────────────────────────────────────
// 이제 내용은 Supabase 에 있지만, 통째로 받아 둘 수 있는 길은 남겨 둡니다.

export function exportJson(): string {
  return JSON.stringify(state, null, 2)
}

/** 백업 파일로 지금 가족 내용을 통째로 덮어씁니다. 되돌릴 수 없습니다. */
export async function importJson(json: string): Promise<void> {
  const parsed = JSON.parse(json) as DbShape
  if (!parsed.family || !Array.isArray(parsed.members)) {
    throw new Error('백업 파일 형식이 올바르지 않습니다.')
  }

  // 구성원을 지우면 딸린 것들도 cascade 로 함께 사라집니다.
  const cleared = await supabase.from('member').delete().eq('family_id', familyId)
  if (cleared.error) throw cleared.error
  await supabase.from('event').delete().eq('family_id', familyId)
  await supabase.from('reward').delete().eq('family_id', familyId)

  // 백업의 id 를 그대로 살려야 서로를 가리키는 연결이 유지됩니다.
  const withFamily = <T extends { id: string }>(rows: T[]) =>
    rows.map((r) => ({ ...r, familyId }))

  await supabase.from('member').insert(withFamily(parsed.members).map(fromMember))
  await supabase.from('event').insert(withFamily(parsed.events ?? []).map(fromEvent))
  await supabase.from('task').insert(withFamily(parsed.tasks ?? []).map(fromTask))
  await supabase.from('point_entry').insert(withFamily(parsed.points ?? []).map(fromPoint))
  await supabase.from('reward').insert(withFamily(parsed.rewards ?? []).map(fromReward))
  if (parsed.messages?.length) {
    await supabase.from('message').insert(withFamily(parsed.messages).map(fromMessage))
  }
  if (parsed.comments?.length) {
    await supabase.from('comment').insert(withFamily(parsed.comments).map(fromComment))
  }

  await supabase.from('family').update({ name: parsed.family.name }).eq('id', familyId)
  await reload()
}

/** 처음 상태로 되돌립니다. 호출 전에 반드시 확인을 받으세요. */
export async function resetToSeed(): Promise<void> {
  await supabase.from('member').delete().eq('family_id', familyId)
  await supabase.from('event').delete().eq('family_id', familyId)
  await supabase.from('task').delete().eq('family_id', familyId)
  await supabase.from('reward').delete().eq('family_id', familyId)

  await supabase
    .from('member')
    .insert(starterMembers().map((m) => fromMember({ ...m, familyId })))
  await supabase
    .from('reward')
    .insert(starterRewards().map((r) => fromReward({ ...r, familyId })))
  await reload()
}
