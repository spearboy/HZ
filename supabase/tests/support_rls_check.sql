-- Run on a test database after the support migration. Everything is rolled back.
begin;
insert into auth.users (id, email) values
  ('f341a2d0-9328-40b6-a130-000000000001', 'support-test-a@example.invalid'),
  ('f341a2d0-9328-40b6-a130-000000000002', 'support-test-b@example.invalid'),
  ('f341a2d0-9328-40b6-a130-000000000003', 'support-test-admin@example.invalid');
insert into public.support_admins (user_id) values ('f341a2d0-9328-40b6-a130-000000000003');

set local role authenticated;
set local request.jwt.claims = '{"sub":"f341a2d0-9328-40b6-a130-000000000001"}';
insert into public.support_tickets (user_id, subject, body) values (auth.uid(), 'test-a', 'test');
do $$ begin
  begin
    insert into public.support_admins (user_id) values (auth.uid());
    raise exception 'FAIL: user granted their own admin access';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.support_tickets (user_id, subject, body, reply) values (auth.uid(), 'test', 'test', 'forged');
    raise exception 'FAIL: user forged a reply';
  exception when insufficient_privilege then null; end;
end $$;

set local request.jwt.claims = '{"sub":"f341a2d0-9328-40b6-a130-000000000002"}';
insert into public.support_tickets (user_id, subject, body) values (auth.uid(), 'test-b', 'test');
do $$ begin
  if (select count(*) from public.support_tickets where subject in ('test-a', 'test-b')) <> 1 then
    raise exception 'FAIL: user can read another user’s inquiry';
  end if;
  update public.support_tickets set reply = 'forged' where subject = 'test-b';
  if found then raise exception 'FAIL: user updated a reply'; end if;
end $$;

set local request.jwt.claims = '{"sub":"f341a2d0-9328-40b6-a130-000000000003"}';
do $$ begin
  if (select count(*) from public.support_tickets where subject in ('test-a', 'test-b')) <> 2 then
    raise exception 'FAIL: admin cannot read inquiries';
  end if;
  if (select count(*) from public.photos) <> 0 then raise exception 'FAIL: support admin can read photos'; end if;
  update public.support_tickets set reply = 'answer', replied_at = now() where subject = 'test-a';
  if not found then raise exception 'FAIL: admin cannot reply'; end if;
  begin
    update public.support_tickets set body = 'modified' where subject = 'test-a';
    raise exception 'FAIL: admin modified user message';
  exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claims = '{"sub":"f341a2d0-9328-40b6-a130-000000000001"}';
do $$ begin
  if (select reply from public.support_tickets where subject = 'test-a') <> 'answer' then
    raise exception 'FAIL: user cannot read reply';
  end if;
end $$;
rollback;
select 'SUPPORT RLS CHECKS PASSED' as result;
