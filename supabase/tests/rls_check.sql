-- 계획서 6-3 RLS 체크리스트 (Phase 1 범위). 테스트 프로젝트의 SQL Editor에서 통째로 실행한다.
-- 전부 통과하면 마지막 결과에 'ALL RLS CHECKS PASSED'가 나오고, 맨 끝 rollback으로 테스트 데이터는 남지 않는다.
-- A, B = 한 커플 / C = 무관한 사용자 / D = 3번째 가입 시도자
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.local'),
  ('00000000-0000-0000-0000-00000000000d', 'd@test.local');


-- A: 초대 코드 생성, 일정 추가
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
select set_config('test.code1', public.create_invite(), true);
select set_config('test.code2', public.create_invite(), true);
insert into public.events (couple_id, created_by, title, start_at)
  values (public.my_couple_id(), auth.uid(), 'A 일정', now());
select set_config('test.couple', public.my_couple_id()::text, true);

-- A가 B 명의로 일정 추가 → 거부
do $$ begin
  insert into public.events (couple_id, created_by, title, start_at)
    values (public.my_couple_id(), '00000000-0000-0000-0000-00000000000b', 'x', now());
  raise exception 'FAIL: A가 B 명의로 insert 성공';
exception when insufficient_privilege then null; end $$;

-- 클라이언트에서 invites 직접 조회 → 0건
do $$ begin
  if (select count(*) from public.invites) <> 0 then raise exception 'FAIL: invites가 보임'; end if;
end $$;

-- B: 코드 수락
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
select public.accept_invite(current_setting('test.code1'));

do $$ begin
  if (select count(*) from public.events) <> 1 then raise exception 'FAIL: B가 커플 일정을 못 봄'; end if;
end $$;

-- 사용된 코드 재사용 → 거부 (이미 커플인 사용자 거부도 함께 확인)
do $$ begin
  perform public.accept_invite(current_setting('test.code1'));
  raise exception 'FAIL: 이미 커플인 B가 코드 수락 성공';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;

-- B가 A 일정의 created_by를 자기 것으로 바꿔도 트리거가 원래 값을 유지
update public.events set created_by = auth.uid(), title = 'B가 수정';
do $$ begin
  if (select created_by from public.events limit 1) <> '00000000-0000-0000-0000-00000000000a' then
    raise exception 'FAIL: created_by 변경됨';
  end if;
end $$;

-- 색상: B는 A의 색을 못 바꾸고, 형식이 틀린 색은 거부
update public.profiles set color = '#000000' where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if (select color from public.profiles where id = '00000000-0000-0000-0000-00000000000a') is not null then
    raise exception 'FAIL: B가 A의 색상을 바꿈';
  end if;
  begin
    update public.profiles set color = 'red' where id = auth.uid();
    raise exception 'FAIL: 잘못된 색상이 저장됨';
  exception when check_violation then null;
  end;
end $$;

-- C: 무관한 사용자
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
do $$ begin
  if (select count(*) from public.events) <> 0 then raise exception 'FAIL: C가 일정을 봄'; end if;
  if (select count(*) from public.couple_members) <> 0 then raise exception 'FAIL: C가 멤버를 봄'; end if;
  if (select count(*) from public.profiles where id <> auth.uid()) <> 0 then raise exception 'FAIL: C가 남의 프로필을 봄'; end if;
end $$;

do $$ begin
  insert into public.events (couple_id, created_by, title, start_at)
    values (current_setting('test.couple')::uuid, auth.uid(), 'x', now());
  raise exception 'FAIL: C가 남의 커플에 insert 성공';
exception when insufficient_privilege then null; end $$;

do $$ begin
  update public.events set title = 'C가 수정';
  delete from public.events;
end $$;
-- 위 update/delete는 RLS 때문에 0행에 적용돼야 한다 (아래 A 확인에서 검증)

-- 만료된/없는 코드 → 거부
do $$ begin
  perform public.accept_invite('ZZZZZZZZ');
  raise exception 'FAIL: 없는 코드 수락 성공';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;

