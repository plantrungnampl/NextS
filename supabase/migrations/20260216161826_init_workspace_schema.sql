-- NextS initial workspace schema (Supabase Postgres)
-- Canonical multi-tenant model: workspace -> board -> list -> card
-- Includes RLS, policies, integrity triggers, and profile bootstrap from auth.users.

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'workspace_member_role') then
    create type public.workspace_member_role as enum ('owner', 'admin', 'member');
  end if;

  if not exists (select 1 from pg_type where typname = 'board_visibility') then
    create type public.board_visibility as enum ('workspace', 'private', 'public');
  end if;

  if not exists (select 1 from pg_type where typname = 'invite_status') then
    create type public.invite_status as enum ('pending', 'accepted', 'revoked', 'expired');
  end if;

  if not exists (select 1 from pg_type where typname = 'activity_entity_type') then
    create type public.activity_entity_type as enum ('workspace', 'board', 'list', 'card', 'comment', 'label', 'member');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) <= 120)
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint workspaces_slug_length check (char_length(slug) between 3 and 64),
  constraint workspaces_name_length check (char_length(name) between 1 and 120)
);

create unique index if not exists workspaces_slug_lower_unique on public.workspaces (lower(slug));

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.workspace_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_workspace_idx
  on public.workspace_members (user_id, workspace_id);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  visibility public.board_visibility not null default 'workspace',
  created_by uuid not null references public.profiles(id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boards_name_length check (char_length(name) between 1 and 160)
);

create index if not exists boards_workspace_archived_idx
  on public.boards (workspace_id, archived_at);

create index if not exists boards_workspace_created_idx
  on public.boards (workspace_id, created_at desc);

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  title text not null,
  position numeric(20, 8) not null default 1024,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lists_title_length check (char_length(title) between 1 and 200),
  constraint lists_position_positive check (position >= 0),
  constraint lists_id_board_unique unique (id, board_id)
);

create index if not exists lists_board_position_idx
  on public.lists (board_id, position);

create index if not exists lists_board_archived_idx
  on public.lists (board_id, archived_at);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null,
  list_id uuid not null,
  title text not null,
  description text,
  position numeric(20, 8) not null default 1024,
  due_at timestamptz,
  archived_at timestamptz,
  version integer not null default 1,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cards_title_length check (char_length(title) between 1 and 500),
  constraint cards_position_positive check (position >= 0),
  constraint cards_version_positive check (version > 0),
  constraint cards_list_board_fk
    foreign key (list_id, board_id)
    references public.lists(id, board_id)
    on delete cascade
);

create index if not exists cards_list_position_idx
  on public.cards (list_id, position);

create index if not exists cards_board_archived_idx
  on public.cards (board_id, archived_at);

create index if not exists cards_due_at_idx
  on public.cards (due_at) where due_at is not null;

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  color text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint labels_name_length check (char_length(name) between 1 and 50),
  constraint labels_color_format check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create unique index if not exists labels_workspace_name_lower_unique
  on public.labels (workspace_id, lower(name));

create table if not exists public.card_labels (
  card_id uuid not null references public.cards(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (card_id, label_id)
);

create table if not exists public.card_assignees (
  card_id uuid not null references public.cards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (card_id, user_id)
);

create table if not exists public.card_comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  body text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint card_comments_body_length check (char_length(body) between 1 and 5000)
);

create index if not exists card_comments_card_created_idx
  on public.card_comments (card_id, created_at asc);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attachments_size_non_negative check (size_bytes >= 0),
  constraint attachments_file_name_length check (char_length(file_name) between 1 and 255),
  constraint attachments_storage_path_length check (char_length(storage_path) between 3 and 1024)
);

create index if not exists attachments_card_created_idx
  on public.attachments (card_id, created_at desc);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invited_email text not null,
  invited_role public.workspace_member_role not null default 'member',
  token_hash text not null,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  status public.invite_status not null default 'pending',
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invites_email_length check (char_length(invited_email) between 3 and 320),
  constraint invites_token_hash_length check (char_length(token_hash) between 16 and 255),
  constraint invites_acceptance_consistency check (
    (status = 'accepted' and accepted_by is not null and accepted_at is not null)
    or
    (status <> 'accepted' and accepted_at is null)
  )
);

create unique index if not exists invites_token_hash_unique on public.invites (token_hash);
create unique index if not exists invites_workspace_pending_email_unique
  on public.invites (workspace_id, lower(invited_email))
  where status = 'pending';
create index if not exists invites_workspace_status_idx
  on public.invites (workspace_id, status, expires_at desc);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  board_id uuid references public.boards(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type public.activity_entity_type not null,
  entity_id uuid not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_events_action_length check (char_length(action) between 1 and 64)
);

