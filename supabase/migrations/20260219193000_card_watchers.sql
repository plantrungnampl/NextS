create table if not exists public.card_watchers (
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, user_id)
);

create index if not exists card_watchers_user_idx
  on public.card_watchers (user_id, created_at desc);

alter table public.card_watchers enable row level security;

drop policy if exists card_watchers_select_policy on public.card_watchers;
create policy card_watchers_select_policy
on public.card_watchers
for select
to authenticated
using (public.can_read_board(public.card_board_id(card_id)));

drop policy if exists card_watchers_insert_policy on public.card_watchers;
create policy card_watchers_insert_policy
on public.card_watchers
for insert
to authenticated
with check (
  public.can_read_board(public.card_board_id(card_id))
  and user_id = (select auth.uid())
);

drop policy if exists card_watchers_delete_policy on public.card_watchers;
create policy card_watchers_delete_policy
on public.card_watchers
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and public.can_read_board(public.card_board_id(card_id))
);
