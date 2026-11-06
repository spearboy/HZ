-- 10분마다 알림을 확인한다 ('시작 1시간 전' 알림 때문에 하루 한 번으로는 부족하다).
-- 보낼 게 없으면 due_reminders()가 빈 결과를 돌려주므로 푸시는 나가지 않는다.
-- 주기를 바꾸면 due_reminders() 안의 interval '10 minutes'도 같이 바꿔야 한다.
-- 먼저 Database > Extensions에서 pg_cron, pg_net을 켠다.
--
-- 비밀값은 public.cron_secret 테이블에만 있고(20261106000003), 아래 명령과 Edge Function이
-- 둘 다 그걸 읽는다. 그래서 맞출 값이 없고, 치환을 깜빡해서 조용히 403만 나는 일도 없다.

select cron.unschedule('daily-reminders') where exists (select 1 from cron.job where jobname = 'daily-reminders');
select cron.unschedule('moro-reminders')  where exists (select 1 from cron.job where jobname = 'moro-reminders');

select cron.schedule(
  'moro-reminders',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url := 'https://mnqzvqpmmpvvxrhbwvyc.supabase.co/functions/v1/hyper-endpoint',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select secret from public.cron_secret limit 1)
    ),
    body := '{"type":"reminders"}'::jsonb
  );
  $job$
);

-- 확인 1: moro-reminders | */10 * * * * | t
select jobname, schedule, active from cron.job;

-- 확인 2: 몇 분 뒤 다시 돌려 본다
--   200 {"sent":0} = 정상, 지금은 보낼 알림이 없다
--   200 {"sent":N} = N명에게 보냈다
--   403           = cron_secret 테이블이 없거나 함수가 옛 버전이다
select status_code, content::text as response, created
from net._http_response order by id desc limit 5;
