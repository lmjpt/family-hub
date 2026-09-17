import { WEEKDAYS, addDays, todayKey, weekdayIndex } from '../lib/date'

interface Props {
  id?: string
  /** datetime-local 값 ('YYYY-MM-DDTHH:mm') */
  value: string
  onChange: (value: string) => void
  className?: string
}

/**
 * 날짜·시각 입력 칸. 고른 날짜의 요일을 칸 오른쪽에 크게 붙여 보여 줍니다.
 * 요일로 기억하는 사람이 달력을 따로 찾아보지 않아도 되게 하려는 것입니다.
 * 브라우저의 기본 날짜 선택기는 요일을 보여 주지 않아서 직접 붙입니다.
 */
export default function DateTimeField({ id, value, onChange, className }: Props) {
  const hint = weekdayHint(value)
  return (
    <div className={className}>
      <div className="flex items-stretch overflow-hidden rounded-xl border border-line bg-paper focus-within:border-brand">
        <input
          id={id}
          type="datetime-local"
          className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {hint && (
          <div
            className="flex w-14 shrink-0 flex-col items-center justify-center border-l border-line bg-brand-soft text-ink"
            aria-live="polite"
          >
            <span className="text-xl font-bold leading-none">{hint.day}</span>
            <span className="mt-0.5 text-[11px] font-semibold text-muted">{hint.sub}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/** '목' + '요일', 오늘·내일이면 '목' + '오늘'. 날짜가 덜 입력됐으면 null. */
function weekdayHint(value: string): { day: string; sub: string } | null {
  const key = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null
  const day = WEEKDAYS[weekdayIndex(key)]
  const today = todayKey()
  if (key === today) return { day, sub: '오늘' }
  if (key === addDays(today, 1)) return { day, sub: '내일' }
  return { day, sub: '요일' }
}
