import { useMemo, useState } from 'react'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import GivePoints from '../features/points/GivePoints'
import { useMe } from '../features/auth'
import { cancelPointEntry, redeemReward, totalPoints, useDb } from '../lib/db'
import { formatShort } from '../lib/date'
import { canGivePoints, canManageRewards, isParent } from '../lib/permissions'

export default function Points() {
  const db = useDb()
  const me = useMe()

  const children = db.members.filter((m) => m.role === 'child')

  // 아이는 자기 것만 봅니다. 부모는 아이를 골라서 봅니다.
  const [picked, setPicked] = useState<string>(
    () => (me?.role === 'child' ? me.id : (children[0]?.id ?? '')),
  )
  const selectedId = me?.role === 'child' ? me.id : picked
  const selected = db.members.find((m) => m.id === selectedId) ?? null

  const [giving, setGiving] = useState<'praise' | 'minus' | null>(null)

  const history = useMemo(
    () =>
      db.points
        .filter((p) => p.memberId === selectedId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.points, selectedId],
  )

  if (!selected) {
    return (
      <div className="card">
        <EmptyState
          emoji="👶"
          title="자녀가 없어요"
          hint="설정에서 가족 구성원을 추가하면 포인트를 모을 수 있어요."
        />
      </div>
    )
  }

  const total = totalPoints(db.points, selected.id)

  return (
    <div className="space-y-5">
      {/* 부모만 아이를 골라 봅니다 */}
      {isParent(me) && children.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {children.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setPicked(c.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full border py-1.5 pr-4 pl-1.5 text-sm font-semibold ${
                selectedId === c.id
                  ? 'border-brand bg-brand-soft'
                  : 'border-line bg-paper text-muted'
              }`}
            >
              <Avatar member={c} size="sm" />
              {c.name}
              <span className="text-praise">{totalPoints(db.points, c.id)}</span>
            </button>
          ))}
        </div>
      )}

      {/* 총점. 이 화면에서 제일 크고 기분 좋은 자리. */}
      <section className="card flex flex-col items-center gap-2 px-6 py-7">
        <Avatar member={selected} size="lg" />
        <p className="text-base font-bold">{selected.name}</p>
        <p className="flex items-baseline gap-1">
          <span className="text-5xl font-bold text-praise">{total}</span>
          <span className="text-lg font-bold text-praise">점</span>
        </p>

        {canGivePoints(me) && (
          <div className="mt-2 flex w-full flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setGiving('praise')}
              className="btn btn-primary w-full py-4 text-lg"
            >
              ⭐ 칭찬하기
            </button>
            <button
              type="button"
              onClick={() => setGiving('minus')}
              className="py-1 text-sm font-semibold text-muted underline underline-offset-4"
            >
              점수 빼기 기록
            </button>
          </div>
        )}
      </section>

      {/* 보상 */}
      <section className="space-y-2">
        <h3 className="text-base font-bold">모은 점수로 바꾸기</h3>
        {db.rewards.filter((r) => r.active).length === 0 ? (
          <div className="card">
            <EmptyState
              emoji="🎁"
              title="아직 보상이 없어요"
              hint={canManageRewards(me) ? '설정에서 추가할 수 있어요.' : undefined}
            />
          </div>
        ) : (
          <ul className="space-y-2">
            {db.rewards
              .filter((r) => r.active)
              .map((reward) => {
                const affordable = total >= reward.costPoints
                return (
                  <li
                    key={reward.id}
                    className="card flex items-center gap-3 px-4 py-3"
                  >
                    <span className="text-2xl" aria-hidden="true">
                      🎁
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {reward.title}
                      </span>
                      <span className="text-sm font-semibold text-praise">
                        {reward.costPoints}점
                      </span>
                    </span>
                    {canGivePoints(me) ? (
                      <button
                        type="button"
                        disabled={!affordable}
                        onClick={() => {
                          if (!me) return
                          if (
                            !window.confirm(
                              `${selected.name}의 ${reward.costPoints}점을 써서 '${reward.title}'(으)로 바꿀까요?`,
                            )
                          )
                            return
                          redeemReward(reward.id, selected.id, me.id)
                        }}
                        className="btn btn-ghost px-3 py-2 text-sm"
                      >
                        바꾸기
                      </button>
                    ) : (
                      <span className="text-sm font-semibold text-muted">
                        {affordable ? '바꿀 수 있어요!' : `${reward.costPoints - total}점 더`}
                      </span>
                    )}
                  </li>
                )
              })}
          </ul>
        )}
      </section>

      {/* 이력 */}
      <section className="space-y-2">
        <h3 className="text-base font-bold">지난 기록</h3>
        {history.length === 0 ? (
          <div className="card">
            <EmptyState emoji="📖" title="아직 기록이 없어요" />
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((entry) => {
              const giver = db.members.find((m) => m.id === entry.givenBy)
              const plus = entry.points >= 0
              return (
                <li key={entry.id} className="card flex items-center gap-3 px-4 py-3">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      plus
                        ? 'bg-praise-soft text-praise'
                        : 'bg-minus-soft text-minus'
                    }`}
                  >
                    {plus ? '+' : '−'}
                    {Math.abs(entry.points)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{entry.reason}</span>
                    <span className="block text-sm text-muted">
                      {formatShort(entry.createdAt)}
                      {giver ? ` · ${giver.name}` : ''}
                    </span>
                  </span>
                  {canGivePoints(me) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!me) return
                        if (!window.confirm('이 점수를 취소할까요? 기록은 남습니다.')) return
                        cancelPointEntry(entry.id, me.id)
                      }}
                      className="shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-muted hover:bg-cream"
                    >
                      취소
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {giving && (
        <GivePoints
          open
          member={selected}
          mode={giving}
          onClose={() => setGiving(null)}
        />
      )}
    </div>
  )
}
