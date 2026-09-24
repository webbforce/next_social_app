-- Close Stage A privacy and measurement gaps from docs/mvp-spec.md:
-- guests can take their name and photos off a plan, hosts can delete an account,
-- and ended plans are recorded once for the Stage A success metrics.

alter table public.plan_participants
  add column if not exists left_at timestamptz;

alter table public.plans
  add column if not exists ended_recorded_at timestamptz;

-- A deleted host can no longer create plans or set "I'm free".
create or replace function private.is_host_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and deleted_at is null
    );
$$;

create or replace function private.is_plan_member(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.plans p
    where p.id = p_plan_id and p.host_id = auth.uid()
  ) or exists (
    select 1 from public.plan_participants pp
    where pp.plan_id = p_plan_id
      and pp.user_id = auth.uid()
      and pp.removed_at is null
      and pp.left_at is null
  );
$$;

create or replace function private.is_plan_insider(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.plans p
    where p.id = p_plan_id and p.host_id = auth.uid()
  ) or exists (
    select 1 from public.plan_participants pp
    where pp.plan_id = p_plan_id
      and pp.user_id = auth.uid()
      and pp.removed_at is null
      and pp.left_at is null
      and pp.rsvp in ('in', 'maybe')
  );
$$;

create or replace function private.recent_plan_mates()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with my_plans as (
    select p.id from public.plans p
    where p.host_id = auth.uid() and p.starts_at > now() - interval '30 days'
    union
    select pp.plan_id from public.plan_participants pp
    join public.plans p on p.id = pp.plan_id
    where pp.user_id = auth.uid()
      and pp.removed_at is null
      and pp.left_at is null
      and pp.rsvp in ('in', 'maybe')
      and p.starts_at > now() - interval '30 days'
  )
  select p.host_id from public.plans p where p.id in (select id from my_plans)
  union
  select pp.user_id from public.plan_participants pp
  where pp.plan_id in (select id from my_plans)
    and pp.removed_at is null
    and pp.left_at is null
    and pp.rsvp in ('in', 'maybe');
$$;

create or replace function private.shares_plan_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.plan_participants mine
    join public.plans p on p.id = mine.plan_id
    left join public.plan_participants theirs
      on theirs.plan_id = p.id
      and theirs.user_id = p_user_id
      and theirs.removed_at is null
      and theirs.left_at is null
    where mine.user_id = auth.uid()
      and mine.removed_at is null
      and mine.left_at is null
      and (p.host_id = p_user_id or theirs.id is not null)
  ) or exists (
    select 1
    from public.plans p
    join public.plan_participants theirs on theirs.plan_id = p.id
    where p.host_id = auth.uid()
      and theirs.user_id = p_user_id
      and theirs.removed_at is null
      and theirs.left_at is null
  );
$$;

create or replace function public.get_plan_by_slug(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'activity', p.activity,
    'activity_tag', p.activity_tag,
    'starts_at', p.starts_at,
    'ends_at', p.ends_at,
    'place_text', p.place_text,
    'place_url', p.place_url,
    'status', private.plan_status(p.starts_at, p.ends_at, p.cancelled_at),
    'host', jsonb_build_object(
      'id', h.id,
      'first_name', case when h.deleted_at is null then h.first_name else 'Someone' end,
      'photo_path', case when h.deleted_at is null then h.photo_path else null end
    ),
    'is_host', (p.host_id = auth.uid() and h.deleted_at is null) is true,
    'my_rsvp', (
      select pp.rsvp from public.plan_participants pp
      where pp.plan_id = p.id
        and pp.user_id = auth.uid()
        and pp.removed_at is null
        and pp.left_at is null
    ),
    'am_removed', exists (
      select 1 from public.plan_participants pp
      where pp.plan_id = p.id and pp.user_id = auth.uid() and pp.removed_at is not null
    ),
    'in_count', (
      select count(*) from public.plan_participants pp
      where pp.plan_id = p.id
        and pp.removed_at is null
        and pp.left_at is null
        and pp.rsvp = 'in'
    ) + 1,
    'participants', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', pp.id,
          'user_id', pr.id,
          'first_name', case when pr.deleted_at is null then pr.first_name else 'Someone' end,
          'photo_path', case when pr.deleted_at is null then pr.photo_path else null end,
          'rsvp', pp.rsvp
        )
        order by pp.rsvp, pp.rsvp_at
      )
      from public.plan_participants pp
      join public.profiles pr on pr.id = pp.user_id
      where pp.plan_id = p.id
        and pp.removed_at is null
        and pp.left_at is null
        and pp.rsvp <> 'out'
    ), '[]'::jsonb),
    'reclaimable_guests', case
      when p.host_id = auth.uid() then '[]'::jsonb
      when exists (
        select 1 from public.plan_participants mine
        where mine.plan_id = p.id
          and mine.user_id = auth.uid()
          and mine.removed_at is null
          and mine.left_at is null
      ) then '[]'::jsonb
      else coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', pp.id,
            'first_name', pr.first_name,
            'rsvp', pp.rsvp
          )
          order by pp.rsvp_at
        )
        from public.plan_participants pp
        join public.profiles pr on pr.id = pp.user_id
        join auth.users u on u.id = pp.user_id
        where pp.plan_id = p.id
          and pp.removed_at is null
          and pp.left_at is null
          and pr.deleted_at is null
          and u.is_anonymous
      ), '[]'::jsonb)
    end
  )
  from public.plans p
  join public.profiles h on h.id = p.host_id
  where p.share_slug = p_slug;