-- D: 꽉 찬 커플의 남은 코드로 3번째 가입 → 거부
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d"}';
do $$ begin
  perform public.accept_invite(current_setting('test.code2'));
  raise exception 'FAIL: 3번째 사용자 가입 성공';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;

-- 로그인 안 한 사용자(anon)는 RPC 실행 불가
reset role;
set local role anon;
do $$ begin
  perform public.create_invite();
  raise exception 'FAIL: anon이 create_invite 실행';
exception when insufficient_privilege then null; end $$;

-- A: C의 update/delete가 반영되지 않았는지 확인
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
do $$ begin
  if (select title from public.events limit 1) is distinct from 'B가 수정' then
    raise exception 'FAIL: C의 수정/삭제가 반영됨';
  end if;
end $$;

-- ===== 20261029000001_features.sql 범위 =====

-- A: 찌르기 하루 1회, 사진/구독 기록
select public.send_poke();
do $$ begin
  perform public.send_poke();
  raise exception 'FAIL: 같은 날 두 번 찌르기 성공';
exception when unique_violation then null; end $$;

insert into public.photos (couple_id, uploaded_by, photo_date, storage_path, thumb_path)
  values (public.my_couple_id(), auth.uid(), current_date, public.my_couple_id() || '/x.jpg', public.my_couple_id() || '/t.jpg');
insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values ('https://push.test/a', auth.uid(), 'k', 'a');

do $$ begin
  insert into public.photos (couple_id, uploaded_by, photo_date, storage_path, thumb_path)
    values (public.my_couple_id(), '00000000-0000-0000-0000-00000000000b', current_date, public.my_couple_id() || '/y.jpg', public.my_couple_id() || '/y.jpg');
  raise exception 'FAIL: A가 B 명의로 사진 insert 성공';
exception when insufficient_privilege then null; end $$;

do $$ begin
  insert into public.photos (couple_id, uploaded_by, photo_date, storage_path, thumb_path)
    values (public.my_couple_id(), auth.uid(), current_date, 'other-couple/z.jpg', 'other-couple/z.jpg');
  raise exception 'FAIL: 남의 경로로 사진 insert 성공';
exception when insufficient_privilege then null; end $$;

do $$ begin
  perform public.due_reminders();
  raise exception 'FAIL: 사용자가 due_reminders 실행';
exception when insufficient_privilege then null; end $$;

do $$ begin
  if (select count(*) from public.reminder_log) <> 0 then raise exception 'FAIL: reminder_log가 보임'; end if;
end $$;

-- B: 상대 사진은 보이고, 상대 구독/사진 삭제는 안 된다
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
do $$ begin
  if (select count(*) from public.photos) <> 1 then raise exception 'FAIL: B가 커플 사진을 못 봄'; end if;
  if (select count(*) from public.pokes) <> 1 then raise exception 'FAIL: B가 받은 찌르기를 못 봄'; end if;
  if (select count(*) from public.push_subscriptions) <> 0 then raise exception 'FAIL: B가 A의 구독을 봄'; end if;
  delete from public.photos;
  if (select count(*) from public.photos) <> 1 then raise exception 'FAIL: B가 A의 사진을 삭제함'; end if;
end $$;

-- C: 아무것도 안 보인다
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c"}';
do $$ begin
  if (select count(*) from public.photos) <> 0 then raise exception 'FAIL: C가 사진을 봄'; end if;
  if (select count(*) from public.pokes) <> 0 then raise exception 'FAIL: C가 찌르기를 봄'; end if;
  if (select count(*) from public.push_subscriptions) <> 0 then raise exception 'FAIL: C가 구독을 봄'; end if;
end $$;

