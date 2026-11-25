-- Run after the dashboard migration; all fixtures and changes are rolled back.
begin;
insert into auth.users (id, email) values
 ('f341a2d0-9328-40b6-a130-000000000011', 'dashboard-test-a@example.invalid'),
 ('f341a2d0-9328-40b6-a130-000000000012', 'dashboard-test-b@example.invalid'),
 ('f341a2d0-9328-40b6-a130-000000000013', 'dashboard-test-admin@example.invalid');
insert into public.support_admins (user_id) values ('f341a2d0-9328-40b6-a130-000000000013');
insert into public.couples (id) values ('f341a2d0-9328-40b6-a130-000000000014');
insert into public.couple_members (couple_id, user_id) values
 ('f341a2d0-9328-40b6-a130-000000000014', 'f341a2d0-9328-40b6-a130-000000000011'),
 ('f341a2d0-9328-40b6-a130-000000000014', 'f341a2d0-9328-40b6-a130-000000000012');
insert into public.events (couple_id, created_by, title, start_at) values
 ('f341a2d0-9328-40b6-a130-000000000014', 'f341a2d0-9328-40b6-a130-000000000011', 'private event', now());
insert into public.photos (couple_id, uploaded_by, photo_date, storage_path, thumb_path) values
 ('f341a2d0-9328-40b6-a130-000000000014', 'f341a2d0-9328-40b6-a130-000000000012', current_date, 'private/original', 'private/thumbnail');
insert into public.support_tickets (id, user_id, subject, body) values
 ('f341a2d0-9328-40b6-a130-000000000015', 'f341a2d0-9328-40b6-a130-000000000011', 'test', 'test');

set local role authenticated;
set local request.jwt.claims = '{"sub":"f341a2d0-9328-40b6-a130-000000000011"}';
do $$ begin
  begin
    perform * from public.admin_couple_overview(0, 50);
    raise exception 'FAIL: normal user accessed dashboard';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.admin_couple_activity('f341a2d0-9328-40b6-a130-000000000014');
    raise exception 'FAIL: normal user accessed aggregate activity';
  exception when insufficient_privilege then null; end;
  delete from public.support_tickets where id = 'f341a2d0-9328-40b6-a130-000000000015';
  if found then raise exception 'FAIL: normal user deleted an inquiry'; end if;
end $$;

set local request.jwt.claims = '{"sub":"f341a2d0-9328-40b6-a130-000000000013"}';
do $$ declare item record; begin
  select * into item from public.admin_couple_overview(0, 50) where couple_id = 'f341a2d0-9328-40b6-a130-000000000014';
  if item.couple_id is null or jsonb_array_length(item.members) <> 2 or item.event_count <> 1 or item.photo_count <> 1 then
    raise exception 'FAIL: incorrect dashboard aggregate';
  end if;
  if (select sum(events + photos) from public.admin_couple_activity('f341a2d0-9328-40b6-a130-000000000014')) <> 2 then
    raise exception 'FAIL: incorrect activity chart';
  end if;
  if exists (select 1 from public.events where couple_id = 'f341a2d0-9328-40b6-a130-000000000014') or
     exists (select 1 from public.photos where couple_id = 'f341a2d0-9328-40b6-a130-000000000014') then
    raise exception 'FAIL: administrator can read private records';
  end if;
  delete from public.support_tickets where id = 'f341a2d0-9328-40b6-a130-000000000015';
  if not found then raise exception 'FAIL: administrator cannot delete inquiry'; end if;
end $$;
rollback;
select 'ADMIN DASHBOARD RLS CHECKS PASSED' as result;
