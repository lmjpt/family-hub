// 앱 전체에서 쓰는 도메인 타입.
// DB 컬럼은 snake_case, 앱 안에서는 camelCase 를 씁니다.
// 변환은 src/lib/db.ts (데이터 계층) 한 곳에서만 일어나야 합니다.

export type Role = 'parent' | 'child'

/** 'chore' = 집안일/할일, 'homework' = 숙제. 같은 테이블을 kind 로 구분합니다. */
export type TaskKind = 'chore' | 'homework'

/**
 * todo      아직 안 함
 * done      아이가 다 했다고 체크함 (아직 포인트 없음)
 * confirmed 부모가 확인함 -> 이 시점에 포인트가 지급됩니다
 */
export type TaskStatus = 'todo' | 'done' | 'confirmed'

export interface Family {
  id: string
  name: string
}

export interface Member {
  id: string
  familyId: string
  name: string
  role: Role
  /** Tailwind 색 이름이 아니라 실제 hex. 캘린더 점, 아바타 테두리에 씁니다. */
  color: string
  birthDate: string | null
  avatarEmoji: string
  /** 빈 문자열이면 PIN 없이 바로 로그인. 아이들은 보통 비워 둡니다. */
  pin: string
}

export interface FamilyEvent {
  id: string
  familyId: string
  title: string
  /** ISO 8601 (UTC). 화면에 보일 때만 Asia/Seoul 로 변환합니다. */
  startsAt: string
  endsAt: string
  allDay: boolean
  /** null 이면 가족 전체 일정 */
  ownerId: string | null
  memo: string
}

export interface Task {
  id: string
  familyId: string
  title: string
  kind: TaskKind
  assigneeId: string | null
  dueAt: string | null
  status: TaskStatus
  /** 숙제 과목. kind 가 'chore' 면 null */
  subject: string | null
  /** 부모가 확인(confirmed)했을 때 줄 칭찬 점수 */
  rewardPoints: number
}

export interface PointEntry {
  id: string
  familyId: string
  memberId: string
  /** 양수 = 칭찬, 음수 = 벌점 또는 보상 교환 */
  points: number
  reason: string
  /** 준 사람 (부모) */
  givenBy: string
  createdAt: string
  /** 숙제/할일 확인으로 자동 지급된 경우 해당 task id */
  taskId: string | null
}

export interface Reward {
  id: string
  familyId: string
  title: string
  costPoints: number
  active: boolean
}

/** 일정 또는 할일(숙제) 한 항목에 달린 댓글. 둘 중 하나만 채워집니다. */
export interface Comment {
  id: string
  familyId: string
  eventId: string | null
  taskId: string | null
  authorId: string
  body: string
  createdAt: string
}

/** 대화방에서 이 사람이 마지막으로 읽은 시각. 구성원마다 하나. */
export interface ChatRead {
  memberId: string
  lastReadAt: string
}

/** 가족 대화방 메시지. 방은 가족당 하나뿐입니다. */
export interface Message {
  id: string
  familyId: string
  senderId: string
  body: string
  createdAt: string
}
