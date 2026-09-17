import { useState } from 'react'
import { keyboardOpen, useVisualViewport } from '../../lib/useVisualViewport'

/** 글자를 못 치는 아이도 한 번에 보낼 수 있는 빠른 답. 누르면 바로 보내집니다. */
const QUICK = ['👍', '❤️', '😊', '🙏', '😂', '🆗'] as const

const MAX_LENGTH = 1000

interface Props {
  onSend: (body: string) => void
}

/**
 * 메시지 입력 칸. 아래 탭 바로 위에 고정됩니다.
 * 탭 높이(약 3.9rem)와 폰 하단 안전 영역만큼 띄웁니다.
 * 키보드가 올라오면 탭 바는 키보드 뒤로 숨으므로, 그때는 키보드 바로 위에 붙입니다.
 */
export default function Composer({ onSend }: Props) {
  const [text, setText] = useState('')
  const viewport = useVisualViewport()
  const aboveKeyboard = keyboardOpen(viewport)

  function submit() {
    const body = text.trim()
    if (!body) return
    onSend(body)
    setText('')
  }

  return (
    <div
      className={`fixed inset-x-0 z-40 mx-auto max-w-2xl border-t border-line bg-cream/95 px-4 pt-2 pb-2 backdrop-blur ${
        aboveKeyboard ? '' : 'bottom-[calc(3.9rem+env(safe-area-inset-bottom))]'
      }`}
      style={aboveKeyboard && viewport ? { bottom: viewport.bottomInset } : undefined}
    >
      <div className="mb-2 flex gap-2 overflow-x-auto">
        {QUICK.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSend(emoji)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-xl hover:bg-brand-soft"
            aria-label={`${emoji} 보내기`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          className="field min-w-0 flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="하고 싶은 말을 적어요"
          maxLength={MAX_LENGTH}
          enterKeyHint="send"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={text.trim().length === 0}
          className="btn btn-primary shrink-0 px-5"
        >
          보내기
        </button>
      </form>
    </div>
  )
}
