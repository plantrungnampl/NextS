-- Harden role/permission consistency:
-- - remove remaining auth.uid() usages from runtime-critical paths
-- - align workspace/member governance with app guard
-- - align board visibility=workspace semantics with workspace-wide read/write
-- - tighten board hard-delete authority

create or replace function public.transfer_workspace_ownership(
  target_workspace_id uuid,
  new_owner_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := public.current_user_id();
begin
  if actor_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required.';
  end if;

  if target_workspace_id is null or new_owner_user_id is null then
    raise exception using
      errcode = '22023',
      message = 'Workspace id and new owner id are required.';
  end if;

  if actor_id = new_owner_user_id then
    raise exception using
      errcode = '22023',
      message = 'Selected user is already the workspace owner.';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = actor_id
      and wm.role = 'owner'
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only workspace owner can transfer ownership.';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = new_owner_user_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'New owner must be a workspace member.';
  end if;

  update public.workspace_members
  set role = 'admin'
  where workspace_id = target_workspace_id
    and role = 'owner';

  update public.workspace_members
  set role = 'owner'
  where workspace_id = target_workspace_id
    and user_id = new_owner_user_id;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'Could not assign new workspace owner.';
  end if;
end;
$$;

create or replace function public.workspace_actor_role(target_workspace_id uuid)
returns public.workspace_member_role
language sql
stable
security definer
set search_path = public
as $$
  select wm.role
  from public.workspace_members wm
  where wm.workspace_id = target_workspace_id
    and wm.user_id = public.current_user_id()
  limit 1;
$$;

revoke all
on function public.workspace_actor_role(uuid)
from public;

grant execute
on function public.workspace_actor_role(uuid)
to authenticated, service_role;

create or replace function public.can_delete_board(target_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select public.current_user_id()) is not null
    and exists (
      select 1
      from public.boards b
      left join public.workspace_members wm
        on wm.workspace_id = b.workspace_id
       and wm.user_id = (select public.current_user_id())
      where b.id = target_board_id
        and (
          b.created_by = (select public.current_user_id())
          or coalesce(wm.role in ('owner', 'admin'), false)
        )
    );
$$;

revoke all
on function public.can_delete_board(uuid)
from public;

grant execute
on function public.can_delete_board(uuid)
to authenticated, service_role;

create or replace function public.can_read_board(target_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select public.current_user_id()) is not null
    and exists (
      select 1
      from public.boards b
      left join public.workspace_members wm
        on wm.workspace_id = b.workspace_id
       and wm.user_id = (select public.current_user_id())
      left join public.board_members bm
        on bm.board_id = b.id
       and bm.user_id = (select public.current_user_id())
      where b.id = target_board_id
        and b.archived_at is null
        and (
          b.visibility = 'public'
          or (b.visibility = 'workspace' and wm.user_id is not null)
          or b.created_by = (select public.current_user_id())
          or coalesce(wm.role in ('owner', 'admin'), false)
          or bm.user_id is not null
        )
    );
$$;

create or replace function public.can_write_board(target_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select public.current_user_id()) is not null
    and exists (
      select 1
      from public.boards b
      left join public.workspace_members wm
        on wm.workspace_id = b.workspace_id
       and wm.user_id = (select public.current_user_id())
      left join public.board_members bm
        on bm.board_id = b.id
       and bm.user_id = (select public.current_user_id())
      where b.id = target_board_id
        and b.archived_at is null
        and (
          b.created_by = (select public.current_user_id())
          or coalesce(wm.role in ('owner', 'admin'), false)
          or (b.visibility = 'workspace' and wm.user_id is not null)
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

revoke all
on function public.can_read_board(uuid)
from public;

grant execute
on function public.can_read_board(uuid)
to authenticated;

revoke all
on function public.can_write_board(uuid)
from public;

grant execute
on function public.can_write_board(uuid)
to authenticated;

drop policy if exists boards_delete_policy on public.boards;
create policy boards_delete_policy
on public.boards
for delete
to authenticated
using (public.can_delete_board(id));

drop policy if exists workspace_members_insert_policy on public.workspace_members;
create policy workspace_members_insert_policy
on public.workspace_members
for insert
to authenticated
with check (
  (
    public.workspace_actor_role(workspace_id) = 'owner'
    and role in ('admin', 'member')
  )
  or (
    public.workspace_actor_role(workspace_id) = 'admin'
    and role = 'member'
  )
);

drop policy if exists workspace_members_update_policy on public.workspace_members;
create policy workspace_members_update_policy
on public.workspace_members
for update
to authenticated
using (
  (
    public.workspace_actor_role(workspace_id) = 'owner'
    and public.workspace_members.role in ('admin', 'member')
  )
  or (
    public.workspace_actor_role(workspace_id) = 'admin'
    and public.workspace_members.role = 'member'
  )
)
with check (
  (
    public.workspace_actor_role(workspace_id) = 'owner'
    and public.workspace_members.role in ('admin', 'member')
  )
  or (
    public.workspace_actor_role(workspace_id) = 'admin'
    and public.workspace_members.role in ('admin', 'member')
  )
);

drop policy if exists workspace_members_delete_policy on public.workspace_members;
create policy workspace_members_delete_policy
on public.workspace_members
for delete
to authenticated
using (
  (
    public.workspace_actor_role(workspace_id) = 'owner'
    and public.workspace_members.role in ('admin', 'member')
  )
  or (
    public.workspace_actor_role(workspace_id) = 'admin'
    and public.workspace_members.role = 'member'
  )
  or (
    public.workspace_members.user_id = (select public.current_user_id())
    and public.workspace_members.role <> 'owner'
  )
);

drop policy if exists invites_admin_insert_policy on public.invites;
create policy invites_admin_insert_policy
on public.invites
for insert
to authenticated
with check (
  public.is_workspace_admin(workspace_id)
  and invited_by = (select public.current_user_id())
  and invited_role in ('admin', 'member')
);

drop policy if exists invites_update_policy on public.invites;
create policy invites_update_policy
on public.invites
for update
to authenticated
using (
  public.is_workspace_admin(workspace_id)
  or (
    lower(invited_email) = public.current_user_email()
    and status = 'pending'
  )
)
with check (
  (
    public.is_workspace_admin(workspace_id)
    and invited_role in ('admin', 'member')
  )
  or (
    lower(invited_email) = public.current_user_email()
    and status = 'accepted'
    and accepted_by = (select public.current_user_id())
    and accepted_at is not null
  )
);

drop policy if exists attachments_objects_delete on storage.objects;
create policy attachments_objects_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'attachments'
  and exists (
    select 1
    from public.attachments a
    where a.storage_path = storage.objects.name
      and public.can_write_board(public.card_board_id(a.card_id))
      and (
        a.created_by = (select public.current_user_id())
        or public.is_workspace_admin(public.card_workspace_id(a.card_id))
      )
  )
);
