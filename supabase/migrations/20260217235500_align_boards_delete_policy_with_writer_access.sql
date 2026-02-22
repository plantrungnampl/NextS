drop policy if exists boards_delete_policy on public.boards;
create policy boards_delete_policy
on public.boards
for delete
to authenticated
using (public.can_write_board(id));
