-- Align board share/comment RBAC with Clerk profile bridge and workspace-wide semantics.
-- - replace runtime-critical auth.uid() usages with public.current_user_id()
-- - keep board access management configurable via member_manage_permission
-- - allow workspace members to comment on workspace-visible boards when comment_permission = 'members'

create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select public.current_user_id())
      and wm.role in ('owner', 'admin')
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
          or coalesce(
            case
              when b.comment_permission = 'admins' then bm.role = 'admin'
              when b.visibility = 'workspace' then wm.user_id is not null
              else bm.role in ('member', 'admin')
            end,
            false
          )
        )
    );
$$;

create or replace function public.accept_board_invite(invite_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_actor_id uuid := (select public.current_user_id());
  current_email text := public.current_user_email();
  invite_row public.board_invites%rowtype;
  resolved_workspace_slug text;
begin
  if current_actor_id is null then
    return jsonb_build_object(
      'status', 'auth_required',
      'message', 'Please log in to accept this board invite.'
    );
  end if;

  if coalesce(current_email, '') = '' then
    return jsonb_build_object(
      'status', 'auth_required',
      'message', 'Your account email is missing.'
    );
  end if;

  select bi.*
  into invite_row
  from public.board_invites bi
  where bi.token_hash = invite_token_hash;

  if not found then
    return jsonb_build_object(
      'status', 'not_found',
      'message', 'Invite link is invalid.'
    );
  end if;

  if lower(invite_row.invited_email) <> lower(current_email) then
    return jsonb_build_object(
      'status', 'email_mismatch',
      'message', 'This board invite does not belong to your current account.'
    );
  end if;

  if invite_row.status = 'revoked' then
    return jsonb_build_object(
      'status', 'revoked',
      'message', 'This board invite has been revoked.'
    );
  end if;

  if invite_row.status = 'expired'
    or (invite_row.status = 'pending' and invite_row.expires_at <= now()) then
    if invite_row.status = 'pending' then
      update public.board_invites
      set status = 'expired'
      where id = invite_row.id
        and status = 'pending';
    end if;

    return jsonb_build_object(
      'status', 'expired',
      'message', 'This board invite has expired. Ask an admin to resend it.'
    );
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (invite_row.workspace_id, current_actor_id, 'member')
  on conflict (workspace_id, user_id) do nothing;

  insert into public.board_members (board_id, user_id, role, granted_by)
  values (invite_row.board_id, current_actor_id, invite_row.invited_role, invite_row.invited_by)
  on conflict (board_id, user_id) do update
  set
    role = case
      when public.board_members.role = 'admin' or excluded.role = 'admin' then 'admin'::public.board_member_role
      when public.board_members.role = 'member' or excluded.role = 'member' then 'member'::public.board_member_role
      else 'viewer'::public.board_member_role
    end,
    granted_by = excluded.granted_by,
    updated_at = now();

  if invite_row.status = 'accepted' then
    select w.slug
    into resolved_workspace_slug
    from public.workspaces w
    where w.id = invite_row.workspace_id;

    return jsonb_build_object(
      'status', 'already_accepted',
      'workspace_slug', resolved_workspace_slug,
      'board_id', invite_row.board_id,
      'message', 'You already joined this board from this invite.'
    );
  end if;

  if invite_row.status <> 'pending' then
    return jsonb_build_object(
      'status', 'unavailable',
      'message', 'This board invite is no longer available.'
    );
  end if;

  update public.board_invites
  set
    status = 'accepted',
    accepted_by = current_actor_id,
    accepted_at = now()
  where id = invite_row.id
    and status = 'pending';

  if not found then
    return jsonb_build_object(
      'status', 'conflict',
      'message', 'Invite state changed. Please refresh and try again.'
    );
  end if;

  insert into public.activity_events (
    workspace_id,
    board_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata
  )
  values (
    invite_row.workspace_id,
    invite_row.board_id,
    current_actor_id,
    'member',
    current_actor_id,
    'board.invite.accepted',
    jsonb_build_object(
      'invitedEmail', invite_row.invited_email,
      'invitedRole', invite_row.invited_role
    )
  );

  select w.slug
  into resolved_workspace_slug
  from public.workspaces w
  where w.id = invite_row.workspace_id;

  return jsonb_build_object(
    'status', 'accepted',
    'workspace_slug', resolved_workspace_slug,
    'board_id', invite_row.board_id,
    'message', 'Board invite accepted.'
  );
end;
$$;

drop policy if exists board_invites_insert_policy on public.board_invites;
create policy board_invites_insert_policy
on public.board_invites
for insert
to authenticated
with check (
  public.can_manage_board_access(board_id)
  and invited_by = (select public.current_user_id())
  and workspace_id = public.board_workspace_id(board_id)
);

drop policy if exists board_invites_update_policy on public.board_invites;
create policy board_invites_update_policy
on public.board_invites
for update
to authenticated
using (
  public.can_manage_board_access(board_id)
  or (
    lower(invited_email) = public.current_user_email()
    and status = 'pending'
  )
)
with check (
  (
    public.can_manage_board_access(board_id)
    and workspace_id = public.board_workspace_id(board_id)
  )
  or (
    lower(invited_email) = public.current_user_email()
    and status = 'accepted'
    and accepted_by = (select public.current_user_id())
    and accepted_at is not null
  )
);

drop policy if exists card_comments_insert_policy on public.card_comments;
create policy card_comments_insert_policy
on public.card_comments
for insert
to authenticated
with check (
  public.can_comment_board(public.card_board_id(card_id))
  and created_by = (select public.current_user_id())
);

drop policy if exists card_comments_update_policy on public.card_comments;
create policy card_comments_update_policy
on public.card_comments
for update
to authenticated
using (
  public.can_comment_board(public.card_board_id(card_id))
  and (
    created_by = (select public.current_user_id())
    or public.is_workspace_admin(public.card_workspace_id(card_id))
  )
)
with check (
  public.can_comment_board(public.card_board_id(card_id))
  and (
    created_by = (select public.current_user_id())
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
    created_by = (select public.current_user_id())
    or public.is_workspace_admin(public.card_workspace_id(card_id))
  )
);
