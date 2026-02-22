alter table public.boards
  add column if not exists sync_version bigint not null default 1;

alter table public.lists
  add column if not exists version integer not null default 1;

create index if not exists boards_id_sync_version_idx
  on public.boards (id, sync_version);

create or replace function public.reorder_lists_with_version(
  target_board_id uuid,
  expected_board_version bigint,
  ordered_list_ids uuid[],
  mutation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  board_row public.boards%rowtype;
  list_count integer;
  next_board_version bigint;
  deduped_version bigint;
begin
  if v_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Authentication required.');
  end if;

  if ordered_list_ids is null or coalesce(array_length(ordered_list_ids, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID', 'message', 'ordered_list_ids is required.');
  end if;

  if mutation_id is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID', 'message', 'mutation_id is required.');
  end if;

  select (ae.metadata ->> 'boardVersionAfter')::bigint
  into deduped_version
  from public.activity_events ae
  where ae.board_id = target_board_id
    and ae.actor_id = v_actor_id
    and ae.metadata ->> 'mutationId' = mutation_id::text
  order by ae.created_at desc
  limit 1;

  if deduped_version is not null then
    return jsonb_build_object(
      'ok', true,
      'boardVersion', deduped_version,
      'deduped', true
    );
  end if;

  select b.*
  into board_row
  from public.boards b
  where b.id = target_board_id
    and b.archived_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Board not found.');
  end if;

  if not public.is_workspace_member(board_row.workspace_id) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Membership required.');
  end if;

  if board_row.sync_version <> expected_board_version then
    return jsonb_build_object(
      'ok', false,
      'code', 'CONFLICT',
      'message', 'Board version changed.',
      'latestBoardVersion', board_row.sync_version
    );
  end if;

  if array_length(ordered_list_ids, 1) <> (
    select count(distinct id)
    from unnest(ordered_list_ids) as u(id)
  ) then
    return jsonb_build_object('ok', false, 'code', 'INVALID', 'message', 'Duplicate list ids.');
  end if;

  select count(*)
  into list_count
  from public.lists l
  where l.board_id = target_board_id
    and l.archived_at is null;

  if list_count <> array_length(ordered_list_ids, 1) then
    return jsonb_build_object(
      'ok', false,
      'code', 'CONFLICT',
      'message', 'List set changed. Refresh and try again.',
      'latestBoardVersion', board_row.sync_version
    );
  end if;

  if exists (
    select 1
    from unnest(ordered_list_ids) as u(id)
    left join public.lists l
      on l.id = u.id
      and l.board_id = target_board_id
      and l.archived_at is null
    where l.id is null
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'CONFLICT',
      'message', 'List set changed. Refresh and try again.',
      'latestBoardVersion', board_row.sync_version
    );
  end if;

  with incoming as (
    select u.id, u.ordinality
    from unnest(ordered_list_ids) with ordinality as u(id, ordinality)
  )
  update public.lists l
  set
    position = (incoming.ordinality::numeric) * 1024,
    version = l.version + 1
  from incoming
  where l.id = incoming.id
    and l.board_id = target_board_id;

  update public.boards b
  set sync_version = b.sync_version + 1
  where b.id = target_board_id
  returning b.sync_version into next_board_version;

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
    board_row.workspace_id,
    board_row.id,
    v_actor_id,
    'board',
    board_row.id,
    'reorder',
    jsonb_build_object(
      'listOrder', ordered_list_ids,
      'mutationId', mutation_id::text,
      'boardVersionAfter', next_board_version
    )
  );

  return jsonb_build_object('ok', true, 'boardVersion', next_board_version);
end;
$$;

revoke all
on function public.reorder_lists_with_version(uuid, bigint, uuid[], uuid)
from public;

grant execute
on function public.reorder_lists_with_version(uuid, bigint, uuid[], uuid)
to authenticated;

create or replace function public.reorder_cards_with_version(
  target_board_id uuid,
  target_card_id uuid,
  from_list_id uuid,
  to_list_id uuid,
  ordered_card_ids uuid[],
  expected_board_version bigint,
  mutation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  board_row public.boards%rowtype;
  moved_card_row public.cards%rowtype;
  expected_count integer;
  next_board_version bigint;
  deduped_version bigint;
begin
  if v_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Authentication required.');
  end if;

  if ordered_card_ids is null or coalesce(array_length(ordered_card_ids, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'code', 'INVALID', 'message', 'ordered_card_ids is required.');
  end if;

  if mutation_id is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID', 'message', 'mutation_id is required.');
  end if;

  select (ae.metadata ->> 'boardVersionAfter')::bigint
  into deduped_version
  from public.activity_events ae
  where ae.board_id = target_board_id
    and ae.actor_id = v_actor_id
    and ae.metadata ->> 'mutationId' = mutation_id::text
  order by ae.created_at desc
  limit 1;

  if deduped_version is not null then
    return jsonb_build_object(
      'ok', true,
      'boardVersion', deduped_version,
      'deduped', true
    );
  end if;

  select b.*
  into board_row
  from public.boards b
  where b.id = target_board_id
    and b.archived_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Board not found.');
  end if;

  if not public.is_workspace_member(board_row.workspace_id) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Membership required.');
  end if;

  if board_row.sync_version <> expected_board_version then
    return jsonb_build_object(
      'ok', false,
      'code', 'CONFLICT',
      'message', 'Board version changed.',
      'latestBoardVersion', board_row.sync_version
    );
  end if;

  select c.*
  into moved_card_row
  from public.cards c
  where c.id = target_card_id
    and c.board_id = target_board_id
    and c.archived_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Card no longer exists.');
  end if;

  if moved_card_row.list_id <> from_list_id then
    return jsonb_build_object(
      'ok', false,
      'code', 'CONFLICT',
      'message', 'Card source changed. Refresh and try again.',
      'latestBoardVersion', board_row.sync_version
    );
  end if;

  if not exists (
    select 1
    from public.lists l
    where l.id = to_list_id
      and l.board_id = target_board_id
      and l.archived_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Target list not found.');
  end if;

  if array_length(ordered_card_ids, 1) <> (
    select count(distinct id)
    from unnest(ordered_card_ids) as u(id)
  ) then
    return jsonb_build_object('ok', false, 'code', 'INVALID', 'message', 'Duplicate card ids.');
  end if;

  expected_count := (
    select count(*)
    from public.cards c
    where c.board_id = target_board_id
      and c.list_id = to_list_id
      and c.archived_at is null
  );

  if from_list_id <> to_list_id then
    expected_count := expected_count + 1;
  end if;

  if expected_count <> array_length(ordered_card_ids, 1) then
    return jsonb_build_object(
      'ok', false,
      'code', 'CONFLICT',
      'message', 'Card order changed. Refresh and try again.',
      'latestBoardVersion', board_row.sync_version
    );
  end if;

  if exists (
    select 1
    from unnest(ordered_card_ids) as u(id)
    left join public.cards c
      on c.id = u.id
      and c.board_id = target_board_id
      and c.archived_at is null
    where c.id is null
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'CONFLICT',
      'message', 'Card order changed. Refresh and try again.',
      'latestBoardVersion', board_row.sync_version
    );
  end if;

  if from_list_id = to_list_id then
    if exists (
      select 1
      from public.cards c
      where c.board_id = target_board_id
        and c.list_id = to_list_id
        and c.archived_at is null
        and not (c.id = any(ordered_card_ids))
    ) then
      return jsonb_build_object(
        'ok', false,
        'code', 'CONFLICT',
        'message', 'Card order changed. Refresh and try again.',
        'latestBoardVersion', board_row.sync_version
      );
    end if;
  else
    if exists (
      select 1
      from public.cards c
      where c.board_id = target_board_id
        and c.list_id = to_list_id
        and c.archived_at is null
        and c.id <> target_card_id
        and not (c.id = any(ordered_card_ids))
    ) then
      return jsonb_build_object(
        'ok', false,
        'code', 'CONFLICT',
        'message', 'Card order changed. Refresh and try again.',
        'latestBoardVersion', board_row.sync_version
      );
    end if;
  end if;

  with incoming as (
    select u.id, u.ordinality
    from unnest(ordered_card_ids) with ordinality as u(id, ordinality)
  )
  update public.cards c
  set
    list_id = to_list_id,
    position = (incoming.ordinality::numeric) * 1024,
    version = c.version + 1
  from incoming
  where c.id = incoming.id
    and c.board_id = target_board_id;

  if from_list_id <> to_list_id then
    with remaining_source as (
      select c.id, row_number() over (order by c.position asc) as ordinality
      from public.cards c
      where c.board_id = target_board_id
        and c.list_id = from_list_id
        and c.archived_at is null
    )
    update public.cards c
    set
      position = (remaining_source.ordinality::numeric) * 1024,
      version = c.version + 1
    from remaining_source
    where c.id = remaining_source.id;
  end if;

  update public.lists l
  set version = l.version + 1
  where l.id in (from_list_id, to_list_id);

  update public.boards b
  set sync_version = b.sync_version + 1
  where b.id = target_board_id
  returning b.sync_version into next_board_version;

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
    board_row.workspace_id,
    board_row.id,
    v_actor_id,
    'card',
    target_card_id,
    case when from_list_id = to_list_id then 'reorder' else 'move' end,
    jsonb_build_object(
      'fromListId', from_list_id,
      'toListId', to_list_id,
      'orderedCardIds', ordered_card_ids,
      'mutationId', mutation_id::text,
      'boardVersionAfter', next_board_version
    )
  );

  return jsonb_build_object('ok', true, 'boardVersion', next_board_version);
end;
$$;

revoke all
on function public.reorder_cards_with_version(uuid, uuid, uuid, uuid, uuid[], bigint, uuid)
from public;

grant execute
on function public.reorder_cards_with_version(uuid, uuid, uuid, uuid, uuid[], bigint, uuid)
to authenticated;
