create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.normalize_search_text(input_text text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      lower(extensions.unaccent(coalesce(input_text, ''))),
      '\\s+',
      ' ',
      'g'
    )
  );
$$;

alter table public.boards
  add column if not exists search_text_normalized text;

alter table public.cards
  add column if not exists search_text_normalized text;

alter table public.card_comments
  add column if not exists search_vector tsvector,
  add column if not exists search_text_normalized text;

alter table public.card_checklists
  add column if not exists search_vector tsvector,
  add column if not exists search_text_normalized text;

alter table public.card_checklist_items
  add column if not exists search_vector tsvector,
  add column if not exists search_text_normalized text;

alter table public.attachments
  add column if not exists search_vector tsvector,
  add column if not exists search_text_normalized text;

create or replace function public.boards_search_fields_trigger()
returns trigger
language plpgsql
as $$
begin
  new.search_text_normalized := public.normalize_search_text(
    concat_ws(' ', coalesce(new.name, ''), coalesce(new.description, ''))
  );
  new.search_vector := to_tsvector('simple'::regconfig, new.search_text_normalized);
  return new;
end;
$$;

drop trigger if exists boards_search_fields_before_write on public.boards;
create trigger boards_search_fields_before_write
before insert or update of name, description on public.boards
for each row
execute function public.boards_search_fields_trigger();

create or replace function public.cards_search_fields_trigger()
returns trigger
language plpgsql
as $$
begin
  new.search_text_normalized := public.normalize_search_text(
    concat_ws(' ', coalesce(new.title, ''), coalesce(new.description, ''))
  );
  new.search_vector := to_tsvector('simple'::regconfig, new.search_text_normalized);
  return new;
end;
$$;

drop trigger if exists cards_search_fields_before_write on public.cards;
create trigger cards_search_fields_before_write
before insert or update of title, description on public.cards
for each row
execute function public.cards_search_fields_trigger();

create or replace function public.card_comments_search_fields_trigger()
returns trigger
language plpgsql
as $$
begin
  new.search_text_normalized := public.normalize_search_text(coalesce(new.body, ''));
  new.search_vector := to_tsvector('simple'::regconfig, new.search_text_normalized);
  return new;
end;
$$;

drop trigger if exists card_comments_search_fields_before_write on public.card_comments;
create trigger card_comments_search_fields_before_write
before insert or update of body on public.card_comments
for each row
execute function public.card_comments_search_fields_trigger();

create or replace function public.card_checklists_search_fields_trigger()
returns trigger
language plpgsql
as $$
begin
  new.search_text_normalized := public.normalize_search_text(coalesce(new.title, ''));
  new.search_vector := to_tsvector('simple'::regconfig, new.search_text_normalized);
  return new;
end;
$$;

drop trigger if exists card_checklists_search_fields_before_write on public.card_checklists;
create trigger card_checklists_search_fields_before_write
before insert or update of title on public.card_checklists
for each row
execute function public.card_checklists_search_fields_trigger();

create or replace function public.card_checklist_items_search_fields_trigger()
returns trigger
language plpgsql
as $$
begin
  new.search_text_normalized := public.normalize_search_text(coalesce(new.body, ''));
  new.search_vector := to_tsvector('simple'::regconfig, new.search_text_normalized);
  return new;
end;
$$;

drop trigger if exists card_checklist_items_search_fields_before_write on public.card_checklist_items;
create trigger card_checklist_items_search_fields_before_write
before insert or update of body on public.card_checklist_items
for each row
execute function public.card_checklist_items_search_fields_trigger();

create or replace function public.attachments_search_fields_trigger()
returns trigger
language plpgsql
as $$
begin
  new.search_text_normalized := public.normalize_search_text(
    concat_ws(' ', coalesce(new.file_name, ''), coalesce(new.external_url, ''))
  );
  new.search_vector := to_tsvector('simple'::regconfig, new.search_text_normalized);
  return new;
end;
$$;

drop trigger if exists attachments_search_fields_before_write on public.attachments;
create trigger attachments_search_fields_before_write
before insert or update of file_name, external_url on public.attachments
for each row
execute function public.attachments_search_fields_trigger();

update public.boards
set
  search_text_normalized = public.normalize_search_text(concat_ws(' ', coalesce(name, ''), coalesce(description, ''))),
  search_vector = to_tsvector(
    'simple'::regconfig,
    public.normalize_search_text(concat_ws(' ', coalesce(name, ''), coalesce(description, '')))
  )
where true;

update public.cards
set
  search_text_normalized = public.normalize_search_text(concat_ws(' ', coalesce(title, ''), coalesce(description, ''))),
  search_vector = to_tsvector(
    'simple'::regconfig,
    public.normalize_search_text(concat_ws(' ', coalesce(title, ''), coalesce(description, '')))
  )
where true;

update public.card_comments
set
  search_text_normalized = public.normalize_search_text(coalesce(body, '')),
  search_vector = to_tsvector('simple'::regconfig, public.normalize_search_text(coalesce(body, '')))
where true;

update public.card_checklists
set
  search_text_normalized = public.normalize_search_text(coalesce(title, '')),
  search_vector = to_tsvector('simple'::regconfig, public.normalize_search_text(coalesce(title, '')))
where true;

update public.card_checklist_items
set
  search_text_normalized = public.normalize_search_text(coalesce(body, '')),
  search_vector = to_tsvector('simple'::regconfig, public.normalize_search_text(coalesce(body, '')))
where true;

update public.attachments
set
  search_text_normalized = public.normalize_search_text(concat_ws(' ', coalesce(file_name, ''), coalesce(external_url, ''))),
  search_vector = to_tsvector(
    'simple'::regconfig,
    public.normalize_search_text(concat_ws(' ', coalesce(file_name, ''), coalesce(external_url, '')))
  )
where true;

create index if not exists boards_search_text_normalized_trgm_idx
  on public.boards
  using gin (search_text_normalized extensions.gin_trgm_ops);

create index if not exists cards_search_text_normalized_trgm_idx
  on public.cards
  using gin (search_text_normalized extensions.gin_trgm_ops);

create index if not exists card_comments_search_vector_idx
  on public.card_comments
  using gin (search_vector);

create index if not exists card_comments_search_text_normalized_trgm_idx
  on public.card_comments
  using gin (search_text_normalized extensions.gin_trgm_ops);

create index if not exists card_checklists_search_vector_idx
  on public.card_checklists
  using gin (search_vector);

create index if not exists card_checklists_search_text_normalized_trgm_idx
  on public.card_checklists
  using gin (search_text_normalized extensions.gin_trgm_ops);

create index if not exists card_checklist_items_search_vector_idx
  on public.card_checklist_items
  using gin (search_vector);

create index if not exists card_checklist_items_search_text_normalized_trgm_idx
  on public.card_checklist_items
  using gin (search_text_normalized extensions.gin_trgm_ops);

create index if not exists attachments_search_vector_idx
  on public.attachments
  using gin (search_vector);

create index if not exists attachments_search_text_normalized_trgm_idx
  on public.attachments
  using gin (search_text_normalized extensions.gin_trgm_ops);
