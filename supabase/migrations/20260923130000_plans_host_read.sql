-- private.is_plan_member() looks the plan up by id, which can't see a row inserted
-- by the same statement, so `insert ... returning` failed for hosts.

drop policy "Plan members read the plan" on public.plans;

create policy "Plan members read the plan"
  on public.plans for select
  to authenticated
  using (host_id = (select auth.uid()) or private.is_plan_member(id));
