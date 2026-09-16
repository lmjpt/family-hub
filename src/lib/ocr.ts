// ─────────────────────────────────────────────────────────────
// 사진에서 글자를 읽어 옵니다 (tesseract.js).
//
// 사진은 저장하지 않습니다. 브라우저 안에서 글자만 뽑아내고 바로 버립니다.
// 서버로 보내지도 않습니다 — 아이 숙제 사진이 밖으로 나갈 일이 없습니다.
//
// 대신 한글·영어 인식 데이터(합쳐서 약 10MB)를 처음 한 번 인터넷에서 받아옵니다.
// 그 뒤로는 브라우저가 캐시해 두기 때문에 훨씬 빨라집니다.
// ─────────────────────────────────────────────────────────────

import { createWorker } from 'tesseract.js'

/** 너무 큰 사진은 인식이 느려서 줄입니다. 글씨가 뭉개지지 않을 정도는 남깁니다. */
const MAX_EDGE = 2000

export interface OcrProgress {
  /** 화면에 그대로 보여 줄 한국어 문구 */
  label: string
  /** 0 ~ 1 */
  ratio: number
}

/** tesseract 가 영어로 알려 주는 진행 상태를 사람 말로 바꿉니다. */
function toKorean(status: string): string {
  if (status.includes('loading tesseract')) return '준비하는 중'
  if (status.includes('initializing tesseract')) return '준비하는 중'
  if (status.includes('traineddata')) return '인식 데이터를 받는 중 (처음 한 번만)'
  if (status.includes('initializing api')) return '거의 다 됐어요'
  if (status.includes('recognizing')) return '사진에서 글자를 읽는 중'
  return '처리하는 중'
}

/** 사진을 인식하기 좋은 크기로 줄입니다. 원본은 건드리지 않습니다. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이 브라우저에서는 사진을 처리할 수 없습니다.')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.9),
  )
  if (!blob) throw new Error('사진을 읽을 수 있는 형태로 바꾸지 못했습니다.')
  return blob
}

/**
 * 어떤 글자를 기대하고 읽을지.
 * 한글 데이터를 같이 켜면 영어 학원 숙제의 'P', 'Jw' 같은 짧은 영어 단어를
 * 한글로 잘못 읽는 일이 잦습니다. 영어만 적힌 사진은 'eng' 로 읽는 게 낫습니다.
 */
export type OcrLanguage = 'kor+eng' | 'eng'

/**
 * 사진에서 글자를 읽어 문자열로 돌려줍니다.
 * 다 끝나면 사진 데이터는 함수 밖으로 나가지 않고 그대로 버려집니다.
 */
export async function readTextFromImage(
  file: File,
  onProgress: (p: OcrProgress) => void,
  language: OcrLanguage = 'kor+eng',
): Promise<string> {
  const image = await shrink(file)

  const langs = language === 'eng' ? ['eng'] : ['kor', 'eng']
  const worker = await createWorker(langs, 1, {
    logger: (m) => onProgress({ label: toKorean(m.status), ratio: m.progress }),
  })

  try {
    // 한글은 띄어쓰기를 살려 둬야 나중에 사람이 읽고 고치기 좋습니다.
    await worker.setParameters({ preserve_interword_spaces: '1' })
    const { data } = await worker.recognize(image)
    return data.text
  } finally {
    await worker.terminate()
  }
}

/**
 * 읽어 온 글자 덩어리를 숙제 목록으로 자릅니다.
 *
 * 인식 결과는 항상 지저분합니다. 그래서 여기서 완벽하게 맞추려 하지 않고,
 * '한 줄에 하나'로만 잘라서 사람이 화면에서 고치도록 합니다.
 */
export function toHomeworkLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) =>
      line
        // 앞에 붙은 번호나 기호를 떼어 냅니다: '1.', '2)', '-', '·', '□'
        .replace(/^[\s\-·•□■○●*]+/, '')
        .replace(/^\d+\s*[.)]\s*/, '')
        .trim(),
    )
    // 한 글자짜리 줄은 대부분 인식 오류라 버립니다.
    .filter((line) => line.length >= 2)
}

/** 숙제 한 줄에 적힌 마감 월·일. 연도는 lib/date 의 monthDayToKey 가 정합니다. */
export interface DueHint {
  month: number
  day: number
}

// 'By 9/15', '~9/15', '9/15까지', '(9월 15일)' — 슬래시나 '월' 이 있으면 날짜로 봅니다.
const SLASH_DATE =
  /(?:\b(?:by|due)\b|~|마감|제출)?\s*[([]?\s*(\d{1,2})\s*(?:\/|월)\s*(\d{1,2})\s*일?\s*[)\]]?\s*(?:까지|마감|제출)?/i
// 'by 9.15', '9.15까지' — 점만 있으면 '3.5' 같은 숫자와 헷갈리므로 앞뒤 말이 있어야 합니다.
const DOT_DATE_BEFORE =
  /(?:\b(?:by|due)\b|~|마감|제출)\s*[([]?\s*(\d{1,2})\.(\d{1,2})\s*[)\]]?\s*(?:까지|마감|제출)?/i
const DOT_DATE_AFTER = /[([]?\s*(\d{1,2})\.(\d{1,2})\s*[)\]]?\s*(?:까지|마감|제출)/i

/**
 * 숙제 한 줄에서 마감 날짜 표기를 찾아 떼어 냅니다.
 * 'Jw p.24 By 9/15' → { title: 'Jw p.24', due: { month: 9, day: 15 } }
 * 날짜가 없으면 due 는 null 이고 title 은 원래 줄 그대로입니다.
 */
export function splitDueHint(line: string): { title: string; due: DueHint | null } {
  for (const re of [SLASH_DATE, DOT_DATE_BEFORE, DOT_DATE_AFTER]) {
    const m = re.exec(line)
    if (!m || m.index === undefined) continue
    const month = Number(m[1])
    const day = Number(m[2])
    if (month < 1 || month > 12 || day < 1 || day > 31) continue

    const title = (line.slice(0, m.index) + ' ' + line.slice(m.index + m[0].length))
      .replace(/\s+/g, ' ')
      .replace(/[\s\-–:,]+$/, '')
      .trim()
    return { title: title || line, due: { month, day } }
  }
  return { title: line, due: null }
}