-- 알림: 오늘/내일/7일 뒤 일정은 두 명에게 각 1번만, 2일 뒤 일정은 대상 아님
reset role;
insert into public.events (couple_id, created_by, title, start_at)
select current_setting('test.couple')::uuid, '00000000-0000-0000-0000-00000000000a', t, now() + d * interval '1 day'
from (values ('r0', 0), ('r1', 1), ('r2', 2), ('r7', 7)) v(t, d);
delete from public.reminder_log;
do $$ begin
  -- 테스트 일정 3개(r0, r1, r7) x 2명 = 6. 'B가 수정' 일정(오늘)도 대상이라 +2
  if (select count(*) from public.due_reminders() where title in ('r0', 'r1', 'r2', 'r7', 'B가 수정')) <> 8 then
    raise exception 'FAIL: 알림 대상 수가 틀림';
  end if;
  if (select count(*) from public.due_reminders()) <> 0 then raise exception 'FAIL: 알림 중복 발송'; end if;
end $$;

-- 매년 반복: 작년 3일 뒤 날짜로 시작한 일정은 올해도 알림, 반복이 작년에 끝난 일정은 알림 없음
insert into public.events (couple_id, created_by, title, start_at, repeat_yearly, repeat_until_year)
values
  (current_setting('test.couple')::uuid, '00000000-0000-0000-0000-00000000000a', 'y3', now() + interval '3 days' - interval '1 year', true, null),
  (current_setting('test.couple')::uuid, '00000000-0000-0000-0000-00000000000a', 'yold', now() + interval '3 days' - interval '2 years', true,
   extract(year from now() at time zone 'Asia/Seoul')::int - 1);
do $$ begin
  if (select count(*) from public.due_reminders() where title in ('y3', 'yold')) <> 2 then
    raise exception 'FAIL: 반복 일정 알림 대상이 틀림';
  end if;
end $$;

-- 종료일이 시작보다 빠르거나, 반복 없이 종료 연도만 있으면 거부
do $$ begin
  begin
    insert into public.events (couple_id, created_by, title, start_at, end_date)
    values (current_setting('test.couple')::uuid, '00000000-0000-0000-0000-00000000000a', 'bad', now(), current_date - 5);
    raise exception 'FAIL: 종료일이 시작보다 빠른 일정이 들어감';
  exception when check_violation then null;
  end;
  begin
    insert into public.events (couple_id, created_by, title, start_at, repeat_until_year)
    values (current_setting('test.couple')::uuid, '00000000-0000-0000-0000-00000000000a', 'bad', now(), 2030);
    raise exception 'FAIL: 반복 없이 종료 연도가 들어감';
  exception when check_violation then null;
  end;
end $$;

-- 연결 끊기: 둘 다 끊기고 데이터는 안 보인다. 같은 상대와 다시 연결하면 예전 커플로 복귀
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a"}';
do $$ begin
  if (select count(*) from public.former_members) <> 0 then raise exception 'FAIL: former_members가 보임'; end if;
end $$;
select public.leave_couple();
do $$ begin
  if public.my_couple_id() is not null then raise exception 'FAIL: 끊은 뒤에도 커플'; end if;
  if (select count(*) from public.events) <> 0 then raise exception 'FAIL: 끊은 뒤 일정이 보임'; end if;
end $$;
select set_config('test.code3', public.create_invite(), true);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b"}';
do $$ begin
  if public.my_couple_id() is not null then raise exception 'FAIL: 상대 쪽 연결이 안 끊김'; end if;
  if public.accept_invite(current_setting('test.code3')) <> current_setting('test.couple')::uuid then
    raise exception 'FAIL: 예전 커플로 복귀 안 됨';
  end if;
  if (select count(*) from public.couple_members) <> 2 then raise exception 'FAIL: 복귀 후 멤버 수가 틀림'; end if;
  if (select count(*) from public.events) = 0 then raise exception 'FAIL: 복귀 후 예전 일정이 안 보임'; end if;
end $$;
reset role;

-- SQL Editor는 notice를 안 보여 주고 마지막 결과만 보여 주므로 결과 행으로 남긴다
select 'ALL RLS CHECKS PASSED' as result;

rollback;
