-- 기간 일정(며칠~며칠)과 매년 반복(몇 년도까지)

alter table public.events
  add column if not exists end_date date,
  add column if not exists repeat_yearly boolean not null default false,
  add column if not exists repeat_until_year smallint;

-- 제약은 '있으면 지우고 다시' 로 걸어야 재실행해도 멈추지 않는다
alter table public.events
  drop constraint if exists events_end_after_start,
  drop constraint if exists events_until_needs_repeat;
alter table public.events
  add constraint events_end_after_start check (end_date is null or end_date >= (start_at at time zone 'Asia/Seoul')::date),
  add constraint events_until_needs_repeat check (repeat_until_year is null or repeat_yearly);

-- 반복 일정은 해마다 알림이 가야 하므로 발생 날짜까지 키에 넣는다
alter table public.reminder_log add column if not exists occurs_on date;
update public.reminder_log r set occurs_on = (e.start_at at time zone 'Asia/Seoul')::date
from public.events e where e.id = r.event_id and r.occurs_on is null;
-- 짝이 없어 값을 못 채운 기록은 지워야 not null을 걸 수 있다 (알림 기록이라 지워도 안전하다)
delete from public.reminder_log where occurs_on is null;

alter table public.reminder_log alter column occurs_on set not null;
alter table public.reminder_log drop constraint if exists reminder_log_pkey;
alter table public.reminder_log add primary key (event_id, recipient_id, kind, occurs_on);

-- 오늘(KST) 기준 7/3/1/0일 뒤에 (반복이면 그해의 같은 월/일에) 시작하는 일정 x 커플 두 명. 새로 기록된 것만 돌려준다
-- 2/29 반복은 윤년에만 잡힌다 (화면과 같은 규칙)
create or replace function public.due_reminders()
returns table (recipient_id uuid, kind text, title text, start_at timestamptz, all_day boolean)
language sql security definer
set search_path = public
as $$
  with due as (
    select e.id, m.user_id, d.n || 'd' as kind, t.day as occurs_on
    from public.events e
    join public.couple_members m on m.couple_id = e.couple_id
    cross join (values (0), (1), (3), (7)) d(n)
    cross join lateral (select (now() at time zone 'Asia/Seoul')::date + d.n as day,
                               (e.start_at at time zone 'Asia/Seoul')::date as start_day) t
    where case when e.repeat_yearly then
        to_char(t.start_day, 'MMDD') = to_char(t.day, 'MMDD')
        and t.day >= t.start_day
        and (e.repeat_until_year is null or extract(year from t.day) <= e.repeat_until_year)
      else t.start_day = t.day end
  ), ins as (
    insert into public.reminder_log (event_id, recipient_id, kind, occurs_on)
    select id, user_id, kind, occurs_on from due
    on conflict do nothing
    returning event_id, recipient_id, kind
  )
  select ins.recipient_id, ins.kind, e.title, e.start_at, e.all_day
  from ins join public.events e on e.id = ins.event_id
$$;

revoke execute on function public.due_reminders() from public, anon, authenticated;
grant execute on function public.due_reminders() to service_role;
