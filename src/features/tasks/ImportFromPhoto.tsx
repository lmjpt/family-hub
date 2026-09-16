import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import Modal from '../../components/Modal'
import { addTask, useDb } from '../../lib/db'
import {
  dayKeyToIso,
  formatDayLabel,
  isoToSeoulInput,
  monthDayToKey,
  seoulInputToIso,
  todayKey,
} from '../../lib/date'
import { readTextFromImage, splitDueHint, toHomeworkLines } from '../../lib/ocr'
import type { OcrLanguage, OcrProgress } from '../../lib/ocr'

const SUBJECTS = ['', '국어', '수학', '영어', '사회', '과학', '기타'] as const

/** 같은 학원 사진을 계속 올리므로 마지막 선택을 기기에 기억해 둡니다. */
const LANGUAGE_KEY = 'family-hub-ocr-language'

function loadLanguage(): OcrLanguage {
  return localStorage.getItem(LANGUAGE_KEY) === 'eng' ? 'eng' : 'kor+eng'
}

interface Props {
  open: boolean
  onClose: () => void
}

type Step = 'pick' | 'reading' | 'review'

/**
 * 학원에서 사진으로 보내 준 숙제를 항목으로 만들어 줍니다.
 *
 * 사진은 저장하지 않습니다. 글자만 읽고 바로 버립니다.
 * 인식 결과는 절대 완벽하지 않으므로, 저장 전에 반드시 사람이 고치는
 * 단계를 거치게 했습니다.
 */
