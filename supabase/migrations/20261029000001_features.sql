-- Phase 2~4 (웹): 사진, 찌르기, .ics 가져오기, Web Push 알림

-- .ics 가져오기: 같은 사람이 같은 일정을 두 번 가져오지 못하게 한다 (NULL은 서로 달라서 직접 만든 일정은 영향 없음)
alter table public.events
  add column source text not null default 'manual' check (source in ('manual', 'ics')),
  add column source_uid text;
create unique index events_source_dedupe on public.events (couple_id, created_by, source_uid);

-- 사진
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  photo_date date not null,
  storage_path text not null,
  thumb_path text not null,
  created_at timestamptz not null default now()
);
create index photos_couple_date on public.photos (couple_id, photo_date);

alter table public.photos enable row level security;
create policy photos_select on public.photos for select to authenticated
  using (couple_id = public.my_couple_id());
create policy photos_insert on public.photos for insert to authenticated
  with check (couple_id = public.my_couple_id() and uploaded_by = auth.uid()
    and storage_path like public.my_couple_id()::text || '/%'
    and thumb_path like public.my_couple_id()::text || '/%');
create policy photos_delete on public.photos for delete to authenticated
  using (uploaded_by = auth.uid());

-- 사진 버킷: 비공개, JPEG만 (클라이언트가 리사이즈 후 JPEG로 올린다), 10MB 제한
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg']);

-- 경로 첫 폴더가 내 couple_id일 때만 읽기/쓰기, 삭제는 올린 사람만
create policy photos_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_couple_id()::text);
create policy photos_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = public.my_couple_id()::text);
create policy photos_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and owner_id = auth.uid()::text);

-- 찌르기: 하루 1회는 유니크 제약으로 보장 (KST 날짜 기준)
create table public.pokes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  receiver_id uuid not null references auth.users(id),
  poke_date date not null default ((now() at time zone 'Asia/Seoul')::date),
  created_at timestamptz not null default now(),
  unique (sender_id, poke_date)
);

alter table public.pokes enable row level security;
create policy pokes_select on public.pokes for select to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());

-- 상대는 서버에서 정한다. 오늘 이미 찔렀으면 unique_violation(23505)
create or replace function public.send_poke()
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  cid uuid := public.my_couple_id();
  partner uuid;
begin
  if cid is null then raise exception 'no couple'; end if;
  select user_id into partner from public.couple_members where couple_id = cid and user_id <> auth.uid();
  if partner is null then raise exception 'no partner yet'; end if;

  insert into public.pokes (couple_id, sender_id, receiver_id) values (cid, auth.uid(), partner);
  return partner;
end $$;

-- Web Push 구독 (브라우저/기기마다 하나)
create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 알림 발송 기록 (중복 방지). 정책 없음 = 서버(service role)만
create table public.reminder_log (
  event_id uuid not null references public.events(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('7d', '3d', '1d', '0d')),
  sent_at timestamptz not null default now(),
  primary key (event_id, recipient_id, kind)
);
alter table public.reminder_log enable row level security;

-- 오늘(KST) 기준 정확히 7/3/1/0일 뒤 시작하는 일정 x 커플 두 명. 새로 기록된 것만 돌려줘서 중복 발송을 막는다
create or replace function public.due_reminders()
returns table (recipient_id uuid, kind text, title text, start_at timestamptz, all_day boolean)
language sql security definer
set search_path = public
as $$
  with due as (
    select e.id, m.user_id, (((e.start_at at time zone 'Asia/Seoul')::date - (now() at time zone 'Asia/Seoul')::date) || 'd') as kind
    from public.events e
    join public.couple_members m on m.couple_id = e.couple_id
    where ((e.start_at at time zone 'Asia/Seoul')::date - (now() at time zone 'Asia/Seoul')::date) in (7, 3, 1, 0)
  ), ins as (
    insert into public.reminder_log (event_id, recipient_id, kind)
    select id, user_id, kind from due
    on conflict do nothing
    returning event_id, recipient_id, kind
  )
  select ins.recipient_id, ins.kind, e.title, e.start_at, e.all_day
  from ins join public.events e on e.id = ins.event_id
$$;

-- 일정 날짜가 바뀌면 새 날짜 기준으로 다시 알림이 가게 기록을 지운다 (reminder_log는 RLS로 막혀 있어 definer 필요)
create or replace function public.events_before_update()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  new.created_by := old.created_by;
  new.updated_at := now();
  if (new.start_at at time zone 'Asia/Seoul')::date <> (old.start_at at time zone 'Asia/Seoul')::date then
    delete from public.reminder_log where event_id = old.id;
  end if;
  return new;
end $$;

-- Supabase는 새 함수에 anon/authenticated 실행 권한을 기본으로 준다
revoke execute on function public.send_poke() from public, anon;
grant execute on function public.send_poke() to authenticated;
revoke execute on function public.due_reminders() from public, anon, authenticated;
grant execute on function public.due_reminders() to service_role;

alter publication supabase_realtime add table public.photos, public.pokes;
