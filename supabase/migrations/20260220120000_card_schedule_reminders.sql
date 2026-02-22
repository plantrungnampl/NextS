alter table public.profiles
  add column if not exists timezone text not null default 'UTC';

alter table public.profiles
  drop constraint if exists profiles_timezone_length;

alter table public.profiles
  add constraint profiles_timezone_length
  check (char_length(timezone) between 3 and 64);

alter table public.cards
  add column if not exists start_at timestamptz,
  add column if not exists has_start_time boolean not null default false,
  add column if not exists has_due_time boolean not null default true,
  add column if not exists reminder_offset_minutes integer,
  add column if not exists recurrence_rrule text,
  add column if not exists recurrence_anchor_at timestamptz,
  add column if not exists recurrence_tz text;

alter table public.cards
  drop constraint if exists cards_start_before_due;

alter table public.cards
  add constraint cards_start_before_due
  check (
    start_at is null
    or due_at is null
    or start_at <= due_at
  );

alter table public.cards
  drop constraint if exists cards_reminder_offset_range;

alter table public.cards
  add constraint cards_reminder_offset_range
  check (
    reminder_offset_minutes is null
    or reminder_offset_minutes between -43200 and 0
  );

alter table public.cards
  drop constraint if exists cards_recurrence_rrule_length;

alter table public.cards
  add constraint cards_recurrence_rrule_length
  check (
    recurrence_rrule is null
    or char_length(recurrence_rrule) between 6 and 512
  );

alter table public.cards
  drop constraint if exists cards_recurrence_tz_length;

alter table public.cards
  add constraint cards_recurrence_tz_length
  check (
    recurrence_tz is null
    or char_length(recurrence_tz) between 3 and 64
  );

create index if not exists cards_start_at_idx
  on public.cards (start_at)
  where start_at is not null;

create index if not exists cards_reminder_due_idx
  on public.cards (due_at, reminder_offset_minutes)
  where due_at is not null and reminder_offset_minutes is not null;

create table if not exists public.card_reminder_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint card_reminder_outbox_channel_valid
    check (channel in ('in_app', 'email')),
  constraint card_reminder_outbox_status_valid
    check (status in ('pending', 'processing', 'sent', 'failed', 'canceled')),
  constraint card_reminder_outbox_attempts_non_negative
    check (attempts >= 0)
);

create unique index if not exists card_reminder_outbox_identity_unique
  on public.card_reminder_outbox (card_id, recipient_user_id, channel, scheduled_for);

create index if not exists card_reminder_outbox_status_scheduled_idx
  on public.card_reminder_outbox (status, scheduled_for, channel);

create table if not exists public.card_notification_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  outbox_id uuid unique references public.card_reminder_outbox(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint card_notification_events_type_valid
    check (event_type in ('due_reminder')),
  constraint card_notification_events_payload_is_object
    check (jsonb_typeof(payload) = 'object')
);

create index if not exists card_notification_events_user_created_idx
  on public.card_notification_events (user_id, created_at desc);

create index if not exists card_notification_events_user_unread_idx
  on public.card_notification_events (user_id, created_at desc)
  where read_at is null;

