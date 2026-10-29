-- Phase 0/1: 인증, 커플 연결, 공유 일정. 사진/찌르기/알림 테이블은 해당 Phase에서 추가한다.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- 가입 시 프로필 자동 생성 (클라이언트가 만들 필요 없음)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create table public.invites (
  code text primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null check (char_length(title) between 1 and 200),
  note text,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_couple_start on public.events (couple_id, start_at);

create or replace function public.my_couple_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select couple_id from public.couple_members where user_id = auth.uid()
$$;

create or replace function public.create_invite()
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  cid uuid;
  new_code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  cid := public.my_couple_id();
  if cid is null then
    insert into public.couples default values returning id into cid;
    insert into public.couple_members (couple_id, user_id) values (cid, auth.uid());
  end if;

  if (select count(*) from public.couple_members where couple_id = cid) >= 2 then
    raise exception 'couple already full';
  end if;

  -- Supabase는 pgcrypto를 extensions 스키마에 두므로 search_path=public에서 gen_random_bytes가 안 보인다. 코어 함수만 쓴다.
  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.invites (code, couple_id, created_by, expires_at)
  values (new_code, cid, auth.uid(), now() + interval '24 hours');
  return new_code;
end $$;

create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  inv public.invites%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.my_couple_id() is not null then raise exception 'already in a couple'; end if;

  select * into inv from public.invites where code = upper(trim(p_code)) for update;
  if not found or inv.used_at is not null or inv.expires_at < now() then
    raise exception 'invalid or expired code';
  end if;

  -- 서로 다른 코드 두 개가 동시에 수락돼 3명이 되는 경쟁을 커플 행 잠금으로 막는다
  perform 1 from public.couples where id = inv.couple_id for update;
  if (select count(*) from public.couple_members where couple_id = inv.couple_id) >= 2 then
    raise exception 'couple already full';
  end if;

  insert into public.couple_members (couple_id, user_id) values (inv.couple_id, auth.uid());
  update public.invites set used_at = now() where code = inv.code;
  return inv.couple_id;
end $$;

-- security definer 함수는 기본으로 PUBLIC(anon 포함)에 실행 권한이 열려 있다
revoke execute on function public.my_couple_id(), public.create_invite(), public.accept_invite(text), public.handle_new_user() from public, anon;
grant execute on function public.my_couple_id(), public.create_invite(), public.accept_invite(text) to authenticated;

alter table public.profiles       enable row level security;
alter table public.couples        enable row level security;
alter table public.couple_members enable row level security;
alter table public.invites        enable row level security;  -- 정책 없음 = 클라이언트 접근 차단
alter table public.events         enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid()
      or id in (select user_id from public.couple_members where couple_id = public.my_couple_id()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy couples_select on public.couples for select to authenticated
  using (id = public.my_couple_id());
create policy members_select on public.couple_members for select to authenticated
  using (couple_id = public.my_couple_id());

create policy events_select on public.events for select to authenticated
  using (couple_id = public.my_couple_id());
create policy events_insert on public.events for insert to authenticated
  with check (couple_id = public.my_couple_id() and created_by = auth.uid());
create policy events_update on public.events for update to authenticated
  using (couple_id = public.my_couple_id()) with check (couple_id = public.my_couple_id());
create policy events_delete on public.events for delete to authenticated
  using (couple_id = public.my_couple_id());

-- 상대가 일정을 남의 명의로 바꾸지 못하게 created_by 변경을 막고, updated_at을 갱신한다
create or replace function public.events_before_update()
returns trigger
language plpgsql
as $$
begin
  new.created_by := old.created_by;
  new.updated_at := now();
  return new;
end $$;

create trigger events_before_update
  before update on public.events
  for each row execute function public.events_before_update();

alter publication supabase_realtime add table public.events;
