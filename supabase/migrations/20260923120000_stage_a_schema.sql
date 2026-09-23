-- Stage A schema (docs/mvp-spec.md §6).
--
-- Guests are Supabase anonymous users, so every participant has an auth.uid().
-- Hosts are users who verified a phone number (auth.jwt() ->> 'is_anonymous' = false).
-- Anyone holding a plan's share link reads it through public.get_plan_by_slug();
-- direct table access is limited to plan members by row level security.

create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.rsvp_status as enum ('in', 'maybe', 'out');
create type public.plan_source as enum ('web_create', 'free_page');
create type public.media_type as enum ('photo', 'clip');
create type public.episode_format as enum ('card', 'reel');
create type public.episode_status as enum ('pending', 'rendering', 'ready', 'failed');
create type public.report_target as enum ('plan', 'moment', 'profile');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.campuses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 40),
  photo_path text,
  is_18_plus_confirmed boolean not null default false,
  campus_id uuid references public.campuses (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  activity text not null check (char_length(btrim(activity)) between 1 and 80),
  activity_tag text check (
    activity_tag in ('coffee', 'walk', 'food', 'gym', 'study', 'drinks', 'party', 'anything')
  ),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  place_text text check (char_length(place_text) <= 120),
  place_url text check (char_length(place_url) <= 500),
  cancelled_at timestamptz,
  share_slug text not null unique default replace(
    replace(encode(extensions.gen_random_bytes(9), 'base64'), '+', '-'), '/', '_'
  ),
  source public.plan_source not null default 'web_create',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.plan_participants (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rsvp public.rsvp_status not null,
  rsvp_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (plan_id, user_id)
);

create table public.plan_updates (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now()
);

create table public.moments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id) on delete cascade,
  media_type public.media_type not null default 'photo',
  storage_path text not null unique,
  taken_at timestamptz,
  width integer,
  height integer,
  removed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Participants exclude photos they appear in; excluded photos never go into an episode.
create table public.moment_exclusions (
  moment_id uuid not null references public.moments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (moment_id, user_id)
);

create table public.episodes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null unique references public.plans (id) on delete cascade,
  format public.episode_format not null,
  template text not null,
  music_track text,
  status public.episode_status not null default 'pending',
  video_path text,
  card_path text,
  highlights jsonb not null default '{}'::jsonb,
  public_share_slug text unique,
  error text,
  created_at timestamptz not null default now(),
  ready_at timestamptz
);

create table public.free_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  intent text check (intent in ('coffee', 'food', 'drinks', 'anything')),
  expires_at timestamptz not null,
  cleared_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);

-- Written only by the server with the service role key.
create table public.analytics_events (
  id bigint generated always as identity primary key,
  name text not null,
  user_id uuid,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index plans_host_id_idx on public.plans (host_id);
create index plan_participants_user_id_idx on public.plan_participants (user_id);
create index plan_updates_plan_id_created_at_idx on public.plan_updates (plan_id, created_at);
create index moments_plan_id_idx on public.moments (plan_id);
create index free_signals_user_id_expires_at_idx on public.free_signals (user_id, expires_at);
create index analytics_events_name_occurred_at_idx on public.analytics_events (name, occurred_at);

-- ---------------------------------------------------------------------------
-- Helpers (private schema: not exposed through the API)
-- ---------------------------------------------------------------------------

create function private.is_host_account()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is not null
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

create function private.plan_status(p_starts_at timestamptz, p_ends_at timestamptz, p_cancelled_at timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_cancelled_at is not null then 'cancelled'
    when now() < p_starts_at then 'open'
    when now() < p_ends_at then 'happening'
    else 'ended'
  end;
$$;

-- Host, or any participant row that hasn't been removed (any RSVP).
create function private.is_plan_member(p_plan_id uuid)
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
  );
$$;

-- Host, or a participant who is "in" or "maybe": can see and add photos and the episode.
create function private.is_plan_insider(p_plan_id uuid)
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
      and pp.rsvp in ('in', 'maybe')
  );
$$;

create function private.is_plan_host(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.plans p
    where p.id = p_plan_id and p.host_id = auth.uid()
  );
$$;

-- Photos can be added from the plan's start until 12 h after it ends.
create function private.is_photo_window_open(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.plans p
    where p.id = p_plan_id
      and p.cancelled_at is null
      and now() >= p.starts_at
      and now() <= p.ends_at + interval '12 hours'
  );
