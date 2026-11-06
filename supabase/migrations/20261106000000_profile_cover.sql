-- 닉네임 길이 제한, 프로필 사진, 메인 카드 배경 사진
-- 위치/확대는 숫자 컬럼으로만 받는다 (CSS 문자열을 그대로 저장하면 클라이언트가 보낸 값이 스타일로 들어간다)

-- 닉네임: 제약을 걸기 전에 기존 값을 먼저 손본다 (가입 시 이메일이 들어갔을 수 있다)
update public.profiles set display_name = null where display_name is not null and btrim(display_name) = '';
update public.profiles set display_name = left(display_name, 20) where char_length(display_name) > 20;

alter table public.profiles drop constraint if exists profiles_name_len;
alter table public.profiles add constraint profiles_name_len
  check (display_name is null or char_length(btrim(display_name)) between 1 and 20);

alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists avatar_zoom real not null default 1,
  add column if not exists avatar_x    real not null default 50,
  add column if not exists avatar_y    real not null default 50;

alter table public.profiles
  drop constraint if exists profiles_avatar_zoom_range,
  drop constraint if exists profiles_avatar_x_range,
  drop constraint if exists profiles_avatar_y_range;
alter table public.profiles
  add constraint profiles_avatar_zoom_range check (avatar_zoom between 1 and 4),
  add constraint profiles_avatar_x_range    check (avatar_x between 0 and 100),
  add constraint profiles_avatar_y_range    check (avatar_y between 0 and 100);

alter table public.couples
  add column if not exists cover_path text,
  add column if not exists cover_zoom real not null default 1,
  add column if not exists cover_x    real not null default 50,
  add column if not exists cover_y    real not null default 50;

alter table public.couples
  drop constraint if exists couples_cover_zoom_range,
  drop constraint if exists couples_cover_x_range,
  drop constraint if exists couples_cover_y_range;
alter table public.couples
  add constraint couples_cover_zoom_range check (cover_zoom between 1 and 4),
  add constraint couples_cover_x_range    check (cover_x between 0 and 100),
  add constraint couples_cover_y_range    check (cover_y between 0 and 100);

-- couples는 컬럼 단위로만 열려 있다 (20261030000003_dday.sql). 배경 칸도 같은 방식으로 추가한다
grant update (cover_path, cover_zoom, cover_x, cover_y) on public.couples to authenticated;

-- 파일은 사진과 같은 photos 버킷의 {couple_id}/ 아래 두므로 기존 Storage 정책이 그대로 적용된다.
-- ponytail: 다른 상대와 새로 연결하면 couple_id가 달라져 옛 경로를 못 읽는다. 그때는 사진을 다시 올린다.
