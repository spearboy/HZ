-- 사람마다 고르는 일정 색상. 비어 있으면 화면이 기본색(나 분홍, 상대 파랑)을 쓴다
-- 수정 권한은 기존 profiles_update 정책(본인 행만)을 그대로 쓴다
alter table public.profiles
  add column color text check (color ~ '^#[0-9a-f]{6}$');

-- 상대가 색을 바꾸면 내 화면에도 바로 반영
alter publication supabase_realtime add table public.profiles;
