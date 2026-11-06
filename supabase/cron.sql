-- 10분마다 알림을 확인한다 ('시작 1시간 전' 알림 때문에 하루 한 번으로는 부족하다).
-- 보낼 게 없으면 due_reminders()가 빈 결과를 돌려주므로 푸시는 나가지 않는다.
-- 주기를 바꾸면 due_reminders() 안의 interval '10 minutes'도 같이 바꿔야 한다.
-- 비밀값이 들어가므로 마이그레이션이 아니라 SQL Editor에서 직접 실행한다.
-- 먼저 Database > Extensions에서 pg_cron, pg_net을 켠다.
-- <CRON_SECRET>은 `supabase secrets set CRON_SECRET=...`에 넣은 값과 같아야 한다.

-- 전에 만든 하루 1회 작업이 있으면 지운다 (없으면 그냥 넘어간다)
select cron.unschedule('daily-reminders') where exists (select 1 from cron.job where jobname = 'daily-reminders');
select cron.unschedule('moro-reminders')  where exists (select 1 from cron.job where jobname = 'moro-reminders');

select cron.schedule(
  'moro-reminders',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://mnqzvqpmmpvvxrhbwvyc.supabase.co/functions/v1/hyper-endpoint',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{"type":"reminders"}'::jsonb
  );
  $$
);
