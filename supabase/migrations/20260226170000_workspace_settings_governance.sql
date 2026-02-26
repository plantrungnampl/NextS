alter table public.workspaces
  add column if not exists logo_path text;

alter table public.workspaces
  drop constraint if exists workspaces_logo_path_length;

alter table public.workspaces
  add constraint workspaces_logo_path_length
  check (
    logo_path is null
    or char_length(logo_path) between 3 and 1024
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workspace-logos',
  'workspace-logos',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.workspace_id_from_logo_storage_path(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  matched_uuid text;
begin
  if object_name is null then
    return null;
  end if;

  matched_uuid := substring(object_name from '^workspaces/([0-9a-fA-F-]{36})/logo/');
  if matched_uuid is null then
    return null;
  end if;

  return matched_uuid::uuid;
exception
  when others then
    return null;
end;
$$;

grant execute on function public.workspace_id_from_logo_storage_path(text)
to authenticated;

revoke execute on function public.workspace_id_from_logo_storage_path(text)
from anon;

drop policy if exists workspace_logo_objects_select on storage.objects;
create policy workspace_logo_objects_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'workspace-logos'
  and public.workspace_id_from_logo_storage_path(storage.objects.name) is not null
  and public.is_workspace_member(public.workspace_id_from_logo_storage_path(storage.objects.name))
);

drop policy if exists workspace_logo_objects_insert on storage.objects;
create policy workspace_logo_objects_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'workspace-logos'
  and public.workspace_id_from_logo_storage_path(storage.objects.name) is not null
  and public.is_workspace_admin(public.workspace_id_from_logo_storage_path(storage.objects.name))
);

drop policy if exists workspace_logo_objects_delete on storage.objects;
create policy workspace_logo_objects_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'workspace-logos'
  and public.workspace_id_from_logo_storage_path(storage.objects.name) is not null
  and public.is_workspace_admin(public.workspace_id_from_logo_storage_path(storage.objects.name))
);

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
  actor_id uuid := auth.uid();
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

grant execute on function public.transfer_workspace_ownership(uuid, uuid)
to authenticated;

revoke execute on function public.transfer_workspace_ownership(uuid, uuid)
from anon;
