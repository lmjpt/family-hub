import { WEEKDAYS, addDays, todayKey, weekdayIndex } from '../lib/date'

interface Props {
  id?: string
  /** datetime-local 값 ('YYYY-MM-DDTHH:mm') */
  value: string
  onChange: (value: string) => void
  className?: string
}

/**
 * 날짜·시각 입력 칸. 고른 날짜의 요일을 바로 아래에 보여 줍니다.
 * 요일로 기억하는 사람이 달력을 따로 찾아보지 않아도 되게 하려는 것입니다.
 */
export default function DateTimeField({ id, value, onChange, className }: Props) {
  const hint = weekdayHint(value)
  return (
    <div className={className}>
      <input
        id={id}
        type="datetime-local"
        className="field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <p className="mt-1.5 text-sm font-semibold text-muted" aria-live="polite">
          {hint}
        </p>
      )}
    </div>
  )
}

/** '목요일', '목요일 · 오늘', '금요일 · 내일'. 날짜가 덜 입력됐으면 빈 문자열. */
function weekdayHint(value: string): string {
  const key = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return ''
  const weekday = `${WEEKDAYS[weekdayIndex(key)]}요일`
  const today = todayKey()
  if (key === today) return `${weekday} · 오늘`
  if (key === addDays(today, 1)) return `${weekday} · 내일`
  return weekday
}
