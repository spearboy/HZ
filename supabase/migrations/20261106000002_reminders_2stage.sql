-- 일정 알림을 두 가지로 바꾼다: 당일 아침 9시(KST)와 시작 1시간 전.
-- 7일/3일/1일 전 알림은 없앤다.
-- '1시간 전'을 맞추려면 하루 한 번으로는 부족해서 cron을 10분마다로 바꾼다 (supabase/cron.sql 참고).

-- 알림 종류가 바뀌므로 옛 기록과 옛 check 제약을 정리한다
delete from public.reminder_log where kind not in ('0d', '1h');

do $$
declare c text;
begin
  -- 처음 만들 때 이름을 안 준 check 제약(reminder_log_kind_check)을 이름에 기대지 않고 지운다
  for c in
    select conname from pg_constraint
    where conrelid = 'public.reminder_log'::regclass and contype = 'c'
  loop
    execute format('alter table public.reminder_log drop constraint %I', c);
  end loop;
end $$;

alter table public.reminder_log add constraint reminder_log_kind_check check (kind in ('0d', '1h'));

-- 10분마다 불린다는 전제로, 지금 막 지나간 10분 안에 때가 된 알림만 돌려준다.
-- reminder_log에 새로 꽂힌 행만 반환하므로 같은 알림이 두 번 나가지 않는다.
-- 창(window)은 cron 주기와 같아야 한다. 주기를 바꾸면 이 값도 바꿀 것.
create or replace function public.due_reminders()
returns table (recipient_id uuid, kind text, title text, start_at timestamptz, all_day boolean)
language sql security definer
set search_path = public
as $$
  with cand as (
    -- 자정 직후에 시작하는 일정은 '1시간 전'이 전날이라, 오늘과 내일 두 날을 함께 본다
    select e.id, e.all_day, e.couple_id, e.repeat_yearly, e.repeat_until_year,
           (now() at time zone 'Asia/Seoul') as now_kst,
           (now() at time zone 'Asia/Seoul')::date + d.n as day,
           (e.start_at at time zone 'Asia/Seoul') as start_kst
    from public.events e
    cross join (values (0), (1)) d(n)
  ), occ as (
    -- 그날 실제로 일어나는 일정만. 반복이면 올해(그해) 날짜로 옮겨서 본다. 2/29는 윤년에만 걸린다
    select c.*, (c.day + c.start_kst::time) as occ_kst
    from cand c
    where case when c.repeat_yearly
            then to_char(c.start_kst::date, 'MMDD') = to_char(c.day, 'MMDD')
                 and c.day >= c.start_kst::date
                 and (c.repeat_until_year is null or extract(year from c.day) <= c.repeat_until_year)
            else c.start_kst::date = c.day end
  ), due as (
    select o.id, o.couple_id, o.day as occurs_on, k.kind
    from occ o
    cross join (values ('0d'), ('1h')) k(kind)
    where (k.kind = '0d'
             and o.day = o.now_kst::date
             and o.now_kst >= o.day + time '09:00'
             and o.now_kst <  o.day + time '09:00' + interval '10 minutes')
       or (k.kind = '1h'
             and not o.all_day   -- 하루 종일 일정은 시작 시각이 없으니 아침 알림만
             and o.now_kst >= o.occ_kst - interval '1 hour'
             and o.now_kst <  o.occ_kst - interval '1 hour' + interval '10 minutes')
  ), ins as (
    insert into public.reminder_log (event_id, recipient_id, kind, occurs_on)
    select d.id, m.user_id, d.kind, d.occurs_on
    from due d
    join public.couple_members m on m.couple_id = d.couple_id
    on conflict do nothing
    returning event_id, recipient_id, kind
  )
  select ins.recipient_id, ins.kind, e.title, e.start_at, e.all_day
  from ins join public.events e on e.id = ins.event_id
$$;

revoke execute on function public.due_reminders() from public, anon, authenticated;
grant execute on function public.due_reminders() to service_role;
