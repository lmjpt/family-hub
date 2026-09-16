// ─────────────────────────────────────────────────────────────
// 데이터 계층. 앱의 나머지 부분은 여기를 통해서만 데이터를 읽고 씁니다.
//
// 지금은 localStorage 에 저장합니다. 계정도 키도 필요 없어서 바로 쓸 수 있지만,
// 기기 간 공유는 안 됩니다(브라우저마다 따로 저장됨).
// 나중에 Supabase 를 붙일 때는 이 파일의 함수 본문만 바꾸면 되고,
// 화면 코드는 건드릴 필요가 없습니다.
// ─────────────────────────────────────────────────────────────

import { useSyncExternalStore } from 'react'
import type {
  Family,
  FamilyEvent,
  Member,
  PointEntry,
  Reward,
  Task,
} from '../types'
import { seedData } from './seed'

const STORAGE_KEY = 'family-hub-v1'

export interface DbShape {
  family: Family
  members: Member[]
  events: FamilyEvent[]
  tasks: Task[]
  points: PointEntry[]
  rewards: Reward[]
}

export function newId(): string {
  return crypto.randomUUID()
}

function read(): DbShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as DbShape
  } catch {
    // 저장된 데이터가 깨졌으면 조용히 초기 데이터로 시작합니다.
  }

  // 처음 켰을 때. 예시 데이터를 만들고 '바로' 저장해야 합니다.
  // 저장을 미루면 새로고침할 때마다 구성원 id 가 새로 만들어지고,
  // 로그인 세션이 가리키던 사람이 사라져서 로그인 화면으로 튕깁니다.
  const seeded = seedData()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
  } catch {
    // 저장 공간이 없어도 이번 세션 동안은 그냥 쓰게 둡니다.
  }
  return seeded
}

let state: DbShape = read()
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

function commit(next: DbShape) {
  state = next
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  notify()
}

/** 부분 업데이트 헬퍼 */
function patch(changes: Partial<DbShape>) {
  commit({ ...state, ...changes })
}

export function getState(): DbShape {
  return state
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// 다른 탭에서 바뀌면 이 탭에도 반영합니다. (같은 PC 안에서의 '실시간')
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      state = read()
      notify()
    }
  })
}

/** 전체 데이터를 구독합니다. 바뀌면 컴포넌트가 다시 그려집니다. */
export function useDb(): DbShape {
  return useSyncExternalStore(subscribe, getState, getState)
}

// ── 구성원 ────────────────────────────────────────────────────

export function addMember(input: Omit<Member, 'id' | 'familyId'>): Member {
  const member: Member = { ...input, id: newId(), familyId: state.family.id }
  patch({ members: [...state.members, member] })
  return member
}

export function updateMember(id: string, changes: Partial<Member>) {
  patch({
    members: state.members.map((m) => (m.id === id ? { ...m, ...changes } : m)),
  })
}

/** 구성원을 지우면 그 사람에게 달려 있던 것들도 함께 정리합니다. */
export function removeMember(id: string) {
  commit({
    ...state,
    members: state.members.filter((m) => m.id !== id),
    events: state.events.filter((e) => e.ownerId !== id),
    tasks: state.tasks.filter((t) => t.assigneeId !== id),
    points: state.points.filter((p) => p.memberId !== id),
  })
}

export function renameFamily(name: string) {
  patch({ family: { ...state.family, name } })
}

// ── 일정 ──────────────────────────────────────────────────────

export function addEvent(input: Omit<FamilyEvent, 'id' | 'familyId'>) {
  const event: FamilyEvent = { ...input, id: newId(), familyId: state.family.id }
  patch({ events: [...state.events, event] })
  return event
}

export function updateEvent(id: string, changes: Partial<FamilyEvent>) {
  patch({
    events: state.events.map((e) => (e.id === id ? { ...e, ...changes } : e)),
  })
}

export function removeEvent(id: string) {
  patch({ events: state.events.filter((e) => e.id !== id) })
}

// ── 할일 / 숙제 ───────────────────────────────────────────────

export function addTask(input: Omit<Task, 'id' | 'familyId'>) {
  const task: Task = { ...input, id: newId(), familyId: state.family.id }
  patch({ tasks: [...state.tasks, task] })
  return task
}

export function updateTask(id: string, changes: Partial<Task>) {
  patch({
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...changes } : t)),
  })
}

export function removeTask(id: string) {
  patch({ tasks: state.tasks.filter((t) => t.id !== id) })
}

/**
 * 부모가 할일/숙제를 확인 처리합니다.
 * 포인트는 '확인'하는 이 순간에만 지급됩니다 (아이가 체크만 했을 때는 안 줌).
 * 두 번 확인해도 포인트가 두 번 들어가지 않도록 같은 taskId 기록이 있으면 건너뜁니다.
 */
export function confirmTask(taskId: string, parentId: string) {
  const task = state.tasks.find((t) => t.id === taskId)
  if (!task || task.status === 'confirmed') return

  const already = state.points.some((p) => p.taskId === taskId)
  const entry: PointEntry | null =
    task.rewardPoints > 0 && !already
      ? {
          id: newId(),
          familyId: state.family.id,
          memberId: task.assigneeId ?? '',
          points: task.rewardPoints,
          reason: `${task.kind === 'homework' ? '숙제' : '할일'} 완료: ${task.title}`,
          givenBy: parentId,
          createdAt: new Date().toISOString(),
          taskId,
        }
      : null

  commit({
    ...state,
    tasks: state.tasks.map((t) =>
      t.id === taskId ? { ...t, status: 'confirmed' } : t,
    ),
    points:
      entry && entry.memberId ? [...state.points, entry] : state.points,
  })
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
    familyId: state.family.id,
    createdAt: new Date().toISOString(),
    taskId: null,
  }
  patch({ points: [...state.points, entry] })
  return entry
}

/**
 * 포인트 기록은 지우지 않습니다 (CLAUDE.md 규칙).
 * 잘못 준 점수는 반대 부호 기록을 추가해서 상쇄합니다.
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

// ── 보상 ──────────────────────────────────────────────────────

export function addReward(input: Omit<Reward, 'id' | 'familyId'>) {
  const reward: Reward = { ...input, id: newId(), familyId: state.family.id }
  patch({ rewards: [...state.rewards, reward] })
  return reward
}

export function updateReward(id: string, changes: Partial<Reward>) {
  patch({
    rewards: state.rewards.map((r) => (r.id === id ? { ...r, ...changes } : r)),
  })
}

export function removeReward(id: string) {
  patch({ rewards: state.rewards.filter((r) => r.id !== id) })
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

// ── 백업 / 복원 ───────────────────────────────────────────────
// localStorage 는 브라우저 데이터를 지우면 같이 날아갑니다.
// 그래서 통째로 내보내고 되돌릴 수 있는 길을 열어 둡니다.

export function exportJson(): string {
  return JSON.stringify(state, null, 2)
}

export function importJson(json: string) {
  const parsed = JSON.parse(json) as DbShape
  if (!parsed.family || !Array.isArray(parsed.members)) {
    throw new Error('백업 파일 형식이 올바르지 않습니다.')
  }
  commit(parsed)
}

/** 처음 상태로 되돌립니다. 되돌릴 수 없으니 호출 전에 반드시 확인을 받으세요. */
export function resetToSeed() {
  commit(seedData())
}
