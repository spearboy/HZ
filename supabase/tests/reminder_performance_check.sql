-- 테스트 프로젝트에서 마이그레이션 적용 후 실행한다. 실제 알림을 보내지 않으며 끝에 롤백한다.
-- 기존 후보 조건을 기준으로 새 함수의 기록을 비교한다.
begin;
insert into auth.users (id, email) values ('e9385aca-0521-4b2c-b232-7e004a916001', 'r@test.local');
insert into public.couples (id) values ('e9385aca-0521-4b2c-b232-7e004a916002');
insert into public.couple_members (couple_id, user_id)
values ('e9385aca-0521-4b2c-b232-7e004a916002', 'e9385aca-0521-4b2c-b232-7e004a916001');

insert into public.events (id, couple_id, created_by, title, start_at, all_day, repeat_yearly, repeat_until_year)
select ('e9385aca-0521-4b2c-b232-' || lpad(n::text, 12, '0'))::uuid,
       'e9385aca-0521-4b2c-b232-7e004a916002', 'e9385aca-0521-4b2c-b232-7e004a916001',
       'reminder test ' || n, start_at, all_day, yearly, until_year
from (values
  (1, now() + interval '59 minutes', false, false, null::smallint),
  (2, now() + interval '59 minutes' - interval '1 year', false, true, null::smallint),
  (3, now() + interval '59 minutes' + interval '1 year', false, true, null::smallint),
  (4, now() + interval '59 minutes' - interval '1 year', false, true, 2000::smallint),
  (5, now() + interval '59 minutes', true, false, null::smallint),
  (6, now() - interval '2 days', false, false, null::smallint),
  (7, '2024-02-29 03:00:00+00'::timestamptz, false, true, null::smallint)
) as samples(n, start_at, all_day, yearly, until_year);

create temporary table expected_reminders on commit drop as
with cand as (
  select e.*, (now() at time zone 'Asia/Seoul') as now_kst,
         (now() at time zone 'Asia/Seoul')::date + d.n as day,
         (e.start_at at time zone 'Asia/Seoul') as start_kst
  from public.events e cross join (values (0), (1)) d(n)
  where e.couple_id = 'e9385aca-0521-4b2c-b232-7e004a916002'
), occ as (
  select c.*, c.day + c.start_kst::time as occ_kst from cand c
  where case when c.repeat_yearly
    then to_char(c.start_kst::date, 'MMDD') = to_char(c.day, 'MMDD')
      and c.day >= c.start_kst::date
      and (c.repeat_until_year is null or extract(year from c.day) <= c.repeat_until_year)
    else c.start_kst::date = c.day end
)
select o.id as event_id, k.kind, o.day as occurs_on
from occ o cross join (values ('0d'), ('1h')) k(kind)
where (k.kind = '0d' and o.day = o.now_kst::date and o.now_kst >= o.day + time '09:00'
       and o.now_kst < o.day + time '09:00' + interval '10 minutes')
   or (k.kind = '1h' and not o.all_day and o.now_kst >= o.occ_kst - interval '1 hour'
       and o.now_kst < o.occ_kst - interval '1 hour' + interval '10 minutes');

select count(*) from public.due_reminders();
do $$
begin
  if exists (
    (select event_id, kind, occurs_on from expected_reminders
     except select event_id, kind, occurs_on from public.reminder_log where recipient_id = 'e9385aca-0521-4b2c-b232-7e004a916001')
    union all
    (select event_id, kind, occurs_on from public.reminder_log where recipient_id = 'e9385aca-0521-4b2c-b232-7e004a916001'
     except select event_id, kind, occurs_on from expected_reminders)
  ) then raise exception '알림 후보가 기존 조건과 다릅니다'; end if;
end $$;
select 'REMINDER CHECK PASSED' as result;
rollback;
