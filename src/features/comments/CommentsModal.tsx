import { useMemo, useState } from 'react'
import Avatar from '../../components/Avatar'
import Modal from '../../components/Modal'
import { addComment, removeComment, useDb } from '../../lib/db'
import { formatShort } from '../../lib/date'
import { canComment, canDeleteComment } from '../../lib/permissions'
import { useMe } from '../auth'

/** 일정 하나 또는 할일 하나. 둘 중 하나만 넘깁니다. */
export type CommentTarget = { eventId: string; taskId?: undefined } | { taskId: string; eventId?: undefined }

interface Props {
  open: boolean
  /** 모달 제목으로 보일 항목 이름 */
  title: string
  target: CommentTarget
  onClose: () => void
}

/** 항목 하나에 달린 댓글 목록 + 입력 칸. */
export default function CommentsModal({ open, title, target, onClose }: Props) {
  const db = useDb()
  const me = useMe()
  const [text, setText] = useState('')

  const comments = useMemo(
    () =>
      db.comments
        .filter((c) =>
          target.eventId ? c.eventId === target.eventId : c.taskId === target.taskId,
        )
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [db.comments, target.eventId, target.taskId],
  )

  function submit() {
    if (!me) return
    const body = text.trim()
    if (!body) return
    addComment({ eventId: target.eventId, taskId: target.taskId, authorId: me.id, body })
    setText('')
  }

  return (
    <Modal
      open={open}
      title={`💬 ${title}`}
      onClose={onClose}
      footer={
        canComment(me) ? (
          <form
            className="flex w-full gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <input
              className="field min-w-0 flex-1"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="한마디 남기기"
              maxLength={1000}
              enterKeyHint="send"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={text.trim().length === 0}
              className="btn btn-primary shrink-0 px-4"
            >
              남기기
            </button>
          </form>
        ) : undefined
      }
    >
      {comments.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          아직 댓글이 없어요. 첫 한마디를 남겨 보세요.
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const author = db.members.find((m) => m.id === c.authorId) ?? null
            return (
              <li key={c.id} className="flex items-start gap-2.5">
                {author ? (
                  <Avatar member={author} size="sm" />
                ) : (
                  <span className="h-8 w-8 shrink-0 rounded-full bg-cream" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                    <span className="font-semibold text-ink">{author?.name ?? '누군가'}</span>
                    <span>{formatShort(c.createdAt)}</span>
                    {canDeleteComment(me, c) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('이 댓글을 지울까요?')) removeComment(c.id)
                        }}
                        className="font-semibold hover:underline"
                      >
                        지우기
                      </button>
                    )}
                  </p>
                  <p className="mt-0.5 rounded-xl bg-cream px-3 py-2 text-sm leading-snug break-words whitespace-pre-wrap">
                    {c.body}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
