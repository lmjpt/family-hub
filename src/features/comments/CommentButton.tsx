import { useState } from 'react'
import { useCommentsReady, useDb } from '../../lib/db'
import CommentsModal from './CommentsModal'
import type { CommentTarget } from './CommentsModal'

interface Props {
  title: string
  target: CommentTarget
}

/**
 * 항목 줄 끝에 붙는 💬 버튼. 댓글 수를 함께 보여 주고 누르면 댓글 창이 열립니다.
 * 서버에 comment 테이블이 아직 없으면 아무것도 그리지 않습니다.
 */
export default function CommentButton({ title, target }: Props) {
  const db = useDb()
  const ready = useCommentsReady()
  const [open, setOpen] = useState(false)

  if (!ready) return null

  const count = db.comments.filter((c) =>
    target.eventId ? c.eventId === target.eventId : c.taskId === target.taskId,
  ).length

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={count > 0 ? `댓글 ${count}개 보기` : '댓글 남기기'}
        className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-cream ${
          count > 0 ? 'text-ink' : 'text-muted'
        }`}
      >
        <span aria-hidden="true">💬</span>
        {count > 0 && <span>{count}</span>}
      </button>
      {open && (
        <CommentsModal open title={title} target={target} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
