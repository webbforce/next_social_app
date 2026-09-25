-- Retention and access fixes from the Stage A privacy review.
-- Guests can delete an account. The 30-day purge also removes the phone identity.
-- Profile photos are readable by people who share a plan, not by every signed-in user.

create or replace function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '28000';
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

-- Called by the daily job once storage files for that account are gone.
create or replace function public.finalize_account_purge(p_user_id uuid)
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

  delete from auth.identities where user_id = p_user_id;

  update auth.users
  set phone = null,
      phone_confirmed_at = null,
      email = null,
      raw_user_meta_data = '{}'::jsonb,
      banned_until = 'infinity'
  where id = p_user_id;
end;
$$;

drop policy if exists "Avatars are readable by signed-in users" on storage.objects;

create policy "Avatars are readable by plan-mates"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or private.shares_plan_with(private.try_uuid((storage.foldername(name))[1]))
    )
  );
