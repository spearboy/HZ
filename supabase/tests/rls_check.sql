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

-- SQL Editor는 notice를 안 보여 주고 마지막 결과만 보여 주므로 결과 행으로 남긴다
select 'ALL RLS CHECKS PASSED' as result;

rollback;
