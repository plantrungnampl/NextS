create table if not exists public.card_checklist_items (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  body text not null,
  is_done boolean not null default false,
  position numeric(20, 8) not null default 1024,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint card_checklist_items_body_length check (char_length(body) between 1 and 500),
  constraint card_checklist_items_position_positive check (position >= 0)
);

create index if not exists card_checklist_items_card_position_idx
  on public.card_checklist_items (card_id, position);

create index if not exists card_checklist_items_card_done_idx
  on public.card_checklist_items (card_id, is_done);

drop trigger if exists touch_card_checklist_items_updated_at on public.card_checklist_items;
create trigger touch_card_checklist_items_updated_at
before update on public.card_checklist_items
for each row
execute function public.touch_updated_at();

alter table public.card_checklist_items enable row level security;

drop policy if exists card_checklist_items_select_policy on public.card_checklist_items;
create policy card_checklist_items_select_policy
on public.card_checklist_items
for select
to authenticated
using (public.can_read_board(public.card_board_id(card_id)));

drop policy if exists card_checklist_items_insert_policy on public.card_checklist_items;
create policy card_checklist_items_insert_policy
on public.card_checklist_items
for insert
to authenticated
with check (
  public.can_write_board(public.card_board_id(card_id))
  and created_by = (select auth.uid())
);

drop policy if exists card_checklist_items_update_policy on public.card_checklist_items;
create policy card_checklist_items_update_policy
on public.card_checklist_items
for update
to authenticated
using (public.can_write_board(public.card_board_id(card_id)))
with check (public.can_write_board(public.card_board_id(card_id)));

drop policy if exists card_checklist_items_delete_policy on public.card_checklist_items;
create policy card_checklist_items_delete_policy
on public.card_checklist_items
for delete
to authenticated
using (public.can_write_board(public.card_board_id(card_id)));
