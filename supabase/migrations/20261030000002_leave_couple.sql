-- 연결 끊기 / 같은 상대와 다시 연결하면 예전 커플(일정·사진)을 그대로 이어 쓰기

-- 끊긴 커플의 옛 멤버 기록. 정책 없음 = 클라이언트는 못 보고 RPC(definer)만 쓴다
create table public.former_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  left_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);
alter table public.former_members enable row level security;

-- 한쪽이 끊으면 둘 다 끊긴다. 데이터는 지우지 않고, 멤버가 없으니 아무도 못 본다(RLS가 my_couple_id 기준)
create or replace function public.leave_couple()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  cid uuid := public.my_couple_id();
begin
  if cid is null then raise exception 'no couple'; end if;
  perform 1 from public.couples where id = cid for update;

  insert into public.former_members (couple_id, user_id)
  select couple_id, user_id from public.couple_members where couple_id = cid
  on conflict (couple_id, user_id) do update set left_at = now();
  delete from public.couple_members where couple_id = cid;
  delete from public.invites where couple_id = cid;
end $$;

-- 기존 accept_invite + 초대한 사람과 예전에 같은 커플이었으면 그 커플로 둘을 되돌린다
create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  inv public.invites%rowtype;
  old_cid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.my_couple_id() is not null then raise exception 'already in a couple'; end if;

  select * into inv from public.invites where code = upper(trim(p_code)) for update;
  if not found or inv.used_at is not null or inv.expires_at < now() then
    raise exception 'invalid or expired code';
  end if;

  -- 서로 다른 코드 두 개가 동시에 수락돼 3명이 되는 경쟁을 커플 행 잠금으로 막는다
  perform 1 from public.couples where id = inv.couple_id for update;
  if (select count(*) from public.couple_members where couple_id = inv.couple_id) >= 2 then
    raise exception 'couple already full';
  end if;

  update public.invites set used_at = now() where code = inv.code;

  select f.couple_id into old_cid
  from public.former_members f
  join public.former_members g on g.couple_id = f.couple_id and g.user_id = inv.created_by
  where f.user_id = auth.uid()
  order by greatest(f.left_at, g.left_at) desc
  limit 1;

  if old_cid is null then
    insert into public.couple_members (couple_id, user_id) values (inv.couple_id, auth.uid());
    return inv.couple_id;
  end if;

  -- 초대용으로 새로 만든 1인 커플은 버리고 예전 커플로 복귀. 혹시 데이터가 있으면 커플 행은 남겨 둔다
  delete from public.couple_members where couple_id = inv.couple_id;
  delete from public.couples c where c.id = inv.couple_id
    and not exists (select 1 from public.events where couple_id = c.id)
    and not exists (select 1 from public.photos where couple_id = c.id);
  insert into public.couple_members (couple_id, user_id) values (old_cid, auth.uid()), (old_cid, inv.created_by);
  delete from public.former_members where couple_id = old_cid;
  return old_cid;
end $$;

revoke execute on function public.leave_couple(), public.accept_invite(text) from public, anon;
grant execute on function public.leave_couple(), public.accept_invite(text) to authenticated;
