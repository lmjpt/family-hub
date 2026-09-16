import TaskBoard from '../features/tasks/TaskBoard'

export default function Homework() {
  // 숙제는 '누가 뭘 남겼는지'가 중요해서 아이별로 묶어 보여 줍니다.
  return <TaskBoard kind="homework" title="숙제" emoji="📚" groupByMember />
}
