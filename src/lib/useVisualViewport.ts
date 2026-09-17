import { useEffect, useState } from 'react'

/**
 * 실제로 보이는 화면 영역. 폰에서 키보드가 올라오면 아래쪽이 가려지는데,
 * position: fixed 는 그걸 모르고 원래 자리에 남아 키보드 뒤로 숨거나 다른 것과
 * 겹칩니다. 이 값을 써서 입력 칸과 모달을 보이는 영역 안에 놓습니다.
 */
export interface ViewportBox {
  /** 보이는 영역의 윗변 (페이지가 밀려 올라간 만큼) */
  top: number
  height: number
  /** 아래쪽이 가려진 높이. 대개 키보드 높이. 0 이면 가려진 것 없음 */
  bottomInset: number
}

export function useVisualViewport(): ViewportBox | null {
  const [box, setBox] = useState<ViewportBox | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      setBox({
        top: vv.offsetTop,
        height: vv.height,
        bottomInset: Math.max(0, window.innerHeight - vv.height - vv.offsetTop),
      })
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return box
}

/** 키보드가 올라와 있다고 볼 만한 높이. 주소창 변화 정도(수십 px)는 무시합니다. */
export function keyboardOpen(box: ViewportBox | null): boolean {
  return (box?.bottomInset ?? 0) > 120
}
