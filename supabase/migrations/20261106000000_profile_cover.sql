-- 닉네임 길이 제한, 프로필 사진, 메인 카드 배경 사진
-- 위치/확대는 숫자 컬럼으로만 받는다 (CSS 문자열을 그대로 저장하면 클라이언트가 보낸 값이 스타일로 들어간다)

-- 닉네임: 기존 값(가입 시 이메일이 들어갔을 수 있다)을 먼저 줄이고 제약을 건다
update public.profiles set display_name = left(display_name, 20) where char_length(display_name) > 20;
alter table public.profiles
  add constraint profiles_name_len check (display_name is null or char_length(btrim(display_name)) between 1 and 20),
  add column avatar_path text,
  add column avatar_zoom real not null default 1 check (avatar_zoom between 1 and 4),
  add column avatar_x    real not null default 50 check (avatar_x between 0 and 100),
  add column avatar_y    real not null default 50 check (avatar_y between 0 and 100);

alter table public.couples
  add column cover_path text,
  add column cover_zoom real not null default 1 check (cover_zoom between 1 and 4),
  add column cover_x    real not null default 50 check (cover_x between 0 and 100),
  add column cover_y    real not null default 50 check (cover_y between 0 and 100);

-- couples는 컬럼 단위로만 열려 있다 (20261030000003_dday.sql). 배경 칸도 같은 방식으로 추가한다
grant update (cover_path, cover_zoom, cover_x, cover_y) on public.couples to authenticated;

-- 파일은 사진과 같은 photos 버킷의 {couple_id}/ 아래 두므로 기존 Storage 정책이 그대로 적용된다.
-- ponytail: 다른 상대와 새로 연결하면 couple_id가 달라져 옛 경로를 못 읽는다. 그때는 사진을 다시 올린다.