create or replace function public.card_workspace_id(target_card_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.workspace_id
  from public.cards c
  join public.boards b on b.id = c.board_id
  where c.id = target_card_id;
$$;

revoke all
on function public.card_workspace_id(uuid)
from public;

grant execute
on function public.card_workspace_id(uuid)
to authenticated;

create or replace function public.card_reminder_recipients(
  target_card_id uuid,
  fallback_user_id uuid
)
returns table(user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with assignees as (
    select ca.user_id
    from public.card_assignees ca
    where ca.card_id = target_card_id
  )
  select a.user_id
  from assignees a
  union
  select fallback_user_id
  where fallback_user_id is not null
    and not exists (select 1 from assignees);
$$;

revoke all
on function public.card_reminder_recipients(uuid, uuid)
from public;

grant execute
on function public.card_reminder_recipients(uuid, uuid)
to authenticated;

create or replace function public.enqueue_card_due_reminders(max_ahead_minutes integer default 15)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  with due_cards as (
    select
      c.id as card_id,
      c.board_id,
      b.workspace_id,
      c.created_by,
      c.title,
      c.due_at,
      c.reminder_offset_minutes,
      c.recurrence_rrule,
      c.recurrence_tz,
      c.due_at + make_interval(mins => c.reminder_offset_minutes) as scheduled_for
    from public.cards c
    join public.boards b on b.id = c.board_id
    where c.archived_at is null
      and c.due_at is not null
      and c.reminder_offset_minutes is not null
      and (
        c.due_at + make_interval(mins => c.reminder_offset_minutes)
      ) <= now() + make_interval(mins => greatest(max_ahead_minutes, 1))
      and (
        c.due_at + make_interval(mins => c.reminder_offset_minutes)
      ) > now() - interval '5 minutes'
  ),
  recipients as (
    select
      d.workspace_id,
      d.board_id,
      d.card_id,
      d.title,
      d.due_at,
      d.scheduled_for,
      d.recurrence_rrule,
      d.recurrence_tz,
      r.user_id as recipient_user_id
    from due_cards d
    cross join lateral public.card_reminder_recipients(d.card_id, d.created_by) r
  ),
  channels as (
    select
      r.workspace_id,
      r.board_id,
      r.card_id,
      r.recipient_user_id,
      r.scheduled_for,
      unnest(array['in_app', 'email']::text[]) as channel
    from recipients r
  ),
  inserted as (
    insert into public.card_reminder_outbox (
      workspace_id,
      board_id,
      card_id,
      recipient_user_id,
      channel,
      scheduled_for,
      status,
      created_at,
      updated_at
    )
    select
      c.workspace_id,
      c.board_id,
      c.card_id,
      c.recipient_user_id,
      c.channel,
      c.scheduled_for,
      'pending',
      now(),
      now()
    from channels c
    where not exists (
      select 1
      from public.card_reminder_outbox o
      where o.card_id = c.card_id
        and o.recipient_user_id = c.recipient_user_id
        and o.channel = c.channel
        and o.scheduled_for = c.scheduled_for
    )
    returning 1
  )
  select count(*) into inserted_count
  from inserted;

  return inserted_count;
end;
$$;

create or replace function public.dispatch_in_app_card_reminders(max_rows integer default 200)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  processed_count integer := 0;
begin
  with picked as (
    select
      o.id,
      o.workspace_id,
      o.board_id,
      o.card_id,
      o.recipient_user_id,
      o.scheduled_for
    from public.card_reminder_outbox o
    where o.channel = 'in_app'
      and o.status = 'pending'
      and o.scheduled_for <= now()
    order by o.scheduled_for asc
    limit greatest(max_rows, 1)
    for update skip locked
  ),
  inserted_events as (
    insert into public.card_notification_events (
      workspace_id,
      board_id,
      user_id,
      card_id,
      outbox_id,
      event_type,
      payload,
      created_at
    )
    select
      p.workspace_id,
      p.board_id,
      p.recipient_user_id,
      p.card_id,
      p.id,
      'due_reminder',
      jsonb_build_object(
        'scheduledFor', p.scheduled_for,
        'cardId', p.card_id,
        'boardId', p.board_id
      ),
      now()
    from picked p
    on conflict (outbox_id) do nothing
    returning outbox_id
  ),
  marked as (
    update public.card_reminder_outbox o
    set
      status = 'sent',
      sent_at = now(),
      attempts = o.attempts + 1,
      updated_at = now()
    where o.id in (select p.id from picked p)
    returning 1
  )
  select count(*) into processed_count
  from marked;

  return processed_count;
end;
$$;

create or replace function public.claim_email_card_reminders(max_rows integer default 100)
returns setof public.card_reminder_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select o.id
    from public.card_reminder_outbox o
    where o.channel = 'email'
      and o.status = 'pending'
      and o.scheduled_for <= now()
    order by o.scheduled_for asc
    limit greatest(max_rows, 1)
    for update skip locked
  ),
  claimed as (
    update public.card_reminder_outbox o
    set
      status = 'processing',
      attempts = o.attempts + 1,
      updated_at = now()
    where o.id in (select p.id from picked p)
    returning o.*
  )
  select *
  from claimed;
end;
$$;

create or replace function public.mark_card_reminder_email_sent(target_outbox_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.card_reminder_outbox o
  set
    status = 'sent',
    sent_at = now(),
    updated_at = now(),
    last_error = null
  where o.id = target_outbox_id
    and o.channel = 'email'
    and o.status = 'processing';
$$;

create or replace function public.mark_card_reminder_email_failed(
  target_outbox_id uuid,
  error_message text,
  should_retry boolean default true
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.card_reminder_outbox o
  set
    status = case
      when should_retry and o.attempts < 5 then 'pending'
      else 'failed'
    end,
    scheduled_for = case
      when should_retry and o.attempts < 5
        then now() + make_interval(mins => least(60, greatest(5, o.attempts * 10)))
      else o.scheduled_for
    end,
    last_error = left(coalesce(error_message, 'unknown email send error'), 2000),
    updated_at = now()
  where o.id = target_outbox_id
    and o.channel = 'email'
    and o.status = 'processing';
$$;

revoke all
on function public.enqueue_card_due_reminders(integer)
from public;

grant execute
on function public.enqueue_card_due_reminders(integer)
to authenticated;

revoke all
on function public.dispatch_in_app_card_reminders(integer)
from public;

grant execute
on function public.dispatch_in_app_card_reminders(integer)
to authenticated;

revoke all
on function public.claim_email_card_reminders(integer)
from public;

grant execute
on function public.claim_email_card_reminders(integer)
to authenticated;

revoke all
on function public.mark_card_reminder_email_sent(uuid)
from public;

grant execute
on function public.mark_card_reminder_email_sent(uuid)
to authenticated;

revoke all
on function public.mark_card_reminder_email_failed(uuid, text, boolean)
from public;

grant execute
on function public.mark_card_reminder_email_failed(uuid, text, boolean)
to authenticated;

alter table public.card_reminder_outbox enable row level security;
alter table public.card_notification_events enable row level security;

drop policy if exists card_reminder_outbox_select_policy on public.card_reminder_outbox;
create policy card_reminder_outbox_select_policy
on public.card_reminder_outbox
for select
to authenticated
using (
  recipient_user_id = (select auth.uid())
  and public.can_read_board(board_id)
);

drop policy if exists card_notification_events_select_policy on public.card_notification_events;
create policy card_notification_events_select_policy
on public.card_notification_events
for select
to authenticated
using (
  user_id = (select auth.uid())
  and public.can_read_board(board_id)
);

drop policy if exists card_notification_events_update_policy on public.card_notification_events;
create policy card_notification_events_update_policy
on public.card_notification_events
for update
to authenticated
using (
  user_id = (select auth.uid())
  and public.can_read_board(board_id)
)
with check (
  user_id = (select auth.uid())
  and public.can_read_board(board_id)
);

create extension if not exists pg_cron;

do $schedule$
declare
  enqueue_job_id bigint;
  dispatch_job_id bigint;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;

  select j.jobid
  into enqueue_job_id
  from cron.job j
  where j.jobname = 'card_reminders_enqueue_every_minute'
  order by j.jobid desc
  limit 1;

  if enqueue_job_id is not null then
    perform cron.unschedule(enqueue_job_id);
  end if;

  perform cron.schedule(
    'card_reminders_enqueue_every_minute',
    '* * * * *',
    'select public.enqueue_card_due_reminders(15);'
  );

  select j.jobid
  into dispatch_job_id
  from cron.job j
  where j.jobname = 'card_reminders_dispatch_in_app_every_minute'
  order by j.jobid desc
  limit 1;

  if dispatch_job_id is not null then
    perform cron.unschedule(dispatch_job_id);
  end if;

  perform cron.schedule(
    'card_reminders_dispatch_in_app_every_minute',
    '* * * * *',
    'select public.dispatch_in_app_card_reminders(300);'
  );
end;
$schedule$;
