// 날짜는 전부 여기를 거칩니다.
// 저장은 UTC ISO 문자열, 표시는 항상 한국 시간(Asia/Seoul).
// 브라우저가 어느 시간대에 있든 결과가 같아야 하므로 로컬 시간대에 의존하지 않습니다.

const TZ = 'Asia/Seoul'

/** 'sv-SE' 로케일은 YYYY-MM-DD 형태를 주기 때문에 날짜 키로 쓰기 좋습니다. */
const dayKeyFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const timeFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const parts = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export type DayKey = string // 'YYYY-MM-DD'

/** ISO 문자열 또는 Date 를 한국 날짜 키로. */
export function dayKey(value: string | Date): DayKey {
  return dayKeyFmt.format(typeof value === 'string' ? new Date(value) : value)
}

/** 오늘(한국 기준) 날짜 키. */
export function todayKey(): DayKey {
  return dayKey(new Date())
}

/** '14:30' */
export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso))
}

/** '9월 16일 (화)' */
export function formatDayLabel(key: DayKey): string {
  const [, m, d] = key.split('-').map(Number)
  return `${m}월 ${d}일 (${WEEKDAYS[weekdayIndex(key)]})`
}

/** '2026년 9월' */
export function formatMonthLabel(year: number, month: number): string {
  return `${year}년 ${month}월`
}

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 날짜 키의 요일 인덱스(0=일). 정오 UTC 로 만들어 시간대 경계 문제를 피합니다. */
export function weekdayIndex(key: DayKey): number {
  return new Date(`${key}T12:00:00Z`).getUTCDay()
}

/**
 * <input type="datetime-local"> 값('YYYY-MM-DDTHH:mm')을 한국 시간으로 해석해
 * UTC ISO 문자열로 바꿉니다. 브라우저 시간대에 관계없이 같은 결과가 나옵니다.
 */
export function seoulInputToIso(input: string): string {
  return new Date(`${input}:00+09:00`).toISOString()
}

/** 위의 반대. ISO 를 datetime-local 입력값으로. */
export function isoToSeoulInput(iso: string): string {
  const p = Object.fromEntries(
    parts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  )
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/** 날짜 키 + 'HH:mm' 을 UTC ISO 로. */
export function dayKeyToIso(key: DayKey, time = '09:00'): string {
  return seoulInputToIso(`${key}T${time}`)
}

/** 날짜 키에 일수를 더합니다. */
export function addDays(key: DayKey, days: number): DayKey {
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 달력 그리드용. 해당 월이 포함된 주 전체(일요일 시작)를 6주 42칸으로 반환. */
export function monthGrid(year: number, month: number): DayKey[] {
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const start = addDays(first, -weekdayIndex(first))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function monthOf(key: DayKey): number {
  return Number(key.slice(5, 7))
}

/** {year, month} 에서 n개월 이동 */
export function shiftMonth(year: number, month: number, delta: number) {
  const idx = year * 12 + (month - 1) + delta
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
}

/** 마감일까지 남은 느낌을 한국어로: '오늘', '내일', '3일 지남' 등 */
export function dueLabel(iso: string | null): string {
  if (!iso) return '기한 없음'
  const target = dayKey(iso)
  const today = todayKey()
  if (target === today) return '오늘'
  if (target === addDays(today, 1)) return '내일'
  if (target === addDays(today, -1)) return '어제'
  const diff = Math.round(
    (new Date(`${target}T12:00:00Z`).getTime() -
      new Date(`${today}T12:00:00Z`).getTime()) /
      86_400_000,
  )
  return diff > 0 ? `${diff}일 남음` : `${-diff}일 지남`
}

/** 마감이 지났는지 (날짜 기준) */
export function isOverdue(iso: string | null): boolean {
  return iso !== null && dayKey(iso) < todayKey()
}

/** '9월 16일 14:30' 같은 짧은 표기 */
export function formatShort(iso: string): string {
  const key = dayKey(iso)
  const [, m, d] = key.split('-').map(Number)
  return `${m}월 ${d}일 ${formatTime(iso)}`
}
