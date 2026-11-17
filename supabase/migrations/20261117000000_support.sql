-- 문의는 기존 커플 데이터와 별도로 저장한다. 관리자도 사진·일정에 대한 추가 권한을 받지 않는다.
begin;

-- 기존 데이터는 수정하지 않는다. 긴 이메일·빈 이름 때문에 신규 가입이 실패하지 않게 한다.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data->>'name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), nullif(btrim(new.email), '')), 20))
  on conflict (id) do nothing;
  return new;
end $$;

create table if not exists public.support_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.support_admins enable row level security;
revoke all on public.support_admins from public, anon, authenticated;
grant select (user_id) on public.support_admins to authenticated;
drop policy if exists support_admins_self on public.support_admins;
create policy support_admins_self on public.support_admins for select to authenticated
  using (user_id = (select auth.uid()));

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(btrim(subject)) between 1 and 100),
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  reply text check (reply is null or char_length(btrim(reply)) between 1 and 3000),
  created_at timestamptz not null default now(),
  replied_at timestamptz
);
create index if not exists support_tickets_user_created on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_created on public.support_tickets (created_at desc);
alter table public.support_tickets enable row level security;
revoke all on public.support_tickets from public, anon, authenticated;
grant select on public.support_tickets to authenticated;
grant insert (user_id, subject, body) on public.support_tickets to authenticated;
grant update (reply, replied_at) on public.support_tickets to authenticated;

drop policy if exists support_tickets_read on public.support_tickets;
create policy support_tickets_read on public.support_tickets for select to authenticated
  using (user_id = (select auth.uid()) or exists (
    select 1 from public.support_admins where user_id = (select auth.uid())
  ));
drop policy if exists support_tickets_create on public.support_tickets;
create policy support_tickets_create on public.support_tickets for insert to authenticated
  with check (user_id = (select auth.uid()) and reply is null and replied_at is null);
drop policy if exists support_tickets_reply on public.support_tickets;
create policy support_tickets_reply on public.support_tickets for update to authenticated
  using (exists (select 1 from public.support_admins where user_id = (select auth.uid())))
  with check (exists (select 1 from public.support_admins where user_id = (select auth.uid())));

commit;
