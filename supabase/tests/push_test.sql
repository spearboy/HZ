-- 푸시 알림 전체 경로 테스트 (cron → Edge Function → web-push → 기기).
-- SQL Editor에서 통째로 실행한다. 실제 알림이 커플 두 명의 기기로 간다.
-- 원리: 59분 뒤에 시작하는 일정을 넣으면 '시작 1시간 전' 알림이 '지금' 대상이 된다.

-- 1) 내 커플에 임시 일정 하나
insert into public.events (couple_id, created_by, title, start_at, all_day)
select m.couple_id, m.user_id, '푸시 테스트', now() + interval '59 minutes', false
from public.couple_members m
where m.couple_id = (select couple_id from public.couple_members group by couple_id having count(*) = 2 limit 1)
limit 1;

-- 2) cron이 10분마다 하는 호출을 지금 그대로 한 번 실행 (비밀값은 기존 작업에서 복사된다)
do $$
declare cmd text;
begin
  select command into cmd from cron.job where jobname = 'moro-reminders';
  if cmd is null then raise exception 'moro-reminders 작업이 없습니다. cron.sql을 먼저 실행하세요.'; end if;
  execute cmd;
end $$;

-- 3) 5초쯤 기다렸다가 아래를 따로 실행한다
--    status_code 200 + {"sent":2} 면 두 명에게 나간 것이다. 403이면 비밀값이 안 맞는다.
--
-- select status_code, content::text as response, created
-- from net._http_response order by id desc limit 3;
--
-- 4) 확인이 끝나면 임시 일정을 지운다
--
-- delete from public.events where title = '푸시 테스트';
