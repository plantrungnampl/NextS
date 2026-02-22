create table if not exists public.observability_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_name text not null,
  route_key text not null,
  status text not null,
  severity text not null,
  duration_ms integer not null,
  error_code text,
  retry_after_seconds integer,
  user_hash text,
  workspace_hash text,
  board_hash text,
  request_fingerprint_hash text,
  metadata jsonb not null default '{}'::jsonb,
  constraint observability_events_event_name_length
    check (char_length(event_name) between 3 and 120),
  constraint observability_events_route_key_length
    check (char_length(route_key) between 3 and 120),
  constraint observability_events_status_valid
    check (status in ('success', 'fail', 'rate_limited')),
  constraint observability_events_severity_valid
    check (severity in ('info', 'warn', 'error', 'critical')),
  constraint observability_events_duration_range
    check (duration_ms between 0 and 120000),
  constraint observability_events_error_code_length
    check (error_code is null or char_length(error_code) between 1 and 64),
  constraint observability_events_retry_after_range
    check (retry_after_seconds is null or retry_after_seconds between 1 and 3600),
  constraint observability_events_user_hash_length
    check (user_hash is null or char_length(user_hash) between 32 and 128),
  constraint observability_events_workspace_hash_length
    check (workspace_hash is null or char_length(workspace_hash) between 32 and 128),
  constraint observability_events_board_hash_length
    check (board_hash is null or char_length(board_hash) between 32 and 128),
  constraint observability_events_request_fingerprint_hash_length
    check (request_fingerprint_hash is null or char_length(request_fingerprint_hash) between 32 and 128),
  constraint observability_events_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists observability_events_created_at_idx
  on public.observability_events (created_at desc);

create index if not exists observability_events_event_name_created_at_idx
  on public.observability_events (event_name, created_at desc);

create index if not exists observability_events_route_key_created_at_idx
  on public.observability_events (route_key, created_at desc);

create index if not exists observability_events_status_created_at_idx
  on public.observability_events (status, created_at desc);

