import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useVisualViewport } from '../lib/useVisualViewport'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** 아래쪽 버튼 줄 */
  footer?: ReactNode
}

/**
 * 폰에서는 아래에서 올라오는 시트, 넓은 화면에서는 가운데 카드.
 * 폰으로 쓸 일이 많아서 손이 닿는 아래쪽에 버튼을 둡니다.
 *
 * body 에 직접 그립니다(portal). 목록 안 어디에서 열어도 아래 탭 바 위에 확실히
 * 올라오게 하려는 것입니다. 크기는 '실제로 보이는 영역'에 맞춰서, 키보드가 올라오면
 * 시트도 그만큼 줄어들어 입력 칸이 키보드 위에 남습니다.
 */
export default function Modal({ open, title, onClose, children, footer }: Props) {
  const viewport = useVisualViewport()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-x-0 top-0 z-50 flex h-dvh items-end justify-center sm:items-center"
      style={viewport ? { top: viewport.top, height: viewport.height } : undefined}
    >
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-ink/30"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card relative flex max-h-[min(90dvh,100%)] w-full flex-col rounded-b-none sm:max-w-lg sm:rounded-b-[1.25rem]"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-lg px-3 py-1 text-2xl leading-none text-muted hover:bg-cream"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="flex gap-2 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
