alter table public.cards
  add column if not exists is_completed boolean not null default false,
  add column if not exists completed_at timestamptz;

create index if not exists cards_is_completed_idx
  on public.cards (is_completed, updated_at desc);

create index if not exists cards_completed_at_idx
  on public.cards (completed_at desc)
  where completed_at is not null;
