-- Compact follow-up migration for remote environments:
-- replace auth.uid() usage in public functions/policies with public.current_user_id().

create extension if not exists "uuid-ossp" with schema extensions;

create or replace function public.clerk_subject_to_uuid(subject text)
returns uuid
language sql
immutable
strict
as $$
  select extensions.uuid_generate_v5(
    'f7d4e7a2-53d4-4df8-9f5f-931af65d4c2d'::uuid,
    subject
  );
$$;

create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  with subject_source as (
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ) as subject
  )
  select case
    when subject is null then null
    when subject ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then subject::uuid
    else public.clerk_subject_to_uuid(subject)
  end
  from subject_source;
$$;

grant execute on function public.clerk_subject_to_uuid(text) to anon, authenticated, service_role;
grant execute on function public.current_user_id() to anon, authenticated, service_role;

do $$
declare
  fn record;
  fn_sql text;
  pol record;
  create_sql text;
  role_list text;
  qual_sql text;
  with_check_sql text;
begin
  for fn in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ilike '%auth.uid%'
  loop
    fn_sql := pg_get_functiondef(fn.oid);
    fn_sql := replace(fn_sql, 'auth.uid()', 'public.current_user_id()');
    execute fn_sql;
  end loop;

  for pol in
    select schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ilike '%auth.uid%'
        or coalesce(with_check, '') ilike '%auth.uid%'
      )
  loop
    select string_agg(
      case when role_name = 'public' then 'public' else quote_ident(role_name) end,
      ', '
    )
    into role_list
    from unnest(pol.roles) as role_name;

    qual_sql := nullif(
      replace(coalesce(pol.qual, ''), 'auth.uid()', 'public.current_user_id()'),
      ''
    );
    with_check_sql := nullif(
      replace(coalesce(pol.with_check, ''), 'auth.uid()', 'public.current_user_id()'),
      ''
    );

    execute format(
      'drop policy if exists %I on %I.%I',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );

    create_sql := format(
      'create policy %I on %I.%I as %s for %s to %s',
      pol.policyname,
      pol.schemaname,
      pol.tablename,
      pol.permissive,
      pol.cmd,
      coalesce(role_list, 'public')
    );

    if qual_sql is not null then
      create_sql := create_sql || ' using (' || qual_sql || ')';
    end if;

    if with_check_sql is not null then
      create_sql := create_sql || ' with check (' || with_check_sql || ')';
    end if;

    execute create_sql;
  end loop;
end
$$;
