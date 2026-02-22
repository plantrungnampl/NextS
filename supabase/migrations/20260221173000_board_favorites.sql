create table if not exists public.board_favorites (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create index if not exists board_favorites_user_created_idx
  on public.board_favorites (user_id, created_at desc);

alter table public.board_favorites enable row level security;

drop policy if exists board_favorites_select_policy on public.board_favorites;
create policy board_favorites_select_policy
on public.board_favorites
for select
to authenticated
using (public.can_read_board(board_id));

drop policy if exists board_favorites_insert_policy on public.board_favorites;
create policy board_favorites_insert_policy
on public.board_favorites
for insert
to authenticated
with check (
  public.can_read_board(board_id)
  and user_id = (select auth.uid())
);

drop policy if exists board_favorites_delete_policy on public.board_favorites;
create policy board_favorites_delete_policy
on public.board_favorites
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and public.can_read_board(board_id)
);
