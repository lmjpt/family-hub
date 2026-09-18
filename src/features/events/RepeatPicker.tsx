import DateTimeField from '../../components/DateTimeField'
import { WEEKDAYS, addDays, seoulInputToIso, weekdayIndex } from '../../lib/date'
import type { DayKey } from '../../lib/date'

/** 반복 설정. 규칙은 '매주 + 요일들 + 언제까지' 하나뿐입니다. 학원 스케줄에는 이걸로 충분합니다. */
export interface Repeat {
  enabled: boolean
  /** 0=일 … 6=토 */
  weekdays: Set<number>
  /** 'YYYY-MM-DD' 이 날까지 (포함) */
  until: DayKey
}

/** 새 일정의 기본 반복값: 꺼짐, 시작 요일만 선택, 3개월 뒤까지 */
export function defaultRepeat(startKey: DayKey): Repeat {
  return { enabled: false, weekdays: new Set([weekdayIndex(startKey)]), until: addDays(startKey, 90) }
}

/** 최대 몇 개까지 만들지. 매주 7일 × 1년이 대략 이 정도입니다. */
export const MAX_OCCURRENCES = 370

/**
 * datetime-local 입력값(start, end)과 반복 설정으로 실제 날짜들을 만듭니다.
 * 시각은 그대로 두고 날짜만 옮깁니다. 여러 날짜리 일정이면 길이도 그대로 유지합니다.
 */
export function buildOccurrences(
  start: string,
  end: string,
  repeat: Repeat,
): { startsAt: string; endsAt: string }[] {
  const startKey = start.slice(0, 10)
  const startTime = start.slice(11, 16)
  const endKey = end.slice(0, 10)
  const endTime = end.slice(11, 16)
  const spanDays = Math.round(
    (new Date(`${endKey}T12:00:00Z`).getTime() - new Date(`${startKey}T12:00:00Z`).getTime()) /
      86_400_000,
  )

  const out: { startsAt: string; endsAt: string }[] = []
  let key = startKey
  for (let i = 0; i < 400 && key <= repeat.until && out.length < MAX_OCCURRENCES; i += 1) {
    if (repeat.weekdays.has(weekdayIndex(key))) {
      out.push({
        startsAt: seoulInputToIso(`${key}T${startTime}`),
        endsAt: seoulInputToIso(`${addDays(key, Math.max(0, spanDays))}T${endTime}`),
      })
    }
    key = addDays(key, 1)
  }
  return out
}

interface Props {
  repeat: Repeat
  onChange: (next: Repeat) => void
  /** 미리 보여 줄 개수 */
  count: number
}

export default function RepeatPicker({ repeat, onChange, count }: Props) {
  function toggleDay(d: number) {
    const next = new Set(repeat.weekdays)
    if (next.has(d)) next.delete(d)
    else next.add(d)
    onChange({ ...repeat, weekdays: next })
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={repeat.enabled}
          onChange={(e) => onChange({ ...repeat, enabled: e.target.checked })}
          className="h-5 w-5 accent-[#e8795a]"
        />
        <span className="font-semibold">매주 반복</span>
        <span className="text-sm text-muted">피아노 월·수·금 같은 것</span>
      </label>

      {repeat.enabled && (
        <div className="space-y-3 rounded-xl bg-cream px-4 py-3">
          <div>
            <span className="label">어느 요일?</span>
            <div className="flex gap-1.5">
              {WEEKDAYS.map((w, d) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => toggleDay(d)}
                  aria-pressed={repeat.weekdays.has(d)}
                  className={`h-10 flex-1 rounded-xl border text-sm font-bold ${
                    repeat.weekdays.has(d)
                      ? 'border-brand bg-brand text-white'
                      : 'border-line bg-paper text-muted'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="repeat-until">
              언제까지?
            </label>
            {/* 시각은 의미가 없어 날짜만 쓰지만, 요일 배지를 같이 보여 주려고 같은 입력 칸을 씁니다. */}
            <DateTimeField
              id="repeat-until"
              value={`${repeat.until}T23:59`}
              onChange={(v) => v.length >= 10 && onChange({ ...repeat, until: v.slice(0, 10) })}
            />
          </div>

          <p className="text-sm font-semibold text-muted">
            {count === 0
              ? '요일을 하나 이상 골라 주세요.'
              : count >= MAX_OCCURRENCES
                ? `너무 많아요. 최대 ${MAX_OCCURRENCES}개까지만 만듭니다.`
                : `일정 ${count}개가 만들어집니다. 하루씩 따로 고치거나 지울 수 있어요.`}
          </p>
        </div>
      )}
    </div>
  )
}