export default function ImportFromPhoto({ open, onClose }: Props) {
  const db = useDb()
  const children = db.members.filter((m) => m.role === 'child')
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('pick')
  const [progress, setProgress] = useState<OcrProgress>({ label: '', ratio: 0 })
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [language, setLanguage] = useState<OcrLanguage>(loadLanguage)

  const [assigneeId, setAssigneeId] = useState('')
  const [due, setDue] = useState('')
  const [subject, setSubject] = useState('')
  const [points, setPoints] = useState(5)

  useEffect(() => {
    if (!open) return
    setStep('pick')
    setText('')
    setError('')
    setProgress({ label: '', ratio: 0 })
    setAssigneeId(children[0]?.id ?? '')
    setDue(isoToSeoulInput(dayKeyToIso(todayKey(), '21:00')))
    setSubject('')
    setPoints(5)
    // children 은 렌더마다 새 배열이라 의존성에 넣으면 폼이 계속 초기화됩니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 한 줄 = 숙제 하나. 줄에 'By 9/15' 같은 날짜가 있으면 그 줄의 마감으로 씁니다.
  const items = useMemo(
    () =>
      toHomeworkLines(text).map((line) => {
        const { title, due } = splitDueHint(line)
        return { title, dayKey: due ? monthDayToKey(due.month, due.day) : null }
      }),
    [text],
  )
  const hasLineDue = items.some((it) => it.dayKey !== null)

  function chooseLanguage(next: OcrLanguage) {
    setLanguage(next)
    localStorage.setItem(LANGUAGE_KEY, next)
  }

  async function handleFile(file: File) {
    setStep('reading')
    setError('')
    try {
      const result = await readTextFromImage(file, setProgress, language)
      const found = toHomeworkLines(result)
      setText(found.join('\n'))
      setStep('review')
      if (found.length === 0) {
        setError('글자를 찾지 못했어요. 아래에 직접 적으셔도 됩니다.')
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `사진을 읽지 못했습니다: ${err.message}`
          : '사진을 읽지 못했습니다.',
      )
      setStep('pick')
    }
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ''
  }

  function save() {
    // 폼의 마감 시각(예: 21:00)은 날짜가 적힌 줄에도 똑같이 적용합니다.
    const time = due.slice(11, 16) || '21:00'
    for (const item of items) {
      addTask({
        title: item.title,
        kind: 'homework',
        assigneeId: assigneeId || null,
        dueAt: item.dayKey ? dayKeyToIso(item.dayKey, time) : seoulInputToIso(due),
        status: 'todo',
        subject: subject || null,
        rewardPoints: Math.max(0, points),
      })
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      title="사진에서 숙제 가져오기"
      onClose={onClose}
      footer={
        step === 'review' ? (
          <button
            type="button"
            onClick={save}
            disabled={items.length === 0}
            className="btn btn-primary flex-1"
          >
            숙제 {items.length}개 추가
          </button>
        ) : undefined
      }
    >
      {step === 'pick' && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            학원에서 받은 숙제 사진을 고르면 글자를 읽어 숙제 목록으로 만들어
            줍니다. <b>사진은 저장하지 않고</b> 글자만 가져온 뒤 바로 버립니다.
          </p>

          {/* 학원 숙제는 대부분 카톡 등으로 받은 사진이라 앨범이 기본입니다.
              capture 를 붙이면 폰에서 카메라만 열려 앨범을 고를 수 없습니다. */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="card flex w-full flex-col items-center gap-2 py-10 hover:bg-cream"
          >
            <span className="text-5xl" aria-hidden="true">
              🖼️
            </span>
            <span className="font-bold">앨범에서 사진 고르기</span>
            <span className="text-sm text-muted">학원에서 받은 숙제 사진</span>
          </button>

          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="btn w-full"
          >
            📷 지금 찍기
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPick}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPick}
          />

          <label className="flex items-center gap-3 rounded-xl bg-cream px-4 py-3 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={language === 'eng'}
              onChange={(e) => chooseLanguage(e.target.checked ? 'eng' : 'kor+eng')}
            />
            <span>
              <b>영어로만 적힌 사진이에요</b>
              <br />
              <span className="text-muted">
                영어 학원 숙제처럼 한글이 없으면 켜 두세요. 영어를 한글로 잘못 읽는
                일이 줄어요.
              </span>
            </span>
          </label>

          <button
            type="button"
            onClick={() => setStep('review')}
            className="w-full py-2 text-sm font-semibold text-muted underline underline-offset-4"
          >
            사진 없이 직접 적기
          </button>

          {error && <p className="text-sm text-brand">{error}</p>}

          <p className="rounded-xl bg-cream px-4 py-3 text-xs text-muted">
            처음 한 번은 한글 인식 데이터(약 10MB)를 받느라 시간이 걸립니다.
            그 다음부터는 훨씬 빨라요.
          </p>
        </div>
      )}

      {step === 'reading' && (
        <div className="flex flex-col items-center gap-3 py-12">
          <span className="text-4xl" aria-hidden="true">
            🔍
          </span>
          <p className="font-semibold">{progress.label || '준비하는 중'}</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${Math.round(progress.ratio * 100)}%` }}
            />
          </div>
          <p className="text-sm text-muted">사진은 저장되지 않아요</p>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="ocr-text">
              읽은 내용 — 한 줄에 숙제 하나
            </label>
            <textarea
              id="ocr-text"
              className="field font-mono text-sm"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'수학 익힘책 24~25쪽\n영어 단어 20개 외우기'}
            />
            <p className="mt-1.5 text-xs text-muted">
              잘못 읽은 글자는 여기서 고치세요. 빈 줄은 그냥 넘어갑니다. 줄 끝에
              <b> By 9/15</b> 처럼 날짜를 적으면 그 숙제의 마감이 됩니다.
            </p>
          </div>

          {error && <p className="text-sm text-brand">{error}</p>}

          <div>
            <label className="label" htmlFor="ocr-assignee">
              누구 숙제인가요?
            </label>
            <select
              id="ocr-assignee"
              className="field"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">담당 없음</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.avatarEmoji} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="label">과목 (전부 같은 과목일 때만)</span>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((s) => (
                <button
                  key={s || 'none'}
                  type="button"
                  onClick={() => setSubject(s)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                    subject === s
                      ? 'border-brand bg-brand-soft text-ink'
                      : 'border-line bg-paper text-muted'
                  }`}
                >
                  {s || '없음'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ocr-due">
                {hasLineDue ? '마감 (날짜가 없는 줄만)' : '마감'}
              </label>
              <input
                id="ocr-due"
                type="datetime-local"
                className="field"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="ocr-points">
                하나당 칭찬 점수
              </label>
              <input
                id="ocr-points"
                type="number"
                min={0}
                className="field text-center font-bold"
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
              />
            </div>
          </div>

          {items.length > 0 && (
            <div>
              <span className="label">이렇게 만들어집니다</span>
              <ul className="space-y-1">
                {items.map((item, i) => (
                  <li
                    key={`${i}-${item.title}`}
                    className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-sm"
                  >
                    <span aria-hidden="true">📚</span>
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    {item.dayKey && (
                      <span className="shrink-0 text-xs font-semibold text-muted">
                        {formatDayLabel(item.dayKey)}까지
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
