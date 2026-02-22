-- Remove observability alerting/dashboard DB surface no longer used by app UI.
-- Keep base telemetry ingest (`observability_events` + `log_observability_event`).

do $cleanup_schedule$
declare
  v_job_id bigint;
begin
  if to_regclass('cron.job') is not null then
    execute $q$
      select jobid
      from cron.job
      where jobname = 'observability_evaluate_alerts_every_2m'
      order by jobid desc
      limit 1
    $q$
    into v_job_id;

    if v_job_id is not null then
      perform cron.unschedule(v_job_id);
    end if;
  end if;
exception
  when invalid_schema_name then
    null;
  when undefined_table then
    null;
  when undefined_function then
    null;
end;
$cleanup_schedule$;

drop function if exists public.get_workspace_observability_dashboard(uuid, integer);
drop function if exists public.ack_observability_incident(uuid);
drop function if exists public.resolve_observability_incident(uuid);
drop function if exists public.evaluate_observability_alerts();

drop view if exists public.current_observability_alerts;
drop view if exists public.observability_workspace_error_rate_10m;
drop view if exists public.observability_workspace_latency_p95_10m;

drop table if exists public.observability_incidents;

drop function if exists public.workspace_hash_from_workspace_id(uuid);

drop index if exists public.observability_events_workspace_hash_created_at_idx;