$$;

create or replace function public.rsvp(p_slug text, p_rsvp public.rsvp_status)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
  v_participant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_18_plus_confirmed and deleted_at is null
  ) then
    raise exception 'profile_incomplete' using errcode = 'P0001';
  end if;

  select * into v_plan from public.plans where share_slug = p_slug;
  if not found then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  if v_plan.host_id = auth.uid() then
    raise exception 'host_cannot_rsvp' using errcode = 'P0001';
  end if;

  if private.plan_status(v_plan.starts_at, v_plan.ends_at, v_plan.cancelled_at) in ('ended', 'cancelled') then
    raise exception 'plan_closed' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.plan_participants
    where plan_id = v_plan.id and user_id = auth.uid() and removed_at is not null
  ) then
    raise exception 'removed_by_host' using errcode = '42501';
  end if;

  insert into public.plan_participants (plan_id, user_id, rsvp)
  values (v_plan.id, auth.uid(), p_rsvp)
  on conflict (plan_id, user_id)
    do update set rsvp = excluded.rsvp, rsvp_at = now(), left_at = null
  returning id into v_participant_id;

  return v_participant_id;
end;
$$;

-- Take your name off this plan and drop the photos you added. You can RSVP again later.
create function public.leave_plan(p_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  select p.id into v_plan_id
  from public.plans p
  where p.share_slug = p_slug and p.host_id <> auth.uid();

  if v_plan_id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  update public.plan_participants
  set left_at = now()
  where plan_id = v_plan_id
    and user_id = auth.uid()
    and removed_at is null
    and left_at is null;

  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  update public.moments
  set removed_at = now()
  where plan_id = v_plan_id
    and uploader_id = auth.uid()
    and removed_at is null;
end;
$$;

-- Hide the account immediately. Uploads and the phone number are erased after 30 days.
create function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not_a_host' using errcode = 'P0001';
  end if;

  update public.profiles
  set deleted_at = coalesce(deleted_at, now())
  where id = auth.uid();

  update public.free_signals
  set cleared_at = now()
  where user_id = auth.uid() and cleared_at is null;

  update public.plan_participants
  set left_at = coalesce(left_at, now())
  where user_id = auth.uid() and removed_at is null and left_at is null;

  update public.moments
  set removed_at = coalesce(removed_at, now())
  where uploader_id = auth.uid() and removed_at is null;

  update public.plans
  set cancelled_at = now()
  where host_id = auth.uid() and cancelled_at is null and ends_at > now();
end;
$$;

-- One row per ended plan, for the Stage A "did the plan produce a group" read.
create function public.record_ended_plans()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  with due as (
    select p.id
    from public.plans p
    where p.cancelled_at is null
      and p.ends_at <= now()
      and p.ended_recorded_at is null
    order by p.ends_at
    limit 100
  ),
  marked as (
    update public.plans p
    set ended_recorded_at = now()
    from due
    where p.id = due.id
    returning p.id, p.host_id, p.activity
  )
  insert into public.analytics_events (name, user_id, properties)
  select
    'plan_ended',
    m.host_id,
    jsonb_build_object(
      'plan_id', m.id,
      'activity', m.activity,
      'participants_in', (
        select count(*)::int from public.plan_participants pp
        where pp.plan_id = m.id
          and pp.removed_at is null
          and pp.left_at is null
          and pp.rsvp = 'in'
      ) + 1,
      'guests_in', (
        select count(*)::int
        from public.plan_participants pp
        join auth.users u on u.id = pp.user_id
        where pp.plan_id = m.id
          and pp.removed_at is null
          and pp.left_at is null
          and pp.rsvp = 'in'
          and u.is_anonymous
      ),
      'photo_count', (
        select count(*)::int from public.moments mo
        where mo.plan_id = m.id and mo.removed_at is null
      )
    )
  from marked m;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- Called by the daily job once storage files for that account are gone.
create function public.finalize_account_purge(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_user_id
      and deleted_at is not null
      and deleted_at < now() - interval '30 days'
      and first_name <> 'Deleted'
  ) then
    raise exception 'not_due' using errcode = 'P0001';
  end if;

  update public.profiles
  set first_name = 'Deleted', photo_path = null, campus_id = null
  where id = p_user_id;

  update auth.users
  set phone = null,
      phone_confirmed_at = null,
      email = null,
      banned_until = 'infinity'
  where id = p_user_id;
end;
$$;

revoke all on function public.leave_plan(text) from public, anon;
revoke all on function public.request_account_deletion() from public, anon;
revoke all on function public.record_ended_plans() from public, anon, authenticated;
revoke all on function public.finalize_account_purge(uuid) from public, anon, authenticated;

grant execute on function public.leave_plan(text) to authenticated;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.record_ended_plans() to service_role;
grant execute on function public.finalize_account_purge(uuid) to service_role;

-- Once a profile is marked deleted, the owner cannot undo it or edit the leftover name.
create function private.lock_deleted_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if old.deleted_at is not null then
    new.deleted_at := old.deleted_at;
    new.first_name := old.first_name;
    new.photo_path := old.photo_path;
    new.campus_id := old.campus_id;
  end if;
  return new;
end;
$$;

create trigger profiles_lock_deleted
  before update on public.profiles
  for each row
  execute function private.lock_deleted_profile();

-- Someone who left cannot be claimed back onto the plan.
create or replace function public.reclaim_guest_on_plan(p_slug text, p_participant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
  v_old uuid;
  v_new uuid := auth.uid();
  v_name text;
begin
  if v_new is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  if coalesce((select u.is_anonymous from auth.users u where u.id = v_new), false) is not true then
    raise exception 'not_a_guest' using errcode = 'P0001';
  end if;

  select * into v_plan from public.plans where share_slug = p_slug;
  if not found then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  if v_plan.cancelled_at is not null then
    raise exception 'plan_cancelled' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.plan_participants
    where plan_id = v_plan.id and user_id = v_new and removed_at is null and left_at is null
  ) then
    raise exception 'already_on_plan' using errcode = 'P0001';
  end if;

  select pp.user_id, pr.first_name
    into v_old, v_name
  from public.plan_participants pp
  join public.profiles pr on pr.id = pp.user_id
  where pp.id = p_participant_id
    and pp.plan_id = v_plan.id
    and pp.removed_at is null
    and pp.left_at is null
    and pr.deleted_at is null;

  if v_old is null then
    raise exception 'guest_not_found' using errcode = 'P0002';
  end if;

  if v_old = v_plan.host_id
     or coalesce((select u.is_anonymous from auth.users u where u.id = v_old), false) is not true then
    raise exception 'not_a_guest_row' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, first_name, is_18_plus_confirmed)
  values (v_new, v_name, true)
  on conflict (id) do update
    set first_name = excluded.first_name,
        is_18_plus_confirmed = true;

  update public.moment_exclusions me
  set user_id = v_new
  from public.moments m
  where me.moment_id = m.id
    and m.plan_id = v_plan.id
    and me.user_id = v_old;

  update public.moments
  set uploader_id = v_new
  where plan_id = v_plan.id and uploader_id = v_old;

  update public.plan_updates
  set author_id = v_new
  where plan_id = v_plan.id and author_id = v_old;

  update public.plan_participants
  set user_id = v_new
  where id = p_participant_id;

  return p_participant_id;
end;
$$;
