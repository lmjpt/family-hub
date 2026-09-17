import { useRef, useState } from 'react'
import Avatar from '../components/Avatar'
import MemberForm from '../features/members/MemberForm'
import NotificationSettings from '../features/push/NotificationSettings'
import { useSession } from '../features/auth'
import { useFamilyAuth } from '../features/familyAuth'
import {
  addReward,
  exportJson,
  importJson,
  removeReward,
  renameFamily,
  resetToSeed,
  updateReward,
  useDb,
} from '../lib/db'
import { canManageMembers, canManageRewards, isParent } from '../lib/permissions'
import type { Member } from '../types'

export default function Settings() {
  const db = useDb()
  const { me, logout } = useSession()
  const { signOut } = useFamilyAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [editing, setEditing] = useState<Member | null>(null)
  const [memberFormOpen, setMemberFormOpen] = useState(false)
  const [rewardTitle, setRewardTitle] = useState('')
  const [rewardCost, setRewardCost] = useState(20)

  function openMember(member: Member | null) {
    setEditing(member)
    setMemberFormOpen(true)
  }

  function download() {
    const blob = new Blob([exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `우리집-백업-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function upload(file: File) {
    const ok = window.confirm(
      '지금 들어 있는 내용이 모두 백업 파일 내용으로 바뀝니다. 계속할까요?',
    )
    if (!ok) return
    try {
      await importJson(await file.text())
      window.alert('불러왔습니다.')
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '불러오지 못했습니다.')
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">설정</h2>

      {/* 알림 — 기기마다 따로 켭니다. 아이 폰에서도 아이가 직접 켤 수 있게 맨 위에. */}
      <NotificationSettings />

      {/* 가족 이름 */}
      <section className="space-y-2">
        <h3 className="text-base font-bold">가족 이름</h3>
        <input
          className="field"
          value={db.family.name}
          onChange={(e) => renameFamily(e.target.value)}
          disabled={!isParent(me)}
        />
      </section>

      {/* 구성원 */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">가족 구성원</h3>
          {canManageMembers(me) && (
            <button
              type="button"
              onClick={() => openMember(null)}
              className="btn btn-primary py-2 text-sm"
            >
              + 추가
            </button>
          )}
        </div>
        <ul className="space-y-2">
          {db.members.map((member) => (
            <li key={member.id} className="card flex items-center gap-3 px-4 py-3">
              <Avatar member={member} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{member.name}</span>
                <span className="text-sm text-muted">
                  {member.role === 'parent' ? '부모' : '자녀'}
                  {member.pin ? ' · 비밀번호 있음' : ' · 비밀번호 없음'}
                </span>
              </span>
              {canManageMembers(me) && (
                <button
                  type="button"
                  onClick={() => openMember(member)}
                  className="btn btn-ghost px-3 py-2 text-sm"
                >
                  고치기
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* 보상 */}
      {canManageRewards(me) && (
        <section className="space-y-2">
          <h3 className="text-base font-bold">보상 목록</h3>
          <ul className="space-y-2">
            {db.rewards.map((reward) => (
              <li key={reward.id} className="card flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate font-semibold ${
                      reward.active ? '' : 'text-muted line-through'
                    }`}
                  >
                    {reward.title}
                  </span>
                  <span className="text-sm font-semibold text-praise">
                    {reward.costPoints}점
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => updateReward(reward.id, { active: !reward.active })}
                  className="btn btn-ghost px-3 py-2 text-sm"
                >
                  {reward.active ? '숨기기' : '보이기'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(`'${reward.title}'을(를) 지울까요?`)) return
                    removeReward(reward.id)
                  }}
                  className="rounded-lg px-2 py-2 text-sm text-muted hover:bg-cream"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>

          <div className="card flex flex-wrap items-end gap-2 px-4 py-3">
            <div className="min-w-40 flex-1">
              <label className="label" htmlFor="reward-title">
                새 보상
              </label>
              <input
                id="reward-title"
                className="field"
                value={rewardTitle}
                onChange={(e) => setRewardTitle(e.target.value)}
                placeholder="예) 놀이터 30분"
              />
            </div>
            <div className="w-24">
              <label className="label" htmlFor="reward-cost">
                점수
              </label>
              <input
                id="reward-cost"
                type="number"
                min={1}
                className="field text-center"
                value={rewardCost}
                onChange={(e) => setRewardCost(Number(e.target.value))}
              />
            </div>
            <button
              type="button"
              disabled={rewardTitle.trim() === '' || rewardCost < 1}
              onClick={() => {
                addReward({
                  title: rewardTitle.trim(),
                  costPoints: rewardCost,
                  active: true,
                })
                setRewardTitle('')
                setRewardCost(20)
              }}
              className="btn btn-primary"
            >
              추가
            </button>
          </div>
        </section>
      )}

      {/* 데이터 */}
      {isParent(me) && (
        <section className="space-y-2">
          <h3 className="text-base font-bold">데이터 보관</h3>
          <p className="text-sm text-muted">
            내용은 서버에 저장되고 가족 모두의 기기에서 함께 보입니다. 여기서 바꾸면
            다른 사람 화면에도 바로 반영되니 조심해서 눌러 주세요.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={download} className="btn btn-ghost">
              백업 내려받기
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn btn-ghost"
            >
              백업 불러오기
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void upload(file)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => {
                const ok = window.confirm(
                  '지금까지 쌓인 일정, 할일, 포인트가 모두 사라지고 처음 예시 상태로 돌아갑니다. 가족 모두의 기기에서 사라집니다. 정말 되돌릴까요?',
                )
                if (ok) void resetToSeed()
              }}
              className="btn btn-ghost text-muted"
            >
              샘플 데이터로 되돌리기
            </button>
          </div>
        </section>
      )}

      <div className="space-y-2">
        <button type="button" onClick={logout} className="btn btn-ghost w-full">
          다른 사람으로 바꾸기
        </button>

        {/*
          가족 계정 로그아웃은 드물게 씁니다 (기기를 남에게 줄 때 등).
          누르면 이 기기에서 다시 이메일·비밀번호를 넣어야 하므로
          아이가 실수로 누르지 않도록 작게, 아래쪽에 둡니다.
        */}
        <button
          type="button"
          onClick={() => {
            const ok = window.confirm(
              '이 기기에서 가족 계정을 로그아웃합니다. 다시 쓰려면 이메일과 비밀번호를 넣어야 해요. 계속할까요?',
            )
            if (ok) void signOut()
          }}
          className="w-full py-2 text-xs text-muted underline underline-offset-4"
        >
          이 기기에서 가족 계정 로그아웃
        </button>
      </div>

      <MemberForm
        open={memberFormOpen}
        member={editing}
        onClose={() => setMemberFormOpen(false)}
      />
    </div>
  )
}
