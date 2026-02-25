alter table public.cards
  add column if not exists is_template boolean not null default false;

create index if not exists cards_is_template_idx
  on public.cards (is_template)
  where is_template = true;
