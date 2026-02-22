create or replace function public.workspace_has_member_email(
  target_workspace_id uuid,
  target_email text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.workspace_members wm
    join auth.users au on au.id = wm.user_id
    where wm.workspace_id = target_workspace_id
      and lower(au.email) = lower(target_email)
  );
$$;

revoke all
on function public.workspace_has_member_email(uuid, text)
from public;

grant execute
on function public.workspace_has_member_email(uuid, text)
to authenticated;

create or replace function public.accept_workspace_invite(invite_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := public.current_user_email();
  invite_row public.invites%rowtype;
  resolved_workspace_slug text;
  role_to_assign public.workspace_member_role;
begin
  if current_user_id is null then
    return jsonb_build_object(
      'status', 'auth_required',
      'message', 'Please log in to accept this invite.'
    );
  end if;

  if coalesce(current_email, '') = '' then
    return jsonb_build_object(
      'status', 'auth_required',
      'message', 'Your account email is missing.'
    );
  end if;

  select i.*
  into invite_row
  from public.invites i
  where i.token_hash = invite_token_hash;

  if not found then
    return jsonb_build_object(
      'status', 'not_found',
      'message', 'Invite link is invalid.'
    );
  end if;

  select w.slug
  into resolved_workspace_slug
  from public.workspaces w
  where w.id = invite_row.workspace_id;

  if lower(invite_row.invited_email) <> lower(current_email) then
    return jsonb_build_object(
      'status', 'email_mismatch',
      'message', 'This invite does not belong to your current account.'
    );
  end if;

  if invite_row.status = 'revoked' then
    return jsonb_build_object(
      'status', 'revoked',
      'message', 'This invite has been revoked.'
    );
  end if;

  if invite_row.status = 'accepted' then
    role_to_assign := case
      when invite_row.invited_role = 'owner' then 'admin'::public.workspace_member_role
      else invite_row.invited_role
    end;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (invite_row.workspace_id, current_user_id, role_to_assign)
    on conflict (workspace_id, user_id) do nothing;

    return jsonb_build_object(
      'status', 'already_accepted',
      'workspace_slug', resolved_workspace_slug,
      'message', 'You already joined this workspace from this invite.'
    );
  end if;

  if invite_row.status = 'expired'
    or (invite_row.status = 'pending' and invite_row.expires_at <= now()) then
    if invite_row.status = 'pending' then
      update public.invites
      set status = 'expired'
      where id = invite_row.id
        and status = 'pending';
    end if;

    return jsonb_build_object(
      'status', 'expired',
      'message', 'This invite has expired. Ask an admin to resend it.'
    );
  end if;

  if invite_row.status <> 'pending' then
    return jsonb_build_object(
      'status', 'unavailable',
      'message', 'This invite is no longer available.'
    );
  end if;

  role_to_assign := case
    when invite_row.invited_role = 'owner' then 'admin'::public.workspace_member_role
    else invite_row.invited_role
  end;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (invite_row.workspace_id, current_user_id, role_to_assign)
  on conflict (workspace_id, user_id) do nothing;

  update public.invites
  set
    status = 'accepted',
    accepted_by = current_user_id,
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
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata
  )
  values (
    invite_row.workspace_id,
    current_user_id,
    'member',
    current_user_id,
    'invite.accepted',
    jsonb_build_object(
      'invitedEmail', invite_row.invited_email,
      'invitedRole', invite_row.invited_role
    )
  );

  return jsonb_build_object(
    'status', 'accepted',
    'workspace_slug', resolved_workspace_slug,
    'message', 'Invite accepted. Welcome to the workspace.'
  );
end;
$$;

revoke all
on function public.accept_workspace_invite(text)
from public;

grant execute
on function public.accept_workspace_invite(text)
to authenticated;
