-- Bridge Clerk subject values to stable profile UUIDs while preserving
-- existing Supabase-auth-backed user data.

create table if not exists public.clerk_identity_links (
  clerk_subject text primary key,
  profile_id uuid not null unique,
  linked_at timestamp with time zone not null default now()
);

revoke all on table public.clerk_identity_links from anon, authenticated;
grant select on table public.clerk_identity_links to service_role;

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

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
security definer
set search_path = public, auth
as $$
  with claims as (
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ) as subject
  )
  select case
    when claims.subject is null then null
    else coalesce(
      (
        select links.profile_id
        from public.clerk_identity_links links
        where links.clerk_subject = claims.subject
      ),
      case
        when claims.subject ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then claims.subject::uuid
        else public.clerk_subject_to_uuid(claims.subject)
      end
    )
  end
  from claims;
$$;

create or replace function public.link_current_clerk_identity_by_email(email_override text default null)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  claims_json text;
  claim_subject text;
  claim_email text;
  normalized_email text;
  resolved_profile_id uuid;
begin
  claims_json := nullif(current_setting('request.jwt.claims', true), '');
  claim_subject := coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    case when claims_json is null then null else claims_json::jsonb ->> 'sub' end
  );

  if claim_subject is null then
    raise exception 'Missing JWT subject claim for Clerk user.';
  end if;

  select links.profile_id
  into resolved_profile_id
  from public.clerk_identity_links links
  where links.clerk_subject = claim_subject;

  if resolved_profile_id is not null then
    return resolved_profile_id;
  end if;

  claim_email := coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    case when claims_json is null then null else claims_json::jsonb ->> 'email' end
  );
  normalized_email := lower(coalesce(nullif(trim(email_override), ''), claim_email, ''));

  if normalized_email <> '' then
    select p.id
    into resolved_profile_id
    from public.profiles p
    join auth.users u
      on u.id = p.id
    where lower(coalesce(u.email, '')) = normalized_email
    order by p.created_at asc
    limit 1;
  end if;

  if resolved_profile_id is null then
    resolved_profile_id := case
      when claim_subject ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then claim_subject::uuid
      else public.clerk_subject_to_uuid(claim_subject)
    end;
  end if;

  delete from public.clerk_identity_links
  where profile_id = resolved_profile_id
    and clerk_subject <> claim_subject;

  insert into public.clerk_identity_links (clerk_subject, profile_id)
  values (claim_subject, resolved_profile_id)
  on conflict (clerk_subject) do update
    set profile_id = excluded.profile_id,
        linked_at = now();

  return resolved_profile_id;
end;
$$;

grant execute on function public.clerk_subject_to_uuid(text) to anon, authenticated, service_role;
grant execute on function public.current_user_id() to anon, authenticated, service_role;
grant execute on function public.link_current_clerk_identity_by_email(text) to authenticated, service_role;
