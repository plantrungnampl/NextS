-- Remove base observability ingest surface after full feature deprecation.

drop view if exists public.observability_error_rate_10m;
drop view if exists public.observability_latency_p95_10m;

drop function if exists public.log_observability_event(
  text,
  text,
  text,
  text,
  integer,
  text,
  integer,
  text,
  text,
  text,
  text,
  jsonb
);
drop function if exists public.purge_observability_events(integer);

drop table if exists public.observability_events;