create index if not exists activity_events_workspace_created_idx
  on public.activity_events (workspace_id, created_at desc);

create index if not exists activity_events_board_created_idx
  on public.activity_events (board_id, created_at desc);

create index if not exists activity_events_metadata_gin
  on public.activity_events using gin (metadata);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'user-' || left(new.id::text, 8)
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

create or replace function public.handle_workspace_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (workspace_id, user_id) do update
  set role = 'owner';

  return new;
end;
$$;

create or replace function public.enforce_card_label_workspace_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.cards c
    join public.boards b on b.id = c.board_id
    join public.labels l on l.id = new.label_id and l.workspace_id = b.workspace_id
    where c.id = new.card_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'label workspace does not match card workspace';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_card_assignee_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
begin
  select b.workspace_id
  into target_workspace_id
  from public.cards c
  join public.boards b on b.id = c.board_id
  where c.id = new.card_id;

  if target_workspace_id is null then
    raise exception using
      errcode = '23514',
      message = 'card not found for assignee';
  end if;

  if not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = new.user_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'assignee must be a member of card workspace';
  end if;

  return new;
end;
$$;

create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.is_workspace_member(target_workspace_id uuid)
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
      and wm.user_id = auth.uid()
  );
$$;

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
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  );
$$;

create or replace function public.board_workspace_id(target_board_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.workspace_id
  from public.boards b
  where b.id = target_board_id;
$$;

create or replace function public.card_workspace_id(target_card_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.workspace_id
  from public.cards c
  join public.boards b on b.id = c.board_id
  where c.id = target_card_id;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_workspaces_updated_at on public.workspaces;
create trigger trg_workspaces_updated_at
before update on public.workspaces
for each row execute function public.touch_updated_at();

drop trigger if exists trg_boards_updated_at on public.boards;
create trigger trg_boards_updated_at
before update on public.boards
for each row execute function public.touch_updated_at();

drop trigger if exists trg_lists_updated_at on public.lists;
create trigger trg_lists_updated_at
before update on public.lists
for each row execute function public.touch_updated_at();

drop trigger if exists trg_cards_updated_at on public.cards;
create trigger trg_cards_updated_at
before update on public.cards
for each row execute function public.touch_updated_at();

drop trigger if exists trg_labels_updated_at on public.labels;
create trigger trg_labels_updated_at
before update on public.labels
for each row execute function public.touch_updated_at();

drop trigger if exists trg_card_comments_updated_at on public.card_comments;
create trigger trg_card_comments_updated_at
before update on public.card_comments
for each row execute function public.touch_updated_at();

drop trigger if exists trg_attachments_updated_at on public.attachments;
create trigger trg_attachments_updated_at
before update on public.attachments
for each row execute function public.touch_updated_at();

drop trigger if exists trg_invites_updated_at on public.invites;
create trigger trg_invites_updated_at
before update on public.invites
for each row execute function public.touch_updated_at();

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_created();

drop trigger if exists trg_workspace_created on public.workspaces;
create trigger trg_workspace_created
after insert on public.workspaces
for each row execute function public.handle_workspace_created();

drop trigger if exists trg_card_labels_workspace_guard on public.card_labels;
create trigger trg_card_labels_workspace_guard
before insert or update on public.card_labels
for each row execute function public.enforce_card_label_workspace_match();

drop trigger if exists trg_card_assignees_membership_guard on public.card_assignees;
create trigger trg_card_assignees_membership_guard
before insert or update on public.card_assignees
for each row execute function public.enforce_card_assignee_membership();

insert into public.profiles (id, display_name, avatar_url)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'user-' || left(u.id::text, 8)
  ),
  nullif(u.raw_user_meta_data ->> 'avatar_url', '')
from auth.users u
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.boards enable row level security;
alter table public.lists enable row level security;
alter table public.cards enable row level security;
alter table public.labels enable row level security;
alter table public.card_labels enable row level security;
alter table public.card_assignees enable row level security;
alter table public.card_comments enable row level security;
alter table public.attachments enable row level security;
alter table public.invites enable row level security;
alter table public.activity_events enable row level security;

drop policy if exists profiles_select_policy on public.profiles;
create policy profiles_select_policy
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.workspace_members wm_self
    join public.workspace_members wm_target
      on wm_target.workspace_id = wm_self.workspace_id
    where wm_self.user_id = auth.uid()
      and wm_target.user_id = public.profiles.id
  )
);

