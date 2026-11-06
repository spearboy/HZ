-- 시간표: 일정이 끝나는 시각.
-- Phase 1(20261029000000)에서 만들어 두고 쓰지 않던 events.end_at 칸을 그대로 쓴다. 새 칸을 만들지 않는다
alter table public.events drop constraint if exists events_end_at_after_start;
alter table public.events add constraint events_end_at_after_start
  check (end_at is null or end_at > start_at);
