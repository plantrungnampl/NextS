create index if not exists observability_events_workspace_hash_created_at_idx
  on public.observability_events (workspace_hash, created_at desc)
  where workspace_hash is not null;

create table if not exists public.observability_incidents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  alert_key text not null,
  route_key text not null,
  metric_name text not null,
  status text not null default 'open',
  severity text not null,
  metric_value numeric(12, 2) not null,
  threshold_value numeric(12, 2) not null,
  window_started_at timestamptz not null,
  window_ended_at timestamptz not null,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observability_incidents_alert_key_length
    check (char_length(alert_key) between 5 and 160),
  constraint observability_incidents_route_key_length
    check (char_length(route_key) between 3 and 120),
  constraint observability_incidents_metric_name_valid
    check (metric_name in ('error_rate_10m', 'p95_latency_10m')),
  constraint observability_incidents_status_valid
    check (status in ('open', 'acknowledged', 'resolved')),
  constraint observability_incidents_severity_valid
    check (severity in ('warning', 'critical')),
  constraint observability_incidents_metric_value_range
    check (metric_value >= 0 and metric_value <= 1000000),
  constraint observability_incidents_threshold_value_range
    check (threshold_value >= 0 and threshold_value <= 1000000),
  constraint observability_incidents_window_valid
    check (window_started_at <= window_ended_at),
  constraint observability_incidents_context_object
    check (jsonb_typeof(context) = 'object')
);

create index if not exists observability_incidents_workspace_status_updated_idx
  on public.observability_incidents (workspace_id, status, updated_at desc);

create index if not exists observability_incidents_route_status_updated_idx
  on public.observability_incidents (route_key, status, updated_at desc);

create unique index if not exists observability_incidents_active_alert_unique
  on public.observability_incidents (workspace_id, alert_key)
  where status in ('open', 'acknowledged');

