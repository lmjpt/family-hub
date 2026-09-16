// 처음 켰을 때 화면이 텅 비어 있으면 뭘 하는 앱인지 알기 어렵습니다.
// 그래서 예시 가족과 예시 데이터를 넣어 둡니다.
// 설정 화면의 '샘플 데이터로 되돌리기'로 언제든 이 상태로 돌아올 수 있습니다.
//
// 여기 있는 이름은 전부 예시입니다. 설정에서 실제 가족 이름으로 바꿔 쓰세요.

import type { DbShape } from './db'
import { addDays, dayKeyToIso, todayKey } from './date'

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

export function seedData(): DbShape {
  const familyId = crypto.randomUUID()
  const today = todayKey()

  const mom = {
    id: crypto.randomUUID(),
    familyId,
    name: '엄마',
    role: 'parent' as const,
    color: MEMBER_COLORS[0],
    birthDate: null,
    avatarEmoji: '🐻',
    pin: '0000',
  }
  const dad = {
    id: crypto.randomUUID(),
    familyId,
    name: '아빠',
    role: 'parent' as const,
    color: MEMBER_COLORS[2],
    birthDate: null,
    avatarEmoji: '🐼',
    pin: '0000',
  }
  const kid1 = {
    id: crypto.randomUUID(),
    familyId,
    name: '첫째',
    role: 'child' as const,
    color: MEMBER_COLORS[1],
    birthDate: null,
    avatarEmoji: '🐰',
    pin: '',
  }
  const kid2 = {
    id: crypto.randomUUID(),
    familyId,
    name: '둘째',
    role: 'child' as const,
    color: MEMBER_COLORS[3],
    birthDate: null,
    avatarEmoji: '🐣',
    pin: '',
  }

  return {
    family: { id: familyId, name: '우리집' },
    members: [mom, dad, kid1, kid2],
    events: [
      {
        id: crypto.randomUUID(),
        familyId,
        title: '가족 외식',
        startsAt: dayKeyToIso(addDays(today, 2), '18:30'),
        endsAt: dayKeyToIso(addDays(today, 2), '20:00'),
        allDay: false,
        ownerId: null,
        memo: '',
      },
      {
        id: crypto.randomUUID(),
        familyId,
        title: '첫째 학교 상담',
        startsAt: dayKeyToIso(addDays(today, 4), '15:00'),
        endsAt: dayKeyToIso(addDays(today, 4), '16:00'),
        allDay: false,
        ownerId: kid1.id,
        memo: '담임 선생님과 면담',
      },
    ],
    tasks: [
      {
        id: crypto.randomUUID(),
        familyId,
        title: '빨래 개기',
        kind: 'chore',
        assigneeId: kid1.id,
        dueAt: dayKeyToIso(today, '20:00'),
        status: 'todo',
        subject: null,
        rewardPoints: 3,
      },
      {
        id: crypto.randomUUID(),
        familyId,
        title: '분리수거 내놓기',
        kind: 'chore',
        assigneeId: kid2.id,
        dueAt: dayKeyToIso(today, '19:00'),
        status: 'todo',
        subject: null,
        rewardPoints: 2,
      },
      {
        id: crypto.randomUUID(),
        familyId,
        title: '수학 익힘책 24~25쪽',
        kind: 'homework',
        assigneeId: kid1.id,
        dueAt: dayKeyToIso(today, '21:00'),
        status: 'done',
        subject: '수학',
        rewardPoints: 5,
      },
      {
        id: crypto.randomUUID(),
        familyId,
        title: '받아쓰기 연습',
        kind: 'homework',
        assigneeId: kid2.id,
        dueAt: dayKeyToIso(addDays(today, 1), '21:00'),
        status: 'todo',
        subject: '국어',
        rewardPoints: 5,
      },
    ],
    points: [
      {
        id: crypto.randomUUID(),
        familyId,
        memberId: kid1.id,
        points: 5,
        reason: '동생이랑 사이좋게 놀았어요',
        givenBy: mom.id,
        createdAt: dayKeyToIso(addDays(today, -1), '19:00'),
        taskId: null,
      },
      {
        id: crypto.randomUUID(),
        familyId,
        memberId: kid2.id,
        points: 3,
        reason: '스스로 일어났어요',
        givenBy: dad.id,
        createdAt: dayKeyToIso(addDays(today, -1), '08:00'),
        taskId: null,
      },
    ],
    rewards: [
      { id: crypto.randomUUID(), familyId, title: '게임 30분', costPoints: 20, active: true },
      { id: crypto.randomUUID(), familyId, title: '아이스크림', costPoints: 15, active: true },
      { id: crypto.randomUUID(), familyId, title: '주말 영화 고르기', costPoints: 40, active: true },
    ],
  }
}
