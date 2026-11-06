-- 10분마다 알림을 확인한다 ('시작 1시간 전' 알림 때문에 하루 한 번으로는 부족하다).
-- 보낼 게 없으면 due_reminders()가 빈 결과를 돌려주므로 푸시는 나가지 않는다.
-- 주기를 바꾸면 due_reminders() 안의 interval '10 minutes'도 같이 바꿔야 한다.
-- 먼저 Database > Extensions에서 pg_cron, pg_net을 켠다.

-- ── A. 이미 알림 작업이 있을 때 (주기만 옮기고 싶을 때) ────────────────────────────
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

-- ── B. 처음 만들 때 ────────────────────────────────────────────────────────────────
-- <CRON_SECRET> 두 글자를 `supabase secrets set CRON_SECRET=...`에 넣은 값과 똑같이 바꾼다.
-- 아래 주석을 풀고 실행한다.
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

-- ── 안전장치 ──────────────────────────────────────────────────────────────────────
-- 치환을 깜빡하면 함수가 403만 돌려주고 알림은 조용히 영원히 안 나간다.
-- 그래서 자리표시자가 남아 있으면 작업을 지우고 바로 실패시킨다.
do $$ begin
  if exists (select 1 from cron.job where jobname = 'moro-reminders' and command like '%<CRON_SECRET>%') then
    perform cron.unschedule('moro-reminders');
    raise exception '<CRON_SECRET>를 실제 값으로 바꾸지 않았습니다. 작업을 만들지 않았습니다.';
  end if;
end $$;

-- 확인 1: moro-reminders | */10 * * * * | t 가 나와야 한다
select jobname, schedule, active from cron.job;

-- 확인 2: 몇 분 뒤 다시 돌려 본다. status_code가 200이어야 정상이다.
--   403 = x-cron-secret과 Edge Function의 CRON_SECRET이 다르다
--   200 {"sent":0} = 정상 동작, 지금은 보낼 알림이 없다는 뜻
select status_code, content::text as response, created
from net._http_response order by id desc limit 5;
