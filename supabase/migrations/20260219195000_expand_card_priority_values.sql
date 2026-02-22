alter table public.cards
  drop constraint if exists cards_priority_valid;

alter table public.cards
  add constraint cards_priority_valid
  check (
    priority is null
    or priority in ('highest', 'high', 'medium', 'low', 'lowest', 'not_sure')
  );