drop policy if exists profiles_insert_policy on public.profiles;
create policy profiles_insert_policy
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_policy on public.profiles;
create policy profiles_update_policy
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists workspaces_select_policy on public.workspaces;
create policy workspaces_select_policy
on public.workspaces
for select
to authenticated
using (public.is_workspace_member(id));

drop policy if exists workspaces_insert_policy on public.workspaces;
create policy workspaces_insert_policy
on public.workspaces
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists workspaces_update_policy on public.workspaces;
create policy workspaces_update_policy
on public.workspaces
for update
to authenticated
using (public.is_workspace_admin(id))
with check (public.is_workspace_admin(id));

drop policy if exists workspaces_delete_policy on public.workspaces;
create policy workspaces_delete_policy
on public.workspaces
for delete
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = public.workspaces.id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  )
);

drop policy if exists workspace_members_select_policy on public.workspace_members;
create policy workspace_members_select_policy
on public.workspace_members
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists workspace_members_insert_policy on public.workspace_members;
create policy workspace_members_insert_policy
on public.workspace_members
for insert
to authenticated
with check (public.is_workspace_admin(workspace_id));

drop policy if exists workspace_members_update_policy on public.workspace_members;
create policy workspace_members_update_policy
on public.workspace_members
for update
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

drop policy if exists workspace_members_delete_policy on public.workspace_members;
create policy workspace_members_delete_policy
on public.workspace_members
for delete
to authenticated
using (
  public.is_workspace_admin(workspace_id)
  or (user_id = auth.uid() and role <> 'owner')
);

drop policy if exists boards_select_policy on public.boards;
create policy boards_select_policy
on public.boards
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists boards_insert_policy on public.boards;
create policy boards_insert_policy
on public.boards
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = auth.uid()
);

drop policy if exists boards_update_policy on public.boards;
create policy boards_update_policy
on public.boards
for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists boards_delete_policy on public.boards;
create policy boards_delete_policy
on public.boards
for delete
to authenticated
using (public.is_workspace_admin(workspace_id));

drop policy if exists lists_select_policy on public.lists;
create policy lists_select_policy
on public.lists
for select
to authenticated
using (public.is_workspace_member(public.board_workspace_id(board_id)));

drop policy if exists lists_insert_policy on public.lists;
create policy lists_insert_policy
on public.lists
for insert
to authenticated
with check (public.is_workspace_member(public.board_workspace_id(board_id)));

drop policy if exists lists_update_policy on public.lists;
create policy lists_update_policy
on public.lists
for update
to authenticated
using (public.is_workspace_member(public.board_workspace_id(board_id)))
with check (public.is_workspace_member(public.board_workspace_id(board_id)));

drop policy if exists lists_delete_policy on public.lists;
create policy lists_delete_policy
on public.lists
for delete
to authenticated
using (public.is_workspace_admin(public.board_workspace_id(board_id)));

drop policy if exists cards_select_policy on public.cards;
create policy cards_select_policy
on public.cards
for select
to authenticated
using (public.is_workspace_member(public.board_workspace_id(board_id)));

drop policy if exists cards_insert_policy on public.cards;
create policy cards_insert_policy
on public.cards
for insert
to authenticated
with check (
  public.is_workspace_member(public.board_workspace_id(board_id))
  and created_by = auth.uid()
);

drop policy if exists cards_update_policy on public.cards;
create policy cards_update_policy
on public.cards
for update
to authenticated
using (public.is_workspace_member(public.board_workspace_id(board_id)))
with check (public.is_workspace_member(public.board_workspace_id(board_id)));

drop policy if exists cards_delete_policy on public.cards;
create policy cards_delete_policy
on public.cards
for delete
to authenticated
using (public.is_workspace_admin(public.board_workspace_id(board_id)));

drop policy if exists labels_select_policy on public.labels;
create policy labels_select_policy
on public.labels
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists labels_insert_policy on public.labels;
create policy labels_insert_policy
on public.labels
for insert
to authenticated
with check (
  public.is_workspace_admin(workspace_id)
  and created_by = auth.uid()
);

drop policy if exists labels_update_policy on public.labels;
create policy labels_update_policy
on public.labels
for update
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

drop policy if exists labels_delete_policy on public.labels;
create policy labels_delete_policy
on public.labels
for delete
to authenticated
using (public.is_workspace_admin(workspace_id));

drop policy if exists card_labels_select_policy on public.card_labels;
create policy card_labels_select_policy
on public.card_labels
for select
to authenticated
using (public.is_workspace_member(public.card_workspace_id(card_id)));

