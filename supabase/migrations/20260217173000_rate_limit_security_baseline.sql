create table if not exists public.rate_limit_hits (
  bucket text not null,
  subject_hash text not null,
  window_start timestamptz not null,
  hit_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rate_limit_hits_bucket_length check (char_length(bucket) between 3 and 120),
  constraint rate_limit_hits_subject_hash_length check (char_length(subject_hash) between 32 and 128),
  constraint rate_limit_hits_hit_count_non_negative check (hit_count >= 0),
  primary key (bucket, subject_hash, window_start)
);

create index if not exists rate_limit_hits_window_start_idx
  on public.rate_limit_hits (window_start);

create or replace function public.consume_rate_limit(
  p_bucket text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_bucket text := lower(trim(coalesce(p_bucket, '')));
  v_subject_hash text := trim(coalesce(p_subject_hash, ''));
  v_window_start timestamptz;
  v_reset_at timestamptz;
  v_hit_count integer;
begin
  if char_length(v_bucket) < 3 or char_length(v_bucket) > 120 then
    raise exception using errcode = '22023', message = 'Invalid rate limit bucket.';
  end if;

  if char_length(v_subject_hash) < 32 or char_length(v_subject_hash) > 128 then
    raise exception using errcode = '22023', message = 'Invalid rate limit subject.';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception using errcode = '22023', message = 'Invalid rate limit threshold.';
  end if;

  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception using errcode = '22023', message = 'Invalid rate limit window.';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );
  v_reset_at := v_window_start + make_interval(secs => p_window_seconds);

  insert into public.rate_limit_hits (
    bucket,
    subject_hash,
    window_start,
    hit_count,
    created_at,
    updated_at
  )
  values (
    v_bucket,
    v_subject_hash,
    v_window_start,
    1,
    v_now,
    v_now
  )
  on conflict (bucket, subject_hash, window_start)
  do update
  set
    hit_count = public.rate_limit_hits.hit_count + 1,
    updated_at = v_now
  returning hit_count into v_hit_count;

  delete from public.rate_limit_hits
  where window_start < v_now - make_interval(secs => greatest(p_window_seconds * 20, 3600));

  allowed := v_hit_count <= p_limit;
  remaining := greatest(p_limit - v_hit_count, 0);
  retry_after_seconds := greatest(
    1,
    ceil(extract(epoch from (v_reset_at - v_now)))::integer
  );
  return next;
end;
$$;

revoke all on table public.rate_limit_hits from public;
revoke all on table public.rate_limit_hits from anon;
revoke all on table public.rate_limit_hits from authenticated;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to anon;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to authenticated;