create or replace function public.log_observability_event(
  p_event_name text,
  p_route_key text,
  p_status text,
  p_severity text,
  p_duration_ms integer,
  p_error_code text default null,
  p_retry_after_seconds integer default null,
  p_user_hash text default null,
  p_workspace_hash text default null,
  p_board_hash text default null,
  p_request_fingerprint_hash text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_name text := lower(trim(coalesce(p_event_name, '')));
  v_route_key text := lower(trim(coalesce(p_route_key, '')));
  v_status text := lower(trim(coalesce(p_status, '')));
  v_severity text := lower(trim(coalesce(p_severity, '')));
  v_duration_ms integer := coalesce(p_duration_ms, -1);
  v_error_code text := nullif(upper(trim(coalesce(p_error_code, ''))), '');
  v_retry_after_seconds integer := p_retry_after_seconds;
  v_user_hash text := nullif(trim(coalesce(p_user_hash, '')), '');
  v_workspace_hash text := nullif(trim(coalesce(p_workspace_hash, '')), '');
  v_board_hash text := nullif(trim(coalesce(p_board_hash, '')), '');
  v_request_fingerprint_hash text := nullif(trim(coalesce(p_request_fingerprint_hash, '')), '');
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if char_length(v_event_name) < 3 or char_length(v_event_name) > 120 then
    raise exception using errcode = '22023', message = 'Invalid observability event name.';
  end if;

  if char_length(v_route_key) < 3 or char_length(v_route_key) > 120 then
    raise exception using errcode = '22023', message = 'Invalid observability route key.';
  end if;

  if v_status not in ('success', 'fail', 'rate_limited') then
    raise exception using errcode = '22023', message = 'Invalid observability status.';
  end if;

  if v_severity not in ('info', 'warn', 'error', 'critical') then
    raise exception using errcode = '22023', message = 'Invalid observability severity.';
  end if;

  if v_duration_ms < 0 or v_duration_ms > 120000 then
    raise exception using errcode = '22023', message = 'Invalid observability duration.';
  end if;

  if v_error_code is not null and char_length(v_error_code) > 64 then
    raise exception using errcode = '22023', message = 'Invalid observability error code.';
  end if;

  if v_retry_after_seconds is not null and (v_retry_after_seconds < 1 or v_retry_after_seconds > 3600) then
    raise exception using errcode = '22023', message = 'Invalid retry-after value.';
  end if;

  if v_user_hash is not null and (char_length(v_user_hash) < 32 or char_length(v_user_hash) > 128) then
    raise exception using errcode = '22023', message = 'Invalid user hash.';
  end if;

  if v_workspace_hash is not null and (char_length(v_workspace_hash) < 32 or char_length(v_workspace_hash) > 128) then
    raise exception using errcode = '22023', message = 'Invalid workspace hash.';
  end if;

  if v_board_hash is not null and (char_length(v_board_hash) < 32 or char_length(v_board_hash) > 128) then
    raise exception using errcode = '22023', message = 'Invalid board hash.';
  end if;

  if v_request_fingerprint_hash is not null and (
    char_length(v_request_fingerprint_hash) < 32 or char_length(v_request_fingerprint_hash) > 128
  ) then
    raise exception using errcode = '22023', message = 'Invalid request fingerprint hash.';
  end if;

  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception using errcode = '22023', message = 'Observability metadata must be a JSON object.';
  end if;

  insert into public.observability_events (
    event_name,
    route_key,
    status,
    severity,
    duration_ms,
    error_code,
    retry_after_seconds,
    user_hash,
    workspace_hash,
    board_hash,
    request_fingerprint_hash,
    metadata
  )
  values (
    v_event_name,
    v_route_key,
    v_status,
    v_severity,
    v_duration_ms,
    v_error_code,
    v_retry_after_seconds,
    v_user_hash,
    v_workspace_hash,
    v_board_hash,
    v_request_fingerprint_hash,
    v_metadata
  );
end;
$$;

create or replace function public.purge_observability_events(
  p_retention_days integer default 30
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retention_days integer := coalesce(p_retention_days, 30);
  v_deleted bigint := 0;
begin
  if v_retention_days < 1 or v_retention_days > 365 then
    raise exception using errcode = '22023', message = 'Invalid retention window.';
  end if;

  delete from public.observability_events
  where created_at < now() - make_interval(days => v_retention_days);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace view public.observability_error_rate_10m as
select
  route_key,
  count(*)::bigint as total_count,
  count(*) filter (where status = 'fail')::bigint as fail_count,
  count(*) filter (where status = 'rate_limited')::bigint as rate_limited_count,
  round(
    case
      when count(*) = 0 then 0::numeric
      else (count(*) filter (where status = 'fail')::numeric / count(*)::numeric) * 100
    end,
    2
  ) as fail_rate_percent,
  min(created_at) as window_started_at,
  max(created_at) as window_ended_at
from public.observability_events
where created_at >= now() - interval '10 minutes'
group by route_key;

create or replace view public.observability_latency_p95_10m as
select
  route_key,
  count(*)::bigint as sample_count,
  round(
    percentile_cont(0.95) within group (order by duration_ms)::numeric,
    2
  ) as p95_duration_ms,
  round(
    percentile_cont(0.99) within group (order by duration_ms)::numeric,
    2
  ) as p99_duration_ms,
  min(created_at) as window_started_at,
  max(created_at) as window_ended_at
from public.observability_events
where created_at >= now() - interval '10 minutes'
group by route_key;

revoke all on table public.observability_events from public;
revoke all on table public.observability_events from anon;
revoke all on table public.observability_events from authenticated;

revoke all on function public.log_observability_event(
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
) from public;
grant execute on function public.log_observability_event(
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
) to anon;
grant execute on function public.log_observability_event(
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
) to authenticated;

revoke all on function public.purge_observability_events(integer) from public;

revoke all on table public.observability_error_rate_10m from public;
revoke all on table public.observability_error_rate_10m from anon;
revoke all on table public.observability_error_rate_10m from authenticated;

revoke all on table public.observability_latency_p95_10m from public;
revoke all on table public.observability_latency_p95_10m from anon;
revoke all on table public.observability_latency_p95_10m from authenticated;
