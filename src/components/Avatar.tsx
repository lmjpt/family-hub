import type { Member } from '../types'

const SIZES = {
  sm: 'h-8 w-8 text-lg',
  md: 'h-11 w-11 text-2xl',
  lg: 'h-16 w-16 text-4xl',
  xl: 'h-24 w-24 text-6xl',
} as const

interface Props {
  member: Member
  size?: keyof typeof SIZES
  /** 선택된 상태를 테두리로 표시 */
  selected?: boolean
}

/** 이모지 얼굴 + 구성원 색 테두리. 글자를 못 읽는 아이도 자기 자리를 찾을 수 있게. */
export default function Avatar({ member, size = 'md', selected = false }: Props) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-paper ${SIZES[size]}`}
      style={{
        border: `${selected ? 3 : 2}px solid ${member.color}`,
        boxShadow: selected ? `0 0 0 4px ${member.color}22` : undefined,
      }}
      aria-hidden="true"
    >
      {member.avatarEmoji}
    </span>
  )
}
