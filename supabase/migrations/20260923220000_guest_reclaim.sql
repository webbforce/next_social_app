-- Returning guests who lost the auth cookie (common in WhatsApp's in-app
-- browser) pick their name on the plan instead of creating a duplicate.
-- The new anonymous session takes over that guest's row on this plan only.
-- Host accounts cannot be claimed. Anyone with the link can pick a name;
-- Stage A accepts that risk because the slug is unguessable and the group
-- will notice.

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
    'host', jsonb_build_object('id', h.id, 'first_name', h.first_name, 'photo_path', h.photo_path),
    'is_host', p.host_id = auth.uid(),
    'my_rsvp', (
      select pp.rsvp from public.plan_participants pp
      where pp.plan_id = p.id and pp.user_id = auth.uid() and pp.removed_at is null
    ),
    'am_removed', exists (
      select 1 from public.plan_participants pp
      where pp.plan_id = p.id and pp.user_id = auth.uid() and pp.removed_at is not null
    ),
    'in_count', (
      select count(*) from public.plan_participants pp
      where pp.plan_id = p.id and pp.removed_at is null and pp.rsvp = 'in'
    ) + 1,
    'participants', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', pp.id,
          'user_id', pr.id,
          'first_name', pr.first_name,
          'photo_path', pr.photo_path,
          'rsvp', pp.rsvp
        )
        order by pp.rsvp, pp.rsvp_at
      )
      from public.plan_participants pp
      join public.profiles pr on pr.id = pp.user_id
      where pp.plan_id = p.id and pp.removed_at is null and pp.rsvp <> 'out'
    ), '[]'::jsonb),
    'reclaimable_guests', case
      when p.host_id = auth.uid() then '[]'::jsonb
      when exists (
        select 1 from public.plan_participants mine
        where mine.plan_id = p.id and mine.user_id = auth.uid() and mine.removed_at is null
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
          and u.is_anonymous
      ), '[]'::jsonb)
    end
  )
  from public.plans p
  join public.profiles h on h.id = p.host_id
  where p.share_slug = p_slug;
$$;

create function public.reclaim_guest_on_plan(p_slug text, p_participant_id uuid)
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
    where plan_id = v_plan.id and user_id = v_new and removed_at is null
  ) then
    raise exception 'already_on_plan' using errcode = 'P0001';
  end if;

  select pp.user_id, pr.first_name
    into v_old, v_name
  from public.plan_participants pp
  join public.profiles pr on pr.id = pp.user_id
  where pp.id = p_participant_id
    and pp.plan_id = v_plan.id
    and pp.removed_at is null;

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

revoke all on function public.get_plan_by_slug(text) from public, anon;
grant execute on function public.get_plan_by_slug(text) to anon, authenticated;

revoke all on function public.reclaim_guest_on_plan(text, uuid) from public, anon;
grant execute on function public.reclaim_guest_on_plan(text, uuid) to authenticated;
