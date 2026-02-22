create extension if not exists pg_cron;

do $schedule$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'observability_evaluate_alerts_every_2m'
  ) then
    perform cron.unschedule('observability_evaluate_alerts_every_2m');
  end if;

  perform cron.schedule(
    'observability_evaluate_alerts_every_2m',
    '*/2 * * * *',
    'select public.evaluate_observability_alerts();'
  );
end;
$schedule$;