$$;

-- People who shared a plan (as host or in/maybe participant) with the caller in the last 30 days.
create function private.recent_plan_mates()
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
      and pp.rsvp in ('in', 'maybe')
      and p.starts_at > now() - interval '30 days'
  )
  select p.host_id from public.plans p where p.id in (select id from my_plans)
  union
  select pp.user_id from public.plan_participants pp
  where pp.plan_id in (select id from my_plans)
    and pp.removed_at is null
    and pp.rsvp in ('in', 'maybe');
$$;

-- Anyone who shares any plan with the caller (to show names on plan pages).
create function private.shares_plan_with(p_user_id uuid)
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
      on theirs.plan_id = p.id and theirs.user_id = p_user_id and theirs.removed_at is null
    where mine.user_id = auth.uid()
      and mine.removed_at is null
      and (p.host_id = p_user_id or theirs.id is not null)
  ) or exists (
    select 1
    from public.plans p
    join public.plan_participants theirs on theirs.plan_id = p.id
    where p.host_id = auth.uid()
      and theirs.user_id = p_user_id
      and theirs.removed_at is null
  );
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.campuses enable row level security;
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.plan_participants enable row level security;
alter table public.plan_updates enable row level security;
alter table public.moments enable row level security;
alter table public.moment_exclusions enable row level security;
alter table public.episodes enable row level security;
alter table public.free_signals enable row level security;
alter table public.reports enable row level security;
alter table public.analytics_events enable row level security;

create policy "Campuses are readable by everyone"
  on public.campuses for select
  to anon, authenticated
  using (true);

create policy "Users read their own profile and people they share a plan with"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or private.shares_plan_with(id));

create policy "Users create their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Plan members read the plan"
  on public.plans for select
  to authenticated
  using (private.is_plan_member(id));

create policy "Hosts with a verified phone create plans"
  on public.plans for insert
  to authenticated
  with check (host_id = (select auth.uid()) and private.is_host_account());

create policy "Hosts edit or cancel their plans"
  on public.plans for update
  to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

create policy "Plan members read the participant list"
  on public.plan_participants for select
  to authenticated
  using (private.is_plan_member(plan_id));

create policy "Plan members read updates"
  on public.plan_updates for select
  to authenticated
  using (private.is_plan_member(plan_id));

create policy "Insiders post updates"
  on public.plan_updates for insert
  to authenticated
  with check (author_id = (select auth.uid()) and private.is_plan_insider(plan_id));

create policy "Insiders see photos"
  on public.moments for select
  to authenticated
  using (removed_at is null and private.is_plan_insider(plan_id));

create policy "Insiders add photos during the photo window"
  on public.moments for insert
  to authenticated
  with check (
    uploader_id = (select auth.uid())
    and private.is_plan_insider(plan_id)
    and private.is_photo_window_open(plan_id)
  );

create policy "Insiders see exclusions"
  on public.moment_exclusions for select
  to authenticated
  using (
    exists (
      select 1 from public.moments m
      where m.id = moment_id and private.is_plan_insider(m.plan_id)
    )
  );

create policy "Insiders exclude photos"
  on public.moment_exclusions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.moments m
      where m.id = moment_id and private.is_plan_insider(m.plan_id)
    )
  );

create policy "Users withdraw their own exclusions"
  on public.moment_exclusions for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Insiders see the episode"
  on public.episodes for select
  to authenticated
  using (private.is_plan_insider(plan_id));

create policy "Users see their own and recent plan mates' free signals"
  on public.free_signals for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or user_id in (select private.recent_plan_mates())
  );

create policy "Hosts set their own free signal"
  on public.free_signals for insert
  to authenticated
  with check (user_id = (select auth.uid()) and private.is_host_account());

create policy "Users clear their own free signal"
  on public.free_signals for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users file reports"
  on public.reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()));

create policy "Users see their own reports"
  on public.reports for select
  to authenticated
  using (reporter_id = (select auth.uid()));

-- analytics_events: no policies, so only the service role can read or write.

-- ---------------------------------------------------------------------------
-- API functions
-- ---------------------------------------------------------------------------

-- Everything the plan page and its link preview need, for anyone holding the link.
create function public.get_plan_by_slug(p_slug text)
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
    ), '[]'::jsonb)
  )
  from public.plans p
  join public.profiles h on h.id = p.host_id
  where p.share_slug = p_slug;
