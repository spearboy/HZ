-- 디데이: 커플 사귄 날 + 일정별 디데이 표시

alter table public.couples add column started_on date;
alter table public.events add column dday boolean not null default false;

-- 커플 행은 사귄 날만 바꿀 수 있다 (id 등은 그대로)
revoke update on public.couples from authenticated;
grant update (started_on) on public.couples to authenticated;
create policy couples_update on public.couples for update to authenticated
  using (id = public.my_couple_id()) with check (id = public.my_couple_id());

-- 상대가 사귄 날을 바꾸면 내 홈에도 바로 반영
alter publication supabase_realtime add table public.couples;
