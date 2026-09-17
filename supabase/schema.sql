-- ─────────────────────────────────────────────────────────────
-- 우리집 앱 데이터베이스
--
-- Supabase 대시보드 → SQL Editor 에 이 파일 내용을 통째로 붙여넣고
-- 한 번만 실행하면 됩니다. 여러 번 실행해도 안전합니다.
--
-- 설계: 가족 하나당 '가족 계정' 하나(auth.users 의 한 사람)를 씁니다.
-- 폰마다 그 계정으로 한 번 로그인하고, 앱 안에서 얼굴을 눌러
-- '누구인지'를 고릅니다. 아이가 이메일·비밀번호를 외울 필요가 없습니다.
-- ─────────────────────────────────────────────────────────────

-- ── 테이블 ────────────────────────────────────────────────────

create table if not exists family (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null default '우리집',
  created_at timestamptz not null default now()
);

create table if not exists member (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references family(id) on delete cascade,
  name         text not null,
  role         text not null check (role in ('parent', 'child')),
  color        text not null,
  birth_date   date,
  avatar_emoji text not null,
  -- 빈 문자열이면 PIN 없이 바로 들어갑니다. 아이들은 보통 비워 둡니다.
  pin          text not null default '',
  created_at   timestamptz not null default now()
);

create table if not exists event (
  id        uuid primary key default gen_random_uuid(),
  family_id uuid not null references family(id) on delete cascade,
  title     text not null,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  all_day   boolean not null default false,
  -- null 이면 가족 전체 일정
  owner_id  uuid references member(id) on delete cascade,
  memo      text not null default ''
);

-- 할일과 숙제는 한 테이블입니다. kind 로만 구분합니다.
-- 쪼개면 '오늘 할 거 전부 보기'가 불필요하게 복잡해집니다.
create table if not exists task (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references family(id) on delete cascade,
  title         text not null,
  kind          text not null check (kind in ('chore', 'homework')),
  assignee_id   uuid references member(id) on delete set null,
  due_at        timestamptz,
  status        text not null default 'todo' check (status in ('todo', 'done', 'confirmed')),
  subject       text,
  reward_points integer not null default 0 check (reward_points >= 0),
  created_at    timestamptz not null default now()
);

create table if not exists point_entry (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references family(id) on delete cascade,
  member_id  uuid not null references member(id) on delete cascade,
  -- 양수 = 칭찬, 음수 = 벌점 또는 보상 교환
  points     integer not null,
  reason     text not null,
  given_by   uuid references member(id) on delete set null,
  task_id    uuid references task(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists reward (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references family(id) on delete cascade,
  title       text not null,
  cost_points integer not null check (cost_points > 0),
  active      boolean not null default true
);

-- 가족 대화방. 아이 폰에 카톡이 없어서 이 앱이 유일한 연락 수단입니다.
-- 방은 가족당 하나뿐이라 '방' 테이블은 따로 두지 않습니다.
create table if not exists message (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references family(id) on delete cascade,
  sender_id  uuid not null references member(id) on delete cascade,
  body       text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- 같은 숙제로 포인트가 두 번 들어가는 것을 DB 차원에서 막습니다.
-- 아이가 완료 체크를 껐다 켜도 점수는 한 번만 지급됩니다.
create unique index if not exists point_entry_task_once
  on point_entry (task_id) where task_id is not null;

-- 자주 하는 조회를 위한 인덱스
create index if not exists member_family_idx on member (family_id);
create index if not exists event_family_start_idx on event (family_id, starts_at);
create index if not exists task_family_kind_idx on task (family_id, kind, status);
create index if not exists point_entry_member_idx on point_entry (member_id, created_at desc);
create index if not exists reward_family_idx on reward (family_id);
create index if not exists message_family_created_idx on message (family_id, created_at desc);

-- ── 접근 권한 (RLS) ───────────────────────────────────────────
-- 로그인한 가족 계정은 '자기 가족의 줄'만 읽고 쓸 수 있습니다.
-- 로그인하지 않으면 아무것도 못 봅니다.

alter table family      enable row level security;
alter table member      enable row level security;
alter table event       enable row level security;
alter table task        enable row level security;
alter table point_entry enable row level security;
alter table reward      enable row level security;
alter table message     enable row level security;

drop policy if exists family_own on family;
create policy family_own on family
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 나머지 테이블은 전부 같은 규칙입니다: 내 가족의 줄인가?
drop policy if exists member_own on member;
create policy member_own on member
  for all to authenticated
  using (family_id in (select id from family where owner_id = auth.uid()))
  with check (family_id in (select id from family where owner_id = auth.uid()));

drop policy if exists event_own on event;
create policy event_own on event
  for all to authenticated
  using (family_id in (select id from family where owner_id = auth.uid()))
  with check (family_id in (select id from family where owner_id = auth.uid()));

drop policy if exists task_own on task;
create policy task_own on task
  for all to authenticated
  using (family_id in (select id from family where owner_id = auth.uid()))
  with check (family_id in (select id from family where owner_id = auth.uid()));

drop policy if exists point_entry_own on point_entry;
create policy point_entry_own on point_entry
  for all to authenticated
  using (family_id in (select id from family where owner_id = auth.uid()))
  with check (family_id in (select id from family where owner_id = auth.uid()));

drop policy if exists reward_own on reward;
create policy reward_own on reward
  for all to authenticated
  using (family_id in (select id from family where owner_id = auth.uid()))
  with check (family_id in (select id from family where owner_id = auth.uid()));

drop policy if exists message_own on message;
create policy message_own on message
  for all to authenticated
  using (family_id in (select id from family where owner_id = auth.uid()))
  with check (family_id in (select id from family where owner_id = auth.uid()));

-- ── 실시간 반영 ───────────────────────────────────────────────
-- 엄마가 숙제를 올리면 아이 폰에 새로고침 없이 바로 뜨게 합니다.
-- 테이블마다 따로 검사해야, 나중에 테이블을 추가하고 이 파일을 다시
-- 실행했을 때 새 테이블만 빠짐없이 들어갑니다.

do $$
declare
  t text;
begin
  foreach t in array array['family', 'member', 'event', 'task', 'point_entry', 'reward', 'message'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
