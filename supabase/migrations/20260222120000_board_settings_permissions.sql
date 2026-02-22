do $$
begin
  if not exists (select 1 from pg_type where typname = 'board_permission_level') then
    create type public.board_permission_level as enum ('admins', 'members');
  end if;
end $$;

alter table public.boards
  add column if not exists edit_permission public.board_permission_level not null default 'members',
  add column if not exists comment_permission public.board_permission_level not null default 'members',
  add column if not exists member_manage_permission public.board_permission_level not null default 'members',
  add column if not exists show_complete_status_on_front boolean not null default true,
  add column if not exists show_card_cover_on_front boolean not null default true;

create or replace function public.can_write_board(target_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.boards b
      left join public.workspace_members wm
        on wm.workspace_id = b.workspace_id
       and wm.user_id = (select auth.uid())
      left join public.board_members bm
        on bm.board_id = b.id
       and bm.user_id = (select auth.uid())
      where b.id = target_board_id
        and b.archived_at is null
        and (
          b.created_by = (select auth.uid())
          or coalesce(wm.role in ('owner', 'admin'), false)
          or coalesce(
            case
              when b.edit_permission = 'admins' then bm.role = 'admin'
              else bm.role in ('member', 'admin')
            end,
            false
          )
        )
    );
$$;

create or replace function public.can_manage_board_access(target_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.boards b
      left join public.workspace_members wm
        on wm.workspace_id = b.workspace_id
       and wm.user_id = (select auth.uid())
      left join public.board_members bm
        on bm.board_id = b.id
       and bm.user_id = (select auth.uid())
      where b.id = target_board_id
        and b.archived_at is null
        and (
          b.created_by = (select auth.uid())
          or coalesce(wm.role in ('owner', 'admin'), false)
          or coalesce(
            case
              when b.member_manage_permission = 'admins' then bm.role = 'admin'
              else bm.role in ('member', 'admin')
            end,
            false
          )
        )
    );
$$;

create or replace function public.can_comment_board(target_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.boards b
      left join public.workspace_members wm
        on wm.workspace_id = b.workspace_id
       and wm.user_id = (select auth.uid())
      left join public.board_members bm
        on bm.board_id = b.id
       and bm.user_id = (select auth.uid())
      where b.id = target_board_id
        and b.archived_at is null
        and (
          b.created_by = (select auth.uid())
          or coalesce(wm.role in ('owner', 'admin'), false)
          or coalesce(
            case
              when b.comment_permission = 'admins' then bm.role = 'admin'
              else bm.role in ('member', 'admin')
            end,
            false
          )
        )
    );
$$;

revoke all
on function public.can_comment_board(uuid)
from public;

grant execute
on function public.can_comment_board(uuid)
to authenticated;

drop policy if exists card_comments_insert_policy on public.card_comments;
create policy card_comments_insert_policy
on public.card_comments
for insert
to authenticated
with check (
  public.can_comment_board(public.card_board_id(card_id))
  and created_by = (select auth.uid())
);

drop policy if exists card_comments_update_policy on public.card_comments;
create policy card_comments_update_policy
on public.card_comments
for update
to authenticated
using (
  public.can_comment_board(public.card_board_id(card_id))
  and (
    created_by = (select auth.uid())
    or public.is_workspace_admin(public.card_workspace_id(card_id))
  )
)
with check (
  public.can_comment_board(public.card_board_id(card_id))
  and (
    created_by = (select auth.uid())
    or public.is_workspace_admin(public.card_workspace_id(card_id))
  )
);

drop policy if exists card_comments_delete_policy on public.card_comments;
create policy card_comments_delete_policy
on public.card_comments
for delete
to authenticated
using (
  public.can_comment_board(public.card_board_id(card_id))
  and (
    created_by = (select auth.uid())
    or public.is_workspace_admin(public.card_workspace_id(card_id))
  )
);
