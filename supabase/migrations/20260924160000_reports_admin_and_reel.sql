alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create or replace function private.protect_profile_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.role() <> 'service_role' then
      new.is_admin := false;
    end if;
    return new;
  end if;
  if new.is_admin is distinct from old.is_admin and auth.role() <> 'service_role' then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_admin on public.profiles;
create trigger protect_profile_admin
  before insert or update on public.profiles
  for each row execute function private.protect_profile_admin();

create policy "Admins read all reports"
  on public.reports for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and is_admin and deleted_at is null
    )
  );

create policy "Admins update reports"
  on public.reports for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and is_admin and deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and is_admin and deleted_at is null
    )
  );

update storage.buckets
set allowed_mime_types = array['video/mp4', 'video/webm', 'image/jpeg', 'image/png']
where id = 'episodes';
