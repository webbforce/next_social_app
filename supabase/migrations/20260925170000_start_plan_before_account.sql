-- A plan can be created before the host saves an account.
-- Anonymous sessions are already signed in, so the insert only checks the host id.
-- Saving an Apple, Google, or email account keeps the same user, and the plan stays with them.

drop policy if exists "Hosts with a verified phone create plans" on public.plans;

create policy "Signed-in users create their own plan"
  on public.plans for insert
  to authenticated
  with check (host_id = (select auth.uid()));
