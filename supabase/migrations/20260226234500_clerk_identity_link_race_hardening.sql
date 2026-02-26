-- Harden Clerk identity link bridge against concurrent linking races.
-- Policy: latest successful login mapping wins for a resolved profile_id.

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

  -- Serialize all operations for the same Clerk subject.
  perform pg_advisory_xact_lock(hashtext('clerk_subject:' || claim_subject));

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

  -- Serialize all operations touching the same profile mapping.
  perform pg_advisory_xact_lock(hashtext('profile_id:' || resolved_profile_id::text));

  -- Latest login wins for the resolved profile_id.
  delete from public.clerk_identity_links
  where clerk_subject = claim_subject
     or profile_id = resolved_profile_id;

  insert into public.clerk_identity_links (clerk_subject, profile_id)
  values (claim_subject, resolved_profile_id)
  on conflict (clerk_subject) do update
    set profile_id = excluded.profile_id,
        linked_at = now();

  return resolved_profile_id;
end;
$$;

grant execute on function public.link_current_clerk_identity_by_email(text) to authenticated, service_role;
