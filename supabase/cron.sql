-- 매일 09:00 KST(= 00:00 UTC)에 일정 알림을 보낸다. 비밀값이 들어가므로 마이그레이션이 아니라 SQL Editor에서 직접 실행한다.
-- 먼저 Database > Extensions에서 pg_cron, pg_net을 켠다.
-- <CRON_SECRET>은 `supabase secrets set CRON_SECRET=...`에 넣은 값과 같아야 한다.
select cron.schedule(
  'daily-reminders',
  '0 0 * * *',
  $$
  select net.http_post(
    url := 'https://mnqzvqpmmpvvxrhbwvyc.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{"type":"reminders"}'::jsonb
  );
  $$
);
