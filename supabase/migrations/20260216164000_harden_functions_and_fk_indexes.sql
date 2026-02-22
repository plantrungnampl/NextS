-- Hardening pass: fix mutable search_path warnings and add missing FK indexes.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_user_email()
returns text
language sql
stable
set search_path = public
as $$
  select lower(coalesce((select auth.jwt() ->> 'email'), ''));
$$;

create index if not exists activity_events_actor_id_idx
  on public.activity_events (actor_id);

create index if not exists attachments_created_by_idx
  on public.attachments (created_by);

create index if not exists boards_created_by_idx
  on public.boards (created_by);

create index if not exists card_assignees_user_id_idx
  on public.card_assignees (user_id);

create index if not exists card_comments_created_by_idx
  on public.card_comments (created_by);

create index if not exists card_labels_label_id_idx
  on public.card_labels (label_id);

create index if not exists cards_created_by_idx
  on public.cards (created_by);

create index if not exists cards_list_board_idx
  on public.cards (list_id, board_id);

create index if not exists invites_accepted_by_idx
  on public.invites (accepted_by);

create index if not exists invites_invited_by_idx
  on public.invites (invited_by);

create index if not exists labels_created_by_idx
  on public.labels (created_by);

create index if not exists workspaces_created_by_idx
  on public.workspaces (created_by);
