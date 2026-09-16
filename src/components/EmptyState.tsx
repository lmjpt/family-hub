interface Props {
  emoji: string
  title: string
  hint?: string
}

/** 비어 있는 화면이 고장 난 것처럼 보이지 않도록. */
export default function EmptyState({ emoji, title, hint }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <span className="text-5xl" aria-hidden="true">
        {emoji}
      </span>
      <p className="text-base font-semibold text-ink">{title}</p>
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  )
}
