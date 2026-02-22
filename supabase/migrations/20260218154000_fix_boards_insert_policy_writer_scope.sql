drop policy if exists boards_insert_policy on public.boards;

create policy boards_insert_policy
on public.boards
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = public.boards.workspace_id
      and wm.user_id = (select auth.uid())
      and wm.role in ('owner', 'admin', 'member')
  )
);
