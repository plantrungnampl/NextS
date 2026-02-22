create or replace function public.move_card_with_intent_version(
  target_board_id uuid,
  target_card_id uuid,
  to_list_id uuid,
  before_card_id uuid,
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
  source_list_id uuid;
  deduped_version bigint;
  next_board_version bigint;
  target_card_ids uuid[];
  target_length integer;
  insert_index integer;
  final_target_ids uuid[];
begin
  if v_actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Authentication required.');
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

  if not public.can_write_board(board_row.id) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'Write access required.');
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

  source_list_id := moved_card_row.list_id;

  if not exists (
    select 1
    from public.lists l
    where l.id = to_list_id
      and l.board_id = target_board_id
      and l.archived_at is null
  ) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Target list not found.');
  end if;

  if before_card_id is not null and before_card_id = target_card_id then
    return jsonb_build_object('ok', false, 'code', 'INVALID', 'message', 'before_card_id cannot be the moving card.');
  end if;

  if before_card_id is not null and not exists (
    select 1
    from public.cards c
    where c.id = before_card_id
      and c.board_id = target_board_id
      and c.list_id = to_list_id
      and c.archived_at is null
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'CONFLICT',
      'message', 'Anchor card changed. Try again.',
      'latestBoardVersion', board_row.sync_version
    );
  end if;

  select coalesce(array_agg(c.id order by c.position asc), '{}'::uuid[])
  into target_card_ids
  from public.cards c
  where c.board_id = target_board_id
    and c.list_id = to_list_id
    and c.archived_at is null
    and c.id <> target_card_id;

  target_length := coalesce(array_length(target_card_ids, 1), 0);

  if before_card_id is null then
    insert_index := target_length + 1;
  else
    insert_index := array_position(target_card_ids, before_card_id);
    if insert_index is null then
      return jsonb_build_object(
        'ok', false,
        'code', 'CONFLICT',
        'message', 'Anchor card changed. Try again.',
        'latestBoardVersion', board_row.sync_version
      );
    end if;
  end if;

  if target_length = 0 then
    final_target_ids := array[target_card_id]::uuid[];
  elsif insert_index <= 1 then
    final_target_ids := array[target_card_id]::uuid[] || target_card_ids;
  elsif insert_index > target_length then
    final_target_ids := target_card_ids || array[target_card_id]::uuid[];
  else
    final_target_ids := target_card_ids[1:(insert_index - 1)]
      || array[target_card_id]::uuid[]
      || target_card_ids[insert_index:target_length];
  end if;

  with incoming as (
    select u.id, u.ordinality
    from unnest(final_target_ids) with ordinality as u(id, ordinality)
  )
  update public.cards c
  set
    list_id = to_list_id,
    position = (incoming.ordinality::numeric) * 1024,
    version = c.version + 1
  from incoming
  where c.id = incoming.id
    and c.board_id = target_board_id;

  if source_list_id <> to_list_id then
    with remaining_source as (
      select c.id, row_number() over (order by c.position asc) as ordinality
      from public.cards c
      where c.board_id = target_board_id
        and c.list_id = source_list_id
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
  where l.id in (source_list_id, to_list_id);

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
    case when source_list_id = to_list_id then 'reorder' else 'move' end,
    jsonb_build_object(
      'fromListId', source_list_id,
      'toListId', to_list_id,
      'beforeCardId', before_card_id,
      'mutationId', mutation_id::text,
      'boardVersionAfter', next_board_version
    )
  );

  return jsonb_build_object('ok', true, 'boardVersion', next_board_version);
end;
$$;

revoke all
on function public.move_card_with_intent_version(uuid, uuid, uuid, uuid, bigint, uuid)
from public;

grant execute
on function public.move_card_with_intent_version(uuid, uuid, uuid, uuid, bigint, uuid)
to authenticated;
