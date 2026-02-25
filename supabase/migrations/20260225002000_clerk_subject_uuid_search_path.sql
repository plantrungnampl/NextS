create or replace function public.clerk_subject_to_uuid(subject text)
returns uuid
language sql
immutable
strict
set search_path = public, extensions
as $$
  select extensions.uuid_generate_v5(
    'f7d4e7a2-53d4-4df8-9f5f-931af65d4c2d'::uuid,
    subject
  );
$$;

grant execute on function public.clerk_subject_to_uuid(text) to anon, authenticated, service_role;
