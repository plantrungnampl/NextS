create table if not exists public.card_checklists (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  title text not null,
  position numeric(20, 8) not null default 1024,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint card_checklists_title_length check (char_length(title) between 1 and 120),
  constraint card_checklists_position_positive check (position >= 0)
);

create index if not exists card_checklists_card_position_idx
  on public.card_checklists (card_id, position);

drop trigger if exists touch_card_checklists_updated_at on public.card_checklists;
create trigger touch_card_checklists_updated_at
before update on public.card_checklists
for each row
execute function public.touch_updated_at();

create or replace function public.checklist_board_id(target_checklist_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.board_id
  from public.card_checklists cl
  join public.cards c
    on c.id = cl.card_id
  where cl.id = target_checklist_id;
$$;

revoke all
on function public.checklist_board_id(uuid)
from public;

grant execute
on function public.checklist_board_id(uuid)
to authenticated;

alter table public.card_checklists enable row level security;

drop policy if exists card_checklists_select_policy on public.card_checklists;
create policy card_checklists_select_policy
on public.card_checklists
for select
to authenticated
using (public.can_read_board(public.card_board_id(card_id)));

drop policy if exists card_checklists_insert_policy on public.card_checklists;
create policy card_checklists_insert_policy
on public.card_checklists
for insert
to authenticated
with check (
  public.can_write_board(public.card_board_id(card_id))
  and created_by = (select auth.uid())
);

drop policy if exists card_checklists_update_policy on public.card_checklists;
create policy card_checklists_update_policy
on public.card_checklists
for update
to authenticated
using (public.can_write_board(public.card_board_id(card_id)))
with check (public.can_write_board(public.card_board_id(card_id)));

drop policy if exists card_checklists_delete_policy on public.card_checklists;
create policy card_checklists_delete_policy
on public.card_checklists
for delete
to authenticated
using (public.can_write_board(public.card_board_id(card_id)));

alter table public.card_checklist_items
  add column if not exists checklist_id uuid references public.card_checklists(id) on delete cascade;

insert into public.card_checklists (card_id, title, position, created_by, created_at, updated_at)
select
  cci.card_id,
  'Việc cần làm',
  1024,
  c.created_by,
  min(cci.created_at),
  max(cci.updated_at)
from public.card_checklist_items cci
join public.cards c
  on c.id = cci.card_id
where not exists (
  select 1
  from public.card_checklists cl
  where cl.card_id = cci.card_id
)
group by cci.card_id, c.created_by;

with default_checklists as (
  select distinct on (card_id)
    card_id,
    id as checklist_id
  from public.card_checklists
  order by card_id, created_at asc, id asc
)
update public.card_checklist_items cci
set checklist_id = dc.checklist_id
from default_checklists dc
where cci.card_id = dc.card_id
  and cci.checklist_id is null;

drop policy if exists card_checklist_items_select_policy on public.card_checklist_items;
create policy card_checklist_items_select_policy
on public.card_checklist_items
for select
to authenticated
using (public.can_read_board(public.checklist_board_id(checklist_id)));

drop policy if exists card_checklist_items_insert_policy on public.card_checklist_items;
create policy card_checklist_items_insert_policy
on public.card_checklist_items
for insert
to authenticated
with check (
  public.can_write_board(public.checklist_board_id(checklist_id))
  and created_by = (select auth.uid())
);

drop policy if exists card_checklist_items_update_policy on public.card_checklist_items;
create policy card_checklist_items_update_policy
on public.card_checklist_items
for update
to authenticated
using (public.can_write_board(public.checklist_board_id(checklist_id)))
with check (public.can_write_board(public.checklist_board_id(checklist_id)));

drop policy if exists card_checklist_items_delete_policy on public.card_checklist_items;
create policy card_checklist_items_delete_policy
on public.card_checklist_items
for delete
to authenticated
using (public.can_write_board(public.checklist_board_id(checklist_id)));

alter table public.card_checklist_items
  alter column checklist_id set not null;

drop index if exists public.card_checklist_items_card_position_idx;
drop index if exists public.card_checklist_items_card_done_idx;

alter table public.card_checklist_items
  drop column if exists card_id;

create index if not exists card_checklist_items_checklist_position_idx
  on public.card_checklist_items (checklist_id, position);

create index if not exists card_checklist_items_checklist_done_idx
  on public.card_checklist_items (checklist_id, is_done);
