// 누가 무엇을 할 수 있는지 한 곳에 모아 둡니다.
// 버튼을 숨길 때도, 실제로 바꾸기 직전에도 같은 함수를 씁니다.
//
// 주의: 지금은 브라우저 안에서만 검사합니다. 백엔드를 붙이면
// 여기와 똑같은 규칙을 Supabase RLS 로 다시 한 번 강제해야 합니다.
// 화면에서 버튼을 숨기는 것은 보안이 아닙니다.

import type { FamilyEvent, Member, Task } from '../types'

export function isParent(me: Member | null): boolean {
  return me?.role === 'parent'
}

export function canEditEvent(me: Member | null, event: FamilyEvent): boolean {
  if (!me) return false
  if (isParent(me)) return true
  return event.ownerId === me.id
}

/** 아이도 자기 일정은 만들 수 있습니다. 가족 전체 일정은 부모만. */
export function canCreateEvent(me: Member | null): boolean {
  return me !== null
}

export function canCreateFamilyEvent(me: Member | null): boolean {
  return isParent(me)
}

/** 할일과 숙제는 부모만 만듭니다. */
export function canCreateTask(me: Member | null): boolean {
  return isParent(me)
}

/** 완료 체크는 부모, 또는 자기 담당인 아이. */
export function canToggleTask(me: Member | null, task: Task): boolean {
  if (!me) return false
  return isParent(me) || task.assigneeId === me.id
}

/** 확인 처리(=포인트 지급)는 부모만. */
export function canConfirmTask(me: Member | null): boolean {
  return isParent(me)
}

export function canGivePoints(me: Member | null): boolean {
  return isParent(me)
}

/** 아이는 자기 포인트 이력만 봅니다. */
export function canSeePointsOf(me: Member | null, memberId: string): boolean {
  if (!me) return false
  return isParent(me) || me.id === memberId
}

export function canManageMembers(me: Member | null): boolean {
  return isParent(me)
}

export function canManageRewards(me: Member | null): boolean {
  return isParent(me)
}
