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

-- 대화방에서 '누가 어디까지 읽었나'. 구성원마다 한 줄, 마지막으로 읽은 시각만 둡니다.
-- 메시지마다 읽음 줄을 남기지 않는 이유: 가족 대화방에는 그 정밀도가 필요 없고
-- 쌓이기만 하는 표를 하나 더 만들고 싶지 않기 때문입니다.
create table if not exists chat_read (
  family_id    uuid not null references family(id) on delete cascade,
  member_id    uuid primary key references member(id) on delete cascade,
  last_read_at timestamptz not null default now()
);

-- 일정·할일(숙제) 항목마다 달리는 짧은 댓글. "이거 모르겠어요", "확인했어" 정도.
-- 일정 또는 할일 중 정확히 하나에만 달립니다. 원본이 지워지면 함께 사라집니다.
create table if not exists comment (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references family(id) on delete cascade,
  event_id   uuid references event(id) on delete cascade,
  task_id    uuid references task(id) on delete cascade,
  author_id  uuid not null references member(id) on delete cascade,
  body       text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  check ((event_id is null) <> (task_id is null))
);

-- 안드로이드 위젯 토큰. 웹 화면의 '위젯 연결'을 누를 때마다 한 줄 생기고, 그 폰의 위젯이
-- 이 값으로 Edge Function 'widget' 을 부릅니다. 토큰 하나 = 구성원 하나 (누구 것을 보여 줄지).
create table if not exists widget_token (
  token      text primary key,
  family_id  uuid not null references family(id) on delete cascade,
  member_id  uuid not null references member(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 푸시 알림 구독. 알림을 켠 기기(브라우저)마다 한 줄. 화면에는 나오지 않습니다.
-- Edge Function(supabase/functions/notify)이 새 메시지·댓글이 생기면 여기 있는
-- 기기들로 알림을 보냅니다. 보낸 사람 본인 기기는 건너뜁니다.
create table if not exists push_subscription (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references family(id) on delete cascade,
  member_id  uuid not null references member(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
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
create index if not exists comment_event_idx on comment (event_id) where event_id is not null;
create index if not exists comment_task_idx on comment (task_id) where task_id is not null;
create index if not exists push_subscription_family_idx on push_subscription (family_id);

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
alter table comment     enable row level security;
alter table chat_read   enable row level security;
alter table push_subscription enable row level security;
alter table widget_token enable row level security;

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

drop policy if exists comment_own on comment;
create policy comment_own on comment
  for all to authenticated
  using (family_id in (select id from family where owner_id = auth.uid()))
  with check (family_id in (select id from family where owner_id = auth.uid()));

drop policy if exists chat_read_own on chat_read;
create policy chat_read_own on chat_read
  for all to authenticated
  using (family_id in (select id from family where owner_id = auth.uid()))
  with check (family_id in (select id from family where owner_id = auth.uid()));

drop policy if exists widget_token_own on widget_token;
create policy widget_token_own on widget_token
  for all to authenticated
  using (family_id in (select id from family where owner_id = auth.uid()))
  with check (family_id in (select id from family where owner_id = auth.uid()));

drop policy if exists push_subscription_own on push_subscription;
create policy push_subscription_own on push_subscription
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
  foreach t in array array['family', 'member', 'event', 'task', 'point_entry', 'reward', 'message', 'comment', 'chat_read'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
