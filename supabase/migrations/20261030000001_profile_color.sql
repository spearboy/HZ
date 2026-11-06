-- 사람마다 고르는 일정 색상. 비어 있으면 화면이 기본색(나 분홍, 상대 파랑)을 쓴다
-- 수정 권한은 기존 profiles_update 정책(본인 행만)을 그대로 쓴다
alter table public.profiles add column if not exists color text;

alter table public.profiles drop constraint if exists profiles_color_format;
alter table public.profiles add constraint profiles_color_format check (color is null or color ~ '^#[0-9a-f]{6}$');

-- 상대가 색을 바꾸면 내 화면에도 바로 반영
do $$ begin
  -- 셀프호스트 등 supabase_realtime publication 자체가 없을 수도 있다
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
     ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
