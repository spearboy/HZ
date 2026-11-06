-- 10분마다 알림을 확인한다 ('시작 1시간 전' 알림 때문에 하루 한 번으로는 부족하다).
-- 보낼 게 없으면 due_reminders()가 빈 결과를 돌려주므로 푸시는 나가지 않는다.
-- 주기를 바꾸면 due_reminders() 안의 interval '10 minutes'도 같이 바꿔야 한다.
-- 먼저 Database > Extensions에서 pg_cron, pg_net을 켠다.

-- ── A. 이미 알림 작업이 있는 프로젝트 (예전 daily-reminders에서 넘어올 때) ──────────────
-- 기존 작업의 명령을 그대로 복사하므로 CRON_SECRET을 다시 적을 필요가 없다.
do $$
declare cmd text;
begin
  select command into cmd from cron.job
  where jobname in ('daily-reminders', 'moro-reminders') order by jobid limit 1;
  if cmd is null then
    raise notice '기존 알림 작업이 없습니다. 아래 B를 쓰세요.';
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'daily-reminders') then
    perform cron.unschedule('daily-reminders');
  end if;
  if exists (select 1 from cron.job where jobname = 'moro-reminders') then
    perform cron.unschedule('moro-reminders');
  end if;
  perform cron.schedule('moro-reminders', '*/10 * * * *', cmd);
end $$;

-- ── B. 처음 만드는 프로젝트 ────────────────────────────────────────────────────────
-- 비밀값이 들어가므로 마이그레이션이 아니라 SQL Editor에서 직접 실행한다.
-- <CRON_SECRET>은 `supabase secrets set CRON_SECRET=...`에 넣은 값과 같아야 한다.
-- 위 A가 '기존 알림 작업이 없습니다'라고 하면 아래 주석을 풀고 실행한다.
--
-- select cron.schedule(
--   'moro-reminders',
--   '*/10 * * * *',
--   $job$
--   select net.http_post(
--     url := 'https://mnqzvqpmmpvvxrhbwvyc.supabase.co/functions/v1/hyper-endpoint',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
--     body := '{"type":"reminders"}'::jsonb
--   );
--   $job$
-- );

-- 확인: moro-reminders | */10 * * * * | t 가 나와야 한다
select jobname, schedule, active from cron.job;