$$;

-- RSVP from the plan link. Works for guests (anonymous users) and hosts.
create function public.rsvp(p_slug text, p_rsvp public.rsvp_status)
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
    do update set rsvp = excluded.rsvp, rsvp_at = now()
  returning id into v_participant_id;

  return v_participant_id;
end;
$$;

create function public.remove_participant(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.plan_participants pp
  set removed_at = now()
  where pp.id = p_participant_id
    and pp.removed_at is null
    and private.is_plan_host(pp.plan_id);

  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;

-- Uploaders remove their own photos; hosts remove any photo on their plan.
create function public.remove_moment(p_moment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.moments m
  set removed_at = now()
  where m.id = p_moment_id
    and m.removed_at is null
    and (m.uploader_id = auth.uid() or private.is_plan_host(m.plan_id));

  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;

create function public.reset_share_slug(p_plan_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  update public.plans p
  set share_slug = replace(
    replace(encode(extensions.gen_random_bytes(9), 'base64'), '+', '-'), '/', '_'
  )
  where p.id = p_plan_id and p.host_id = auth.uid()
  returning p.share_slug into v_slug;

  if v_slug is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  return v_slug;
end;
$$;

-- A participant makes the episode publicly viewable; returns the public slug.
create function public.create_public_episode_link(p_episode_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  update public.episodes e
  set public_share_slug = coalesce(
    e.public_share_slug,
    replace(replace(encode(extensions.gen_random_bytes(9), 'base64'), '+', '-'), '/', '_')
  )
  where e.id = p_episode_id
    and e.status = 'ready'
    and private.is_plan_insider(e.plan_id)
  returning e.public_share_slug into v_slug;

  if v_slug is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  return v_slug;
end;
$$;

-- Public episode page; media URLs are signed by the server using the returned paths.
create function public.get_public_episode(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id,
    'format', e.format,
    'template', e.template,
    'video_path', e.video_path,
    'card_path', e.card_path,
    'highlights', e.highlights,
    'activity', p.activity
  )
  from public.episodes e
  join public.plans p on p.id = e.plan_id
  where e.public_share_slug = p_slug and e.status = 'ready';
$$;

-- Supabase's default privileges grant execute to anon; revoke it explicitly.
revoke all on function public.get_plan_by_slug(text) from public, anon;
revoke all on function public.rsvp(text, public.rsvp_status) from public, anon;
revoke all on function public.remove_participant(uuid) from public, anon;
revoke all on function public.remove_moment(uuid) from public, anon;
revoke all on function public.reset_share_slug(uuid) from public, anon;
revoke all on function public.create_public_episode_link(uuid) from public, anon;
revoke all on function public.get_public_episode(text) from public, anon;

grant execute on function public.get_plan_by_slug(text) to anon, authenticated;
grant execute on function public.get_public_episode(text) to anon, authenticated;
grant execute on function public.rsvp(text, public.rsvp_status) to authenticated;
grant execute on function public.remove_participant(uuid) to authenticated;
grant execute on function public.remove_moment(uuid) to authenticated;
grant execute on function public.reset_share_slug(uuid) to authenticated;
grant execute on function public.create_public_episode_link(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
-- moments/<plan_id>/<file>, episodes/<plan_id>/<file>, avatars/<user_id>/<file>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('moments', 'moments', false, 20971520,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('episodes', 'episodes', false, 104857600,
    array['video/mp4', 'image/jpeg', 'image/png']),
  ('avatars', 'avatars', false, 5242880,
    array['image/jpeg', 'image/png', 'image/webp']);

create function private.try_uuid(p_text text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_text::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

grant execute on function private.try_uuid(text) to anon, authenticated;

create policy "Insiders upload photos to their plan folder during the photo window"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'moments'
    and private.is_plan_insider(private.try_uuid((storage.foldername(name))[1]))
    and private.is_photo_window_open(private.try_uuid((storage.foldername(name))[1]))
  );

create policy "Insiders read photos of their plan"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'moments'
    and private.is_plan_insider(private.try_uuid((storage.foldername(name))[1]))
  );

create policy "Insiders read their plan's episode media"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'episodes'
    and private.is_plan_insider(private.try_uuid((storage.foldername(name))[1]))
  );

create policy "Users manage their own avatar"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Avatars are readable by signed-in users"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');
