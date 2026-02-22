drop policy if exists observability_incidents_update_policy on public.observability_incidents;

revoke update on table public.observability_incidents from authenticated;
revoke insert on table public.observability_incidents from authenticated;
revoke delete on table public.observability_incidents from authenticated;
