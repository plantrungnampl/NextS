alter table public.attachments
  add column if not exists source_type text not null default 'file',
  add column if not exists external_url text;

alter table public.attachments
  alter column storage_path drop not null;

alter table public.attachments
  drop constraint if exists attachments_storage_path_length;

alter table public.attachments
  add constraint attachments_storage_path_length
  check (
    storage_path is null
    or char_length(storage_path) between 3 and 1024
  );

alter table public.attachments
  drop constraint if exists attachments_source_type_check;

alter table public.attachments
  drop constraint if exists attachments_external_url_http_check;

alter table public.attachments
  drop constraint if exists attachments_source_payload_consistency;

alter table public.attachments
  add constraint attachments_source_type_check
  check (source_type in ('file', 'url'));

alter table public.attachments
  add constraint attachments_external_url_http_check
  check (
    external_url is null
    or external_url ~* '^https?://'
  );

alter table public.attachments
  add constraint attachments_source_payload_consistency
  check (
    (source_type = 'file' and storage_path is not null and external_url is null)
    or
    (source_type = 'url' and storage_path is null and external_url is not null)
  );

create index if not exists attachments_url_recent_by_user_idx
  on public.attachments (created_by, created_at desc)
  where source_type = 'url';
