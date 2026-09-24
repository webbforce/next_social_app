-- Insiders can switch the reel track. Only the track column changes.

create function public.set_episode_track(p_episode_id uuid, p_track text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
begin
  if p_track not in ('warm', 'night', 'pulse') then
    raise exception 'unknown_track' using errcode = 'P0001';
  end if;

  select e.plan_id into v_plan_id
  from public.episodes e
  where e.id = p_episode_id and e.status = 'ready';

  if v_plan_id is null then
    raise exception 'episode_not_ready' using errcode = 'P0002';
  end if;

  if not private.is_plan_insider(v_plan_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  update public.episodes
  set music_track = p_track
  where id = p_episode_id;
end;
$$;

revoke all on function public.set_episode_track(uuid, text) from public, anon;
grant execute on function public.set_episode_track(uuid, text) to authenticated;