drop policy if exists card_labels_insert_policy on public.card_labels;
create policy card_labels_insert_policy
on public.card_labels
for insert
to authenticated
with check (public.is_workspace_member(public.card_workspace_id(card_id)));

drop policy if exists card_labels_delete_policy on public.card_labels;
create policy card_labels_delete_policy
on public.card_labels
for delete
to authenticated
using (public.is_workspace_member(public.card_workspace_id(card_id)));

drop policy if exists card_assignees_select_policy on public.card_assignees;
create policy card_assignees_select_policy
on public.card_assignees
for select
to authenticated
using (public.is_workspace_member(public.card_workspace_id(card_id)));

drop policy if exists card_assignees_insert_policy on public.card_assignees;
create policy card_assignees_insert_policy
on public.card_assignees
for insert
to authenticated
with check (public.is_workspace_member(public.card_workspace_id(card_id)));

drop policy if exists card_assignees_delete_policy on public.card_assignees;
create policy card_assignees_delete_policy
on public.card_assignees
for delete
to authenticated
using (public.is_workspace_member(public.card_workspace_id(card_id)));

drop policy if exists card_comments_select_policy on public.card_comments;
create policy card_comments_select_policy
on public.card_comments
for select
to authenticated
using (public.is_workspace_member(public.card_workspace_id(card_id)));

drop policy if exists card_comments_insert_policy on public.card_comments;
create policy card_comments_insert_policy
on public.card_comments
for insert
to authenticated
with check (
  public.is_workspace_member(public.card_workspace_id(card_id))
  and created_by = auth.uid()
);

drop policy if exists card_comments_update_policy on public.card_comments;
create policy card_comments_update_policy
on public.card_comments
for update
to authenticated
using (
  created_by = auth.uid()
  or public.is_workspace_admin(public.card_workspace_id(card_id))
)
with check (
  created_by = auth.uid()
  or public.is_workspace_admin(public.card_workspace_id(card_id))
);

drop policy if exists card_comments_delete_policy on public.card_comments;
create policy card_comments_delete_policy
on public.card_comments
for delete
to authenticated
using (
  created_by = auth.uid()
  or public.is_workspace_admin(public.card_workspace_id(card_id))
);

drop policy if exists attachments_select_policy on public.attachments;
create policy attachments_select_policy
on public.attachments
for select
to authenticated
using (public.is_workspace_member(public.card_workspace_id(card_id)));

drop policy if exists attachments_insert_policy on public.attachments;
create policy attachments_insert_policy
on public.attachments
for insert
to authenticated
with check (
  public.is_workspace_member(public.card_workspace_id(card_id))
  and created_by = auth.uid()
);

drop policy if exists attachments_update_policy on public.attachments;
create policy attachments_update_policy
on public.attachments
for update
to authenticated
using (
  created_by = auth.uid()
  or public.is_workspace_admin(public.card_workspace_id(card_id))
)
with check (
  created_by = auth.uid()
  or public.is_workspace_admin(public.card_workspace_id(card_id))
);

drop policy if exists attachments_delete_policy on public.attachments;
create policy attachments_delete_policy
on public.attachments
for delete
to authenticated
using (
  created_by = auth.uid()
  or public.is_workspace_admin(public.card_workspace_id(card_id))
);

drop policy if exists invites_select_policy on public.invites;
create policy invites_select_policy
on public.invites
for select
to authenticated
using (
  public.is_workspace_admin(workspace_id)
  or lower(invited_email) = public.current_user_email()
);

drop policy if exists invites_admin_insert_policy on public.invites;
create policy invites_admin_insert_policy
on public.invites
for insert
to authenticated
with check (
  public.is_workspace_admin(workspace_id)
  and invited_by = auth.uid()
);

drop policy if exists invites_admin_update_policy on public.invites;
create policy invites_admin_update_policy
on public.invites
for update
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

drop policy if exists invites_accept_update_policy on public.invites;
create policy invites_accept_update_policy
on public.invites
for update
to authenticated
using (
  lower(invited_email) = public.current_user_email()
  and status = 'pending'
)
with check (
  lower(invited_email) = public.current_user_email()
  and status = 'accepted'
  and accepted_by = auth.uid()
  and accepted_at is not null
);

drop policy if exists invites_delete_policy on public.invites;
create policy invites_delete_policy
on public.invites
for delete
to authenticated
using (public.is_workspace_admin(workspace_id));

drop policy if exists activity_events_select_policy on public.activity_events;
create policy activity_events_select_policy
on public.activity_events
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists activity_events_insert_policy on public.activity_events;
create policy activity_events_insert_policy
on public.activity_events
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and actor_id = auth.uid()
);