create or replace function public.workspace_hash_from_workspace_id(target_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select encode(
    extensions.digest(lower('workspace:' || target_workspace_id::text), 'sha256'),
    'hex'
  );
$$;

create or replace view public.observability_workspace_error_rate_10m as
with workspace_hashes as (
  select
    w.id as workspace_id,
    public.workspace_hash_from_workspace_id(w.id) as workspace_hash
  from public.workspaces w
)
select
  wh.workspace_id,
  e.route_key,
  count(*)::bigint as total_count,
  count(*) filter (where e.status = 'fail')::bigint as fail_count,
  count(*) filter (where e.status = 'rate_limited')::bigint as rate_limited_count,
  round(
    case
      when count(*) = 0 then 0::numeric
      else (count(*) filter (where e.status = 'fail')::numeric / count(*)::numeric) * 100
    end,
    2
  ) as fail_rate_percent,
  min(e.created_at) as window_started_at,
  max(e.created_at) as window_ended_at
from public.observability_events e
join workspace_hashes wh on wh.workspace_hash = e.workspace_hash
where e.workspace_hash is not null
  and e.created_at >= now() - interval '10 minutes'
group by wh.workspace_id, e.route_key;

create or replace view public.observability_workspace_latency_p95_10m as
with workspace_hashes as (
  select
    w.id as workspace_id,
    public.workspace_hash_from_workspace_id(w.id) as workspace_hash
  from public.workspaces w
)
select
  wh.workspace_id,
  e.route_key,
  count(*)::bigint as sample_count,
  round(
    percentile_cont(0.95) within group (order by e.duration_ms)::numeric,
    2
  ) as p95_duration_ms,
  round(
    percentile_cont(0.99) within group (order by e.duration_ms)::numeric,
    2
  ) as p99_duration_ms,
  min(e.created_at) as window_started_at,
  max(e.created_at) as window_ended_at
from public.observability_events e
join workspace_hashes wh on wh.workspace_hash = e.workspace_hash
where e.workspace_hash is not null
  and e.created_at >= now() - interval '10 minutes'
group by wh.workspace_id, e.route_key;

create or replace function public.evaluate_observability_alerts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
  v_updated integer := 0;
  v_resolved integer := 0;
begin
  with triggered as (
    select
      e.workspace_id,
      ('error_rate:' || e.route_key) as alert_key,
      e.route_key,
      'error_rate_10m'::text as metric_name,
      'critical'::text as severity,
      e.fail_rate_percent::numeric(12, 2) as metric_value,
      5::numeric(12, 2) as threshold_value,
      e.window_started_at,
      e.window_ended_at,
      jsonb_build_object(
        'failCount', e.fail_count,
        'rateLimitedCount', e.rate_limited_count,
        'totalCount', e.total_count,
        'threshold', 5,
        'window', '10m'
      ) as context
    from public.observability_workspace_error_rate_10m e
    where e.fail_rate_percent > 5

    union all

    select
      l.workspace_id,
      ('p95_latency:' || l.route_key) as alert_key,
      l.route_key,
      'p95_latency_10m'::text as metric_name,
      'warning'::text as severity,
      l.p95_duration_ms::numeric(12, 2) as metric_value,
      500::numeric(12, 2) as threshold_value,
      l.window_started_at,
      l.window_ended_at,
      jsonb_build_object(
        'p95DurationMs', l.p95_duration_ms,
        'p99DurationMs', l.p99_duration_ms,
        'sampleCount', l.sample_count,
        'threshold', 500,
        'window', '10m'
      ) as context
    from public.observability_workspace_latency_p95_10m l
    where l.p95_duration_ms > 500
  ),
  inserted as (
    insert into public.observability_incidents (
      workspace_id,
      alert_key,
      route_key,
      metric_name,
      status,
      severity,
      metric_value,
      threshold_value,
      window_started_at,
      window_ended_at,
      context,
      created_at,
      updated_at
    )
    select
      t.workspace_id,
      t.alert_key,
      t.route_key,
      t.metric_name,
      'open',
      t.severity,
      t.metric_value,
      t.threshold_value,
      t.window_started_at,
      t.window_ended_at,
      t.context,
      now(),
      now()
    from triggered t
    where not exists (
      select 1
      from public.observability_incidents oi
      where oi.workspace_id = t.workspace_id
        and oi.alert_key = t.alert_key
        and oi.status in ('open', 'acknowledged')
    )
    returning 1
  )
  select count(*) into v_inserted from inserted;

  with triggered as (
    select
      e.workspace_id,
      ('error_rate:' || e.route_key) as alert_key,
      e.route_key,
      'error_rate_10m'::text as metric_name,
      'critical'::text as severity,
      e.fail_rate_percent::numeric(12, 2) as metric_value,
      5::numeric(12, 2) as threshold_value,
      e.window_started_at,
      e.window_ended_at,
      jsonb_build_object(
        'failCount', e.fail_count,
        'rateLimitedCount', e.rate_limited_count,
        'totalCount', e.total_count,
        'threshold', 5,
        'window', '10m'
      ) as context
    from public.observability_workspace_error_rate_10m e
    where e.fail_rate_percent > 5

    union all

    select
      l.workspace_id,
      ('p95_latency:' || l.route_key) as alert_key,
      l.route_key,
      'p95_latency_10m'::text as metric_name,
      'warning'::text as severity,
      l.p95_duration_ms::numeric(12, 2) as metric_value,
      500::numeric(12, 2) as threshold_value,
      l.window_started_at,
      l.window_ended_at,
      jsonb_build_object(
        'p95DurationMs', l.p95_duration_ms,
        'p99DurationMs', l.p99_duration_ms,
        'sampleCount', l.sample_count,
        'threshold', 500,
        'window', '10m'
      ) as context
    from public.observability_workspace_latency_p95_10m l
    where l.p95_duration_ms > 500
  ),
  updated as (
    update public.observability_incidents oi
    set
      route_key = t.route_key,
      metric_name = t.metric_name,
      severity = t.severity,
      metric_value = t.metric_value,
      threshold_value = t.threshold_value,
      window_started_at = t.window_started_at,
      window_ended_at = t.window_ended_at,
      context = t.context,
      updated_at = now()
    from triggered t
    where oi.workspace_id = t.workspace_id
      and oi.alert_key = t.alert_key
      and oi.status in ('open', 'acknowledged')
    returning 1
  )
  select count(*) into v_updated from updated;

  with triggered as (
    select
      e.workspace_id,
      ('error_rate:' || e.route_key) as alert_key
    from public.observability_workspace_error_rate_10m e
    where e.fail_rate_percent > 5

    union all

    select
      l.workspace_id,
      ('p95_latency:' || l.route_key) as alert_key
    from public.observability_workspace_latency_p95_10m l
    where l.p95_duration_ms > 500
  ),
  resolved as (
    update public.observability_incidents oi
    set
      status = 'resolved',
      resolved_at = now(),
      resolved_by = null,
      updated_at = now()
    where oi.status in ('open', 'acknowledged')
      and not exists (
        select 1
        from triggered t
        where t.workspace_id = oi.workspace_id
          and t.alert_key = oi.alert_key
      )
    returning 1
  )
  select count(*) into v_resolved from resolved;

  return v_inserted + v_updated + v_resolved;
end;
$$;

create or replace function public.ack_observability_incident(
  p_incident_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
begin
  if p_incident_id is null then
    raise exception using errcode = '22023', message = 'Incident id is required.';
  end if;

  select oi.workspace_id
  into v_workspace_id
  from public.observability_incidents oi
  where oi.id = p_incident_id;

  if v_workspace_id is null then
    raise exception using errcode = '22023', message = 'Incident not found.';
  end if;

  if not public.is_workspace_admin(v_workspace_id) then
    raise exception using errcode = '42501', message = 'Only workspace admin can acknowledge incidents.';
  end if;

  update public.observability_incidents oi
  set
    status = 'acknowledged',
    acknowledged_at = now(),
    acknowledged_by = auth.uid(),
    updated_at = now()
  where oi.id = p_incident_id
    and oi.status = 'open';
end;
$$;

create or replace function public.resolve_observability_incident(
  p_incident_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
begin
  if p_incident_id is null then
    raise exception using errcode = '22023', message = 'Incident id is required.';
  end if;

  select oi.workspace_id
  into v_workspace_id
  from public.observability_incidents oi
  where oi.id = p_incident_id;

  if v_workspace_id is null then
    raise exception using errcode = '22023', message = 'Incident not found.';
  end if;

  if not public.is_workspace_admin(v_workspace_id) then
    raise exception using errcode = '42501', message = 'Only workspace admin can resolve incidents.';
  end if;

  update public.observability_incidents oi
  set
    status = 'resolved',
    resolved_at = now(),
    resolved_by = auth.uid(),
    updated_at = now()
  where oi.id = p_incident_id
    and oi.status in ('open', 'acknowledged');
end;
$$;

create or replace view public.current_observability_alerts as
select
  oi.id,
  oi.workspace_id,
  oi.alert_key,
  oi.route_key,
  oi.metric_name,
  oi.status,
  oi.severity,
  oi.metric_value,
  oi.threshold_value,
  oi.window_started_at,
  oi.window_ended_at,
  oi.context,
  oi.created_at,
  oi.updated_at
from public.observability_incidents oi
where oi.status in ('open', 'acknowledged');

alter table public.observability_incidents enable row level security;

drop policy if exists observability_incidents_select_policy on public.observability_incidents;
create policy observability_incidents_select_policy
on public.observability_incidents
for select
to authenticated
using (public.is_workspace_admin(workspace_id));

drop policy if exists observability_incidents_update_policy on public.observability_incidents;
create policy observability_incidents_update_policy
on public.observability_incidents
for update
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

revoke all on table public.observability_incidents from public;
revoke all on table public.observability_incidents from anon;
revoke all on table public.observability_incidents from authenticated;
grant select, update on table public.observability_incidents to authenticated;

revoke all on function public.workspace_hash_from_workspace_id(uuid) from public;
grant execute on function public.workspace_hash_from_workspace_id(uuid) to authenticated;

revoke all on function public.evaluate_observability_alerts() from public;
grant execute on function public.evaluate_observability_alerts() to authenticated;

revoke all on function public.ack_observability_incident(uuid) from public;
grant execute on function public.ack_observability_incident(uuid) to authenticated;

revoke all on function public.resolve_observability_incident(uuid) from public;
grant execute on function public.resolve_observability_incident(uuid) to authenticated;

revoke all on table public.current_observability_alerts from public;
revoke all on table public.current_observability_alerts from anon;
revoke all on table public.current_observability_alerts from authenticated;

revoke all on table public.observability_workspace_error_rate_10m from public;
revoke all on table public.observability_workspace_error_rate_10m from anon;
revoke all on table public.observability_workspace_error_rate_10m from authenticated;

revoke all on table public.observability_workspace_latency_p95_10m from public;
revoke all on table public.observability_workspace_latency_p95_10m from anon;
revoke all on table public.observability_workspace_latency_p95_10m from authenticated;
