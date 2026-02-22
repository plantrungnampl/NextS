-- Optimize RLS policy execution plans:
-- 1) Wrap auth calls with (select auth.uid()) pattern
-- 2) Merge duplicate permissive UPDATE policies on invites

drop policy if exists profiles_select_policy on public.profiles;
create policy profiles_select_policy
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.workspace_members wm_self
    join public.workspace_members wm_target
      on wm_target.workspace_id = wm_self.workspace_id
    where wm_self.user_id = (select auth.uid())
      and wm_target.user_id = public.profiles.id
  )
);

drop policy if exists profiles_insert_policy on public.profiles;
create policy profiles_insert_policy
on public.profiles
for insert
to authenticated
with check (id = (select auth.uid()));

drop policy if exists profiles_update_policy on public.profiles;
create policy profiles_update_policy
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists workspaces_insert_policy on public.workspaces;
create policy workspaces_insert_policy
on public.workspaces
for insert
to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists workspaces_delete_policy on public.workspaces;
create policy workspaces_delete_policy
on public.workspaces
for delete
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = public.workspaces.id
      and wm.user_id = (select auth.uid())
      and wm.role = 'owner'
  )
);

drop policy if exists workspace_members_delete_policy on public.workspace_members;
create policy workspace_members_delete_policy
on public.workspace_members
for delete
to authenticated
using (
  public.is_workspace_admin(workspace_id)
  or (user_id = (select auth.uid()) and role <> 'owner')
);

drop policy if exists boards_insert_policy on public.boards;
create policy boards_insert_policy
on public.boards
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

drop policy if exists cards_insert_policy on public.cards;
create policy cards_insert_policy
on public.cards
for insert
to authenticated
with check (
  public.is_workspace_member(public.board_workspace_id(board_id))
  and created_by = (select auth.uid())
);

drop policy if exists labels_insert_policy on public.labels;
create policy labels_insert_policy
on public.labels
for insert
to authenticated
with check (
  public.is_workspace_admin(workspace_id)
  and created_by = (select auth.uid())
);

drop policy if exists card_comments_insert_policy on public.card_comments;
create policy card_comments_insert_policy
on public.card_comments
for insert
to authenticated
with check (
  public.is_workspace_member(public.card_workspace_id(card_id))
  and created_by = (select auth.uid())
);

drop policy if exists card_comments_update_policy on public.card_comments;
create policy card_comments_update_policy
on public.card_comments
for update
to authenticated
using (
  created_by = (select auth.uid())
  or public.is_workspace_admin(public.card_workspace_id(card_id))
)
with check (
  created_by = (select auth.uid())
  or public.is_workspace_admin(public.card_workspace_id(card_id))
);

drop policy if exists card_comments_delete_policy on public.card_comments;
create policy card_comments_delete_policy
on public.card_comments
for delete
to authenticated
using (
  created_by = (select auth.uid())
  or public.is_workspace_admin(public.card_workspace_id(card_id))
);

drop policy if exists attachments_insert_policy on public.attachments;
create policy attachments_insert_policy
on public.attachments
for insert
to authenticated
with check (
  public.is_workspace_member(public.card_workspace_id(card_id))
  and created_by = (select auth.uid())
);

drop policy if exists attachments_update_policy on public.attachments;
create policy attachments_update_policy
on public.attachments
for update
to authenticated
using (
  created_by = (select auth.uid())
  or public.is_workspace_admin(public.card_workspace_id(card_id))
)
with check (
  created_by = (select auth.uid())
  or public.is_workspace_admin(public.card_workspace_id(card_id))
);

drop policy if exists attachments_delete_policy on public.attachments;
create policy attachments_delete_policy
on public.attachments
for delete
to authenticated
using (
  created_by = (select auth.uid())
  or public.is_workspace_admin(public.card_workspace_id(card_id))
);

drop policy if exists invites_admin_insert_policy on public.invites;
create policy invites_admin_insert_policy
on public.invites
for insert
to authenticated
with check (
  public.is_workspace_admin(workspace_id)
  and invited_by = (select auth.uid())
);

drop policy if exists invites_admin_update_policy on public.invites;
drop policy if exists invites_accept_update_policy on public.invites;
drop policy if exists invites_update_policy on public.invites;
create policy invites_update_policy
on public.invites
for update
to authenticated
using (
  public.is_workspace_admin(workspace_id)
  or (
    lower(invited_email) = public.current_user_email()
    and status = 'pending'
  )
)
with check (
  public.is_workspace_admin(workspace_id)
  or (
    lower(invited_email) = public.current_user_email()
    and status = 'accepted'
    and accepted_by = (select auth.uid())
    and accepted_at is not null
  )
);

drop policy if exists activity_events_insert_policy on public.activity_events;
create policy activity_events_insert_policy
on public.activity_events
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and actor_id = (select auth.uid())
);
