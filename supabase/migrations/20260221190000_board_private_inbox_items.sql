create table if not exists public.board_private_inbox_items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  position double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id, user_id, card_id)
);

create index if not exists board_private_inbox_items_board_user_position_idx
  on public.board_private_inbox_items (board_id, user_id, position asc);

create index if not exists board_private_inbox_items_user_created_idx
  on public.board_private_inbox_items (user_id, created_at desc);

alter table public.board_private_inbox_items enable row level security;

drop policy if exists board_private_inbox_items_select_policy on public.board_private_inbox_items;
create policy board_private_inbox_items_select_policy
on public.board_private_inbox_items
for select
to authenticated
using (
  user_id = (select auth.uid())
  and public.can_read_board(board_id)
);

drop policy if exists board_private_inbox_items_insert_policy on public.board_private_inbox_items;
create policy board_private_inbox_items_insert_policy
on public.board_private_inbox_items
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and public.can_read_board(board_id)
);

drop policy if exists board_private_inbox_items_update_policy on public.board_private_inbox_items;
create policy board_private_inbox_items_update_policy
on public.board_private_inbox_items
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

drop policy if exists board_private_inbox_items_delete_policy on public.board_private_inbox_items;
create policy board_private_inbox_items_delete_policy
on public.board_private_inbox_items
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and public.can_read_board(board_id)
);

-- Archive legacy shared inbox lists to avoid confusion with the new per-user private inbox model.
update public.lists
set archived_at = now()
where archived_at is null
  and lower(trim(title)) in ('hộp thư đến', 'hop thu den', 'inbox');
