-- cron과 Edge Function이 '같은 비밀값'을 각자 들고 있어야 하는 구조가 문제였다.
-- 한쪽만 바꾸거나 치환을 깜빡하면 함수는 403만 돌려주고, pg_cron은 그걸 실패로 치지 않아
-- 알림이 조용히 영원히 안 나간다 (실제로 그랬다).
-- 비밀값을 DB 한 곳에만 두고 양쪽이 그걸 읽게 바꾼다. 이제 맞출 것이 없다.

create table if not exists public.cron_secret (
  id boolean primary key default true check (id),  -- 행은 언제나 하나뿐
  -- pgcrypto는 extensions 스키마에 있어 search_path=public에서 안 보인다. 코어 함수만 써서 64자 hex를 만든다
  secret text not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  created_at timestamptz not null default now()
);

-- 정책 없음 = 클라이언트(anon/authenticated)는 못 읽는다. service_role과 DB 소유자만 본다
alter table public.cron_secret enable row level security;

insert into public.cron_secret (id) values (true) on conflict (id) do nothing;
