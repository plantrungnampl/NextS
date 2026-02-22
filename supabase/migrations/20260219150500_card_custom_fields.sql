alter table public.cards
  add column if not exists status text,
  add column if not exists priority text,
  add column if not exists effort text;

alter table public.cards
  drop constraint if exists cards_status_valid,
  drop constraint if exists cards_priority_valid,
  drop constraint if exists cards_effort_length;

alter table public.cards
  add constraint cards_status_valid
  check (
    status is null
    or status in ('todo', 'in_progress', 'done', 'in_review', 'approved', 'not_sure')
  ),
  add constraint cards_priority_valid
  check (
    priority is null
    or priority in ('low', 'medium', 'high')
  ),
  add constraint cards_effort_length
  check (
    effort is null
    or char_length(effort) <= 120
  );

create index if not exists cards_status_idx on public.cards (status) where status is not null;
create index if not exists cards_priority_idx on public.cards (priority) where priority is not null;
