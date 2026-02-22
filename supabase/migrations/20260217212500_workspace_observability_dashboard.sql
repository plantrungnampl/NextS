create or replace function public.get_workspace_observability_dashboard(
  p_workspace_id uuid,
  p_hours integer default 12
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid := p_workspace_id;
  v_hours integer := greatest(6, least(coalesce(p_hours, 12), 48));
  v_workspace_hash text;
  v_payload jsonb;
begin
  if v_workspace_id is null then
    raise exception using errcode = '22023', message = 'Workspace id is required.';
  end if;

  if not public.is_workspace_admin(v_workspace_id) then
    raise exception using errcode = '42501', message = 'Only workspace admin can view observability dashboard.';
  end if;

  v_workspace_hash := public.workspace_hash_from_workspace_id(v_workspace_id);

  with windowed as (
    select
      oe.created_at,
      oe.status,
      oe.duration_ms
    from public.observability_events oe
    where oe.workspace_hash = v_workspace_hash
      and oe.created_at >= now() - make_interval(hours => v_hours)
  ),
  summary as (
    select
      count(*)::bigint as total_requests,
      count(*) filter (where status = 'fail')::bigint as failed_requests,
      count(*) filter (where status = 'rate_limited')::bigint as rate_limited_requests,
      round(
        case
          when count(*) = 0 then 0::numeric
          else (count(*) filter (where status = 'success')::numeric / count(*)::numeric) * 100
        end,
        2
      ) as success_rate_percent,
      coalesce(round(avg(duration_ms)::numeric, 2), 0::numeric) as avg_duration_ms,
      coalesce(
        round(percentile_cont(0.95) within group (order by duration_ms)::numeric, 2),
        0::numeric
      ) as p95_duration_ms
    from windowed
  ),
  recent_10m as (
    select
      oe.status,
      oe.duration_ms
    from public.observability_events oe
    where oe.workspace_hash = v_workspace_hash
      and oe.created_at >= now() - interval '10 minutes'
  ),
  recent_signals as (
    select
      round(
        case
          when count(*) = 0 then 0::numeric
          else (count(*) filter (where status = 'fail')::numeric / count(*)::numeric) * 100
        end,
        2
      ) as error_rate_10m_percent,
      coalesce(
        round(percentile_cont(0.95) within group (order by duration_ms)::numeric, 2),
        0::numeric
      ) as p95_latency_10m_ms
    from recent_10m
  ),
  incidents as (
    select
      count(*) filter (where oi.status = 'open')::integer as open_count,
      count(*) filter (where oi.status = 'acknowledged')::integer as acknowledged_count,
      count(*) filter (
        where oi.status = 'resolved'
          and oi.resolved_at >= now() - make_interval(hours => v_hours)
      )::integer as resolved_count_window
    from public.observability_incidents oi
    where oi.workspace_id = v_workspace_id
  ),
  buckets as (
    select generate_series(
      date_trunc('hour', now() - make_interval(hours => v_hours - 1)),
      date_trunc('hour', now()),
      interval '1 hour'
    ) as bucket_start
  ),
  bucket_rollup as (
    select
      b.bucket_start,
      count(w.created_at)::bigint as total_requests,
      count(*) filter (where w.status = 'fail')::bigint as failed_requests,
      round(
        case
          when count(w.created_at) = 0 then 0::numeric
          else (count(*) filter (where w.status = 'fail')::numeric / count(w.created_at)::numeric) * 100
        end,
        2
      ) as error_rate_percent,
      coalesce(
        round(percentile_cont(0.95) within group (order by w.duration_ms)::numeric, 2),
        0::numeric
      ) as p95_duration_ms
    from buckets b
    left join windowed w
      on w.created_at >= b.bucket_start
      and w.created_at < b.bucket_start + interval '1 hour'
    group by b.bucket_start
    order by b.bucket_start
  )
  select jsonb_build_object(
    'windowHours', v_hours,
    'summary', jsonb_build_object(
      'totalRequests', s.total_requests,
      'failedRequests', s.failed_requests,
      'rateLimitedRequests', s.rate_limited_requests,
      'successRatePercent', s.success_rate_percent,
      'avgDurationMs', s.avg_duration_ms,
      'p95DurationMs', s.p95_duration_ms
    ),
    'signals', jsonb_build_object(
      'errorRate10mPercent', rs.error_rate_10m_percent,
      'p95Latency10mMs', rs.p95_latency_10m_ms
    ),
    'incidents', jsonb_build_object(
      'openCount', i.open_count,
      'acknowledgedCount', i.acknowledged_count,
      'resolvedCountInWindow', i.resolved_count_window
    ),
    'trend', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'bucketStart', br.bucket_start,
            'totalRequests', br.total_requests,
            'failedRequests', br.failed_requests,
            'errorRatePercent', br.error_rate_percent,
            'p95DurationMs', br.p95_duration_ms
          )
          order by br.bucket_start
        )
        from bucket_rollup br
      ),
      '[]'::jsonb
    )
  )
  into v_payload
  from summary s
  cross join recent_signals rs
  cross join incidents i;

  return coalesce(v_payload, '{}'::jsonb);
end;
$$;

revoke all on function public.get_workspace_observability_dashboard(uuid, integer) from public;
grant execute on function public.get_workspace_observability_dashboard(uuid, integer) to authenticated;
