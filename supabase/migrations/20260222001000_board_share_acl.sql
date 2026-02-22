do $$
begin
  if not exists (select 1 from pg_type where typname = 'board_member_role') then
    create type public.board_member_role as enum ('viewer', 'member', 'admin');
  end if;
end $$;

create table if not exists public.board_members (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.board_member_role not null default 'member',
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create index if not exists board_members_user_board_idx
  on public.board_members (user_id, board_id);

create index if not exists board_members_board_role_idx
  on public.board_members (board_id, role);

create table if not exists public.board_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  invited_email text not null,
  invited_role public.board_member_role not null default 'member',
  token_hash text not null,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  status public.invite_status not null default 'pending',
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint board_invites_email_length check (char_length(invited_email) between 3 and 320),
  constraint board_invites_token_hash_length check (char_length(token_hash) between 16 and 255),
  constraint board_invites_acceptance_consistency check (
    (status = 'accepted' and accepted_by is not null and accepted_at is not null)
    or
    (status <> 'accepted' and accepted_at is null)
  )
);

create unique index if not exists board_invites_token_hash_unique
  on public.board_invites (token_hash);

create unique index if not exists board_invites_board_pending_email_unique
  on public.board_invites (board_id, lower(invited_email))
  where status = 'pending';

create index if not exists board_invites_board_status_idx
  on public.board_invites (board_id, status, expires_at desc);

create index if not exists board_invites_workspace_status_idx
  on public.board_invites (workspace_id, status, created_at desc);

create or replace function public.handle_board_created_member_acl()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.board_members (board_id, user_id, role, granted_by)
  values (new.id, new.created_by, 'admin', new.created_by)
  on conflict (board_id, user_id) do update
  set
    role = 'admin',
    granted_by = excluded.granted_by,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.enforce_board_invite_workspace_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_workspace_id uuid;
begin
  select b.workspace_id
  into resolved_workspace_id
  from public.boards b
  where b.id = new.board_id;

  if resolved_workspace_id is null then
    raise exception using
      errcode = '23514',
      message = 'board not found for invite';
  end if;

  new.workspace_id := resolved_workspace_id;
  return new;
end;
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
          or coalesce(bm.role = 'admin', false)
        )
    );
$$;

create or replace function public.can_read_board(target_board_id uuid)
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
          b.visibility = 'public'
          or b.created_by = (select auth.uid())
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
          or coalesce(bm.role in ('member', 'admin'), false)
        )
    );
$$;

create or replace function public.board_has_member_email(
  target_board_id uuid,
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
    from public.board_members bm
    join auth.users au on au.id = bm.user_id
    where bm.board_id = target_board_id
      and lower(au.email) = lower(target_email)
  );
$$;

create or replace function public.accept_board_invite(invite_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text := public.current_user_email();
  invite_row public.board_invites%rowtype;
  resolved_workspace_slug text;
begin
  if current_user_id is null then
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
  values (invite_row.workspace_id, current_user_id, 'member')
  on conflict (workspace_id, user_id) do nothing;

  insert into public.board_members (board_id, user_id, role, granted_by)
  values (invite_row.board_id, current_user_id, invite_row.invited_role, invite_row.invited_by)
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
    current_user_id,
    'member',
    current_user_id,
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

insert into public.board_members (board_id, user_id, role, granted_by)
select
  b.id,
  wm.user_id,
  case
    when wm.role in ('owner', 'admin') then 'admin'::public.board_member_role
    else 'member'::public.board_member_role
  end,
  b.created_by
from public.boards b
join public.workspace_members wm
  on wm.workspace_id = b.workspace_id
where b.archived_at is null
on conflict (board_id, user_id) do update
set
  role = case
    when excluded.role = 'admin' or public.board_members.role = 'admin' then 'admin'::public.board_member_role
    when excluded.role = 'member' or public.board_members.role = 'member' then 'member'::public.board_member_role
    else 'viewer'::public.board_member_role
  end,
  granted_by = excluded.granted_by,
  updated_at = now();

alter table public.board_members enable row level security;
alter table public.board_invites enable row level security;

drop trigger if exists trg_board_members_updated_at on public.board_members;
create trigger trg_board_members_updated_at
before update on public.board_members
for each row execute function public.touch_updated_at();

drop trigger if exists trg_board_invites_updated_at on public.board_invites;
create trigger trg_board_invites_updated_at
before update on public.board_invites
for each row execute function public.touch_updated_at();

drop trigger if exists trg_board_membership_on_board_created on public.boards;
create trigger trg_board_membership_on_board_created
after insert on public.boards
for each row execute function public.handle_board_created_member_acl();

drop trigger if exists trg_board_invites_workspace_match on public.board_invites;
create trigger trg_board_invites_workspace_match
before insert or update of board_id on public.board_invites
for each row execute function public.enforce_board_invite_workspace_match();

revoke all
on function public.can_manage_board_access(uuid)
from public;

grant execute
on function public.can_manage_board_access(uuid)
to authenticated;

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

revoke all
on function public.board_has_member_email(uuid, text)
from public;

grant execute
on function public.board_has_member_email(uuid, text)
to authenticated;

revoke all
on function public.accept_board_invite(text)
from public;

grant execute
on function public.accept_board_invite(text)
to authenticated;

drop policy if exists board_members_select_policy on public.board_members;
create policy board_members_select_policy
on public.board_members
for select
to authenticated
using (public.can_read_board(board_id));

drop policy if exists board_members_insert_policy on public.board_members;
create policy board_members_insert_policy
on public.board_members
for insert
to authenticated
with check (
  public.can_manage_board_access(board_id)
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = public.board_workspace_id(board_id)
      and wm.user_id = public.board_members.user_id
  )
);

drop policy if exists board_members_update_policy on public.board_members;
create policy board_members_update_policy
on public.board_members
for update
to authenticated
using (public.can_manage_board_access(board_id))
with check (
  public.can_manage_board_access(board_id)
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = public.board_workspace_id(board_id)
      and wm.user_id = public.board_members.user_id
  )
);

drop policy if exists board_members_delete_policy on public.board_members;
create policy board_members_delete_policy
on public.board_members
for delete
to authenticated
using (public.can_manage_board_access(board_id));

drop policy if exists board_invites_select_policy on public.board_invites;
create policy board_invites_select_policy
on public.board_invites
for select
to authenticated
using (
  public.can_manage_board_access(board_id)
  or lower(invited_email) = public.current_user_email()
);

drop policy if exists board_invites_insert_policy on public.board_invites;
create policy board_invites_insert_policy
on public.board_invites
for insert
to authenticated
with check (
  public.can_manage_board_access(board_id)
  and invited_by = (select auth.uid())
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
    and accepted_by = (select auth.uid())
    and accepted_at is not null
  )
);

drop policy if exists board_invites_delete_policy on public.board_invites;
create policy board_invites_delete_policy
on public.board_invites
for delete
to authenticated
using (public.can_manage_board_access(board_id));
