-- 푸시 알림 전체 경로 테스트 (cron → Edge Function → web-push → 기기).
-- 실제 알림이 커플 두 명의 기기로 간다.
-- 원리: 59분 뒤에 시작하는 일정을 넣으면 '시작 1시간 전' 알림이 '지금' 대상이 된다.

-- 1) 커플에 임시 일정 하나
insert into public.events (couple_id, created_by, title, start_at, all_day)
select m.couple_id, m.user_id, '푸시 테스트', now() + interval '59 minutes', false
from public.couple_members m
where m.couple_id = (select couple_id from public.couple_members group by couple_id having count(*) = 2 limit 1)
limit 1;

-- 2) cron이 하는 호출을 지금 한 번 실행.
--    주의: 여기서 due_reminders()를 먼저 불러 보면 안 된다. '새로 기록된 것만' 돌려주는 함수라
--    미리 부르면 Edge Function이 받을 게 없어져서 {"sent":0}이 나온다.
do $$
declare cmd text;
begin
  select command into cmd from cron.job where jobname = 'moro-reminders';
  if cmd is null then raise exception 'moro-reminders 작업이 없습니다. cron.sql을 먼저 실행하세요.'; end if;
  execute cmd;
end $$;

-- 3) 5~10초 기다렸다가 따로 실행 → 200 + {"sent":2} 면 성공
-- select status_code, content::text as response, created
-- from net._http_response order by id desc limit 3;

-- 4) 확인 후 정리
-- delete from public.events where title = '푸시 테스트';
