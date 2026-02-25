-- Align labels RLS with app guard:
-- workspace owner/admin OR board creator can manage workspace labels.

create or replace function public.can_manage_workspace_labels(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select public.current_user_id()) is not null
    and (
      exists (
        select 1
        from public.workspace_members wm
        where wm.workspace_id = target_workspace_id
          and wm.user_id = (select public.current_user_id())
          and wm.role in ('owner', 'admin')
      )
      or exists (
        select 1
        from public.boards b
        where b.workspace_id = target_workspace_id
          and b.archived_at is null
          and b.created_by = (select public.current_user_id())
      )
    );
$$;

grant execute on function public.can_manage_workspace_labels(uuid) to anon, authenticated, service_role;

drop policy if exists labels_insert_policy on public.labels;
create policy labels_insert_policy
on public.labels
for insert
to authenticated
with check (
  public.can_manage_workspace_labels(workspace_id)
  and created_by = (select public.current_user_id())
);

drop policy if exists labels_update_policy on public.labels;
create policy labels_update_policy
on public.labels
for update
to authenticated
using (public.can_manage_workspace_labels(workspace_id))
with check (public.can_manage_workspace_labels(workspace_id));

drop policy if exists labels_delete_policy on public.labels;
create policy labels_delete_policy
on public.labels
for delete
to authenticated
using (public.can_manage_workspace_labels(workspace_id));
