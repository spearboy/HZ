-- The support administrator sees names and aggregate usage, never photo paths or event contents.
begin;

grant delete on public.support_tickets to authenticated;
drop policy if exists support_tickets_admin_delete on public.support_tickets;
create policy support_tickets_admin_delete on public.support_tickets for delete to authenticated
  using (exists (select 1 from public.support_admins where user_id = (select auth.uid())));

create or replace function public.admin_couple_overview(p_offset integer default 0, p_limit integer default 50)
returns table (couple_id uuid, created_at timestamptz, members jsonb, event_count bigint, photo_count bigint, latest_record_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.support_admins a where a.user_id = (select auth.uid())) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  return query
  select c.id, c.created_at,
    coalesce((select jsonb_agg(coalesce(nullif(p.display_name, ''), '이름 없음') order by m.joined_at, m.user_id)
      from public.couple_members m left join public.profiles p on p.id = m.user_id where m.couple_id = c.id), '[]'::jsonb),
    (select count(*) from public.events e where e.couple_id = c.id),
    (select count(*) from public.photos p where p.couple_id = c.id),
    greatest((select max(e.created_at) from public.events e where e.couple_id = c.id),
             (select max(p.created_at) from public.photos p where p.couple_id = c.id))
  from public.couples c
  where exists (select 1 from public.couple_members m where m.couple_id = c.id)
  order by c.created_at desc, c.id desc
  offset greatest(coalesce(p_offset, 0), 0) limit least(greatest(coalesce(p_limit, 50), 1), 50);
end $$;

create or replace function public.admin_couple_activity(p_couple_id uuid)
returns table (day date, events bigint, photos bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.support_admins a where a.user_id = (select auth.uid())) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  return query
  select d.day::date,
    (select count(*) from public.events e where e.couple_id = p_couple_id and e.created_at >= (d.day at time zone 'Asia/Seoul') and e.created_at < ((d.day + interval '1 day') at time zone 'Asia/Seoul')),
    (select count(*) from public.photos p where p.couple_id = p_couple_id and p.created_at >= (d.day at time zone 'Asia/Seoul') and p.created_at < ((d.day + interval '1 day') at time zone 'Asia/Seoul'))
  from pg_catalog.generate_series(((current_timestamp at time zone 'Asia/Seoul')::date - 13)::timestamp,
    ((current_timestamp at time zone 'Asia/Seoul')::date)::timestamp, interval '1 day') as d(day)
  order by d.day;
end $$;

revoke all on function public.admin_couple_overview(integer, integer), public.admin_couple_activity(uuid) from public, anon;
grant execute on function public.admin_couple_overview(integer, integer), public.admin_couple_activity(uuid) to authenticated;
commit;
