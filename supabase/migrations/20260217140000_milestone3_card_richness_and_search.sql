create unique index if not exists attachments_storage_path_unique
  on public.attachments (storage_path);

alter table public.cards
  add column if not exists search_vector tsvector;

create or replace function public.cards_search_vector_trigger()
returns trigger
language plpgsql
as $$
begin
  new.search_vector := to_tsvector(
    'simple'::regconfig,
    trim(
      both
      from concat_ws(' ', coalesce(new.title, ''), coalesce(new.description, ''))
    )
  );
  return new;
end;
$$;

drop trigger if exists cards_search_vector_before_write on public.cards;
create trigger cards_search_vector_before_write
before insert or update of title, description on public.cards
for each row
execute function public.cards_search_vector_trigger();

update public.cards
set search_vector = to_tsvector(
  'simple'::regconfig,
  trim(
    both
    from concat_ws(' ', coalesce(title, ''), coalesce(description, ''))
  )
)
where search_vector is distinct from to_tsvector(
  'simple'::regconfig,
  trim(
    both
    from concat_ws(' ', coalesce(title, ''), coalesce(description, ''))
  )
);

create index if not exists cards_search_vector_idx
  on public.cards
  using gin (search_vector);

alter table public.boards
  add column if not exists search_vector tsvector;

create or replace function public.boards_search_vector_trigger()
returns trigger
language plpgsql
as $$
begin
  new.search_vector := to_tsvector(
    'simple'::regconfig,
    trim(
      both
      from concat_ws(' ', coalesce(new.name, ''), coalesce(new.description, ''))
    )
  );
  return new;
end;
$$;

drop trigger if exists boards_search_vector_before_write on public.boards;
create trigger boards_search_vector_before_write
before insert or update of name, description on public.boards
for each row
execute function public.boards_search_vector_trigger();

update public.boards
set search_vector = to_tsvector(
  'simple'::regconfig,
  trim(
    both
    from concat_ws(' ', coalesce(name, ''), coalesce(description, ''))
  )
)
where search_vector is distinct from to_tsvector(
  'simple'::regconfig,
  trim(
    both
    from concat_ws(' ', coalesce(name, ''), coalesce(description, ''))
  )
);

create index if not exists boards_search_vector_idx
  on public.boards
  using gin (search_vector);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  15728640,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'text/plain'
  ]::text[]
)
on conflict (id)
do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.workspace_id_from_storage_path(object_name text)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  path_parts text[];
begin
  if object_name is null then
    return null;
  end if;

  path_parts := string_to_array(object_name, '/');
  if array_length(path_parts, 1) < 2 then
    return null;
  end if;

  if path_parts[1] <> 'workspaces' then
    return null;
  end if;

  if path_parts[2] !~* '^[0-9a-f-]{36}$' then
    return null;
  end if;

  return path_parts[2]::uuid;
exception
  when others then
    return null;
end;
$$;

revoke all
on function public.workspace_id_from_storage_path(text)
from public;

grant execute
on function public.workspace_id_from_storage_path(text)
to authenticated;

drop policy if exists attachments_objects_select on storage.objects;
create policy attachments_objects_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'attachments'
  and exists (
    select 1
    from public.attachments a
    where a.storage_path = storage.objects.name
      and public.is_workspace_member(public.card_workspace_id(a.card_id))
  )
);

drop policy if exists attachments_objects_insert on storage.objects;
create policy attachments_objects_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'attachments'
  and public.workspace_id_from_storage_path(storage.objects.name) is not null
  and public.is_workspace_member(public.workspace_id_from_storage_path(storage.objects.name))
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
      and (
        a.created_by = auth.uid()
        or public.is_workspace_admin(public.card_workspace_id(a.card_id))
      )
  )
);
