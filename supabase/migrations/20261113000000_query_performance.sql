-- 앨범의 날짜/생성 시각/ID 커서와 디데이 조회를 지원한다.
create index if not exists photos_couple_album_order
  on public.photos (couple_id, photo_date desc, created_at desc, id desc);
create index if not exists events_couple_dday
  on public.events (couple_id) where dday;

-- 알림은 전체 일정을 순회하지 않고 오늘과 내일의 후보만 찾는다.
create index if not exists events_reminder_once
  on public.events (start_at) where not repeat_yearly;
create index if not exists events_reminder_yearly_day
  on public.events (((extract(month from start_at at time zone 'Asia/Seoul')::int * 100)
    + extract(day from start_at at time zone 'Asia/Seoul')::int)) where repeat_yearly;

create or replace function public.due_reminders()
returns table (recipient_id uuid, kind text, title text, start_at timestamptz, all_day boolean)
language sql security definer
set search_path = public
as $$
  with days as (
    select (now() at time zone 'Asia/Seoul') as now_kst,
           (now() at time zone 'Asia/Seoul')::date + d.n as day
    from (values (0), (1)) d(n)
  ), cand as (
    select e.id, e.all_day, e.couple_id, d.now_kst, d.day,
           (e.start_at at time zone 'Asia/Seoul') as start_kst
    from days d
    join public.events e on not e.repeat_yearly
      and e.start_at >= (d.day::timestamp at time zone 'Asia/Seoul')
      and e.start_at < ((d.day + 1)::timestamp at time zone 'Asia/Seoul')
    union all
    select e.id, e.all_day, e.couple_id, d.now_kst, d.day,
           (e.start_at at time zone 'Asia/Seoul') as start_kst
    from days d
    join public.events e on e.repeat_yearly
      and (extract(month from e.start_at at time zone 'Asia/Seoul')::int * 100
           + extract(day from e.start_at at time zone 'Asia/Seoul')::int)
          = (extract(month from d.day)::int * 100 + extract(day from d.day)::int)
      and d.day >= (e.start_at at time zone 'Asia/Seoul')::date
      and (e.repeat_until_year is null or extract(year from d.day) <= e.repeat_until_year)
  ), occ as (
    select c.*, (c.day + c.start_kst::time) as occ_kst from cand c
  ), due as (
    select o.id, o.couple_id, o.day as occurs_on, k.kind
    from occ o
    cross join (values ('0d'), ('1h')) k(kind)
    where (k.kind = '0d' and o.day = o.now_kst::date
             and o.now_kst >= o.day + time '09:00'
             and o.now_kst < o.day + time '09:00' + interval '10 minutes')
       or (k.kind = '1h' and not o.all_day
             and o.now_kst >= o.occ_kst - interval '1 hour'
             and o.now_kst < o.occ_kst - interval '1 hour' + interval '10 minutes')
  ), ins as (
    insert into public.reminder_log (event_id, recipient_id, kind, occurs_on)
    select d.id, m.user_id, d.kind, d.occurs_on
    from due d join public.couple_members m on m.couple_id = d.couple_id
    on conflict do nothing
    returning event_id, recipient_id, kind
  )
  select ins.recipient_id, ins.kind, e.title, e.start_at, e.all_day
  from ins join public.events e on e.id = ins.event_id
$$;

revoke execute on function public.due_reminders() from public, anon, authenticated;
grant execute on function public.due_reminders() to service_role;
