// 가족이 처음 로그인했을 때 넣어 주는 기본 내용.
//
// 화면이 텅 비어 있으면 뭘 하는 앱인지 알기 어려워서 구성원과 보상만
// 미리 만들어 둡니다. 일정·할일·숙제는 넣지 않습니다 — 실제로 쓸 가족에게는
// 예시 데이터가 지워야 할 쓰레기일 뿐입니다.
//
// 여기 이름은 전부 예시입니다. 설정에서 실제 가족 이름으로 바꿔 쓰세요.

import type { Member, Reward } from '../types'

/** 구성원 색. 캘린더 점과 아바타 테두리에 쓰입니다. */
export const MEMBER_COLORS = [
  '#e8795a', // 주황
  '#4a9d7f', // 초록
  '#5b8fc9', // 파랑
  '#c9739f', // 분홍
  '#b8893f', // 황토
  '#7b73c9', // 보라
] as const

export const MEMBER_EMOJIS = [
  '🐻', '🐰', '🐣', '🐼', '🦊', '🐨', '🐯', '🐸', '🐧', '🦉', '🐿️', '🐳',
] as const

type NewMember = Omit<Member, 'id' | 'familyId'>
type NewReward = Omit<Reward, 'id' | 'familyId'>

/** 새 가족에게 만들어 줄 구성원. 부모는 PIN 0000 으로 시작합니다. */
export function starterMembers(): NewMember[] {
  return [
    { name: '엄마', role: 'parent', color: MEMBER_COLORS[0], birthDate: null, avatarEmoji: '🐻', pin: '0000' },
    { name: '아빠', role: 'parent', color: MEMBER_COLORS[2], birthDate: null, avatarEmoji: '🐼', pin: '0000' },
    { name: '첫째', role: 'child', color: MEMBER_COLORS[1], birthDate: null, avatarEmoji: '🐰', pin: '' },
    { name: '둘째', role: 'child', color: MEMBER_COLORS[3], birthDate: null, avatarEmoji: '🐣', pin: '' },
  ]
}

export function starterRewards(): NewReward[] {
  return [
    { title: '게임 30분', costPoints: 20, active: true },
    { title: '아이스크림', costPoints: 15, active: true },
    { title: '주말 영화 고르기', costPoints: 40, active: true },
  ]
}
