import { Input, Label, SubmitButton } from "@/components/ui";

import { archiveBoard, createList, renameBoard } from "../actions.forms";
import type { BoardRecord, WorkspaceRole } from "../types";

export function BoardSettingsForm({
  board,
  membershipRole,
  workspaceSlug,
}: {
  board: BoardRecord;
  membershipRole: WorkspaceRole;
  workspaceSlug: string;
}) {
  const canArchiveBoard = membershipRole !== "viewer";

  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-700">
        Board settings
      </summary>
      <div className="absolute left-0 top-full z-20 mt-2 w-[280px] rounded-lg border border-slate-700 bg-[#1b1f29] p-3 shadow-lg shadow-black/35">
        <p className="text-xs text-slate-300">Rename board title</p>
        <form action={renameBoard} className="mt-2 space-y-2">
          <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
          <input name="boardId" type="hidden" value={board.id} />
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-200" htmlFor="board-name">
              Board name
            </Label>
            <Input
              className="min-h-9 border-slate-500 bg-slate-100 text-slate-900 placeholder:text-slate-500"
              defaultValue={board.name}
              id="board-name"
              minLength={1}
              name="name"
              required
            />
          </div>
          <SubmitButton className="min-h-9 w-full bg-[#0c66e4] text-white hover:bg-[#0055cc]" pendingLabel="Saving board...">
            Save board
          </SubmitButton>
        </form>
        {canArchiveBoard ? (
          <form action={archiveBoard} className="mt-3 border-t border-slate-700 pt-3">
            <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
            <input name="boardId" type="hidden" value={board.id} />
            <SubmitButton
              className="min-h-9 w-full border border-rose-700 bg-rose-900/30 text-rose-100 hover:bg-rose-900/50"
              pendingLabel="Archiving board..."
              variant="secondary"
            >
              Archive board
            </SubmitButton>
          </form>
        ) : null}
      </div>
    </details>
  );
}

export function CreateListForm({
  board,
  workspaceSlug,
}: {
  board: BoardRecord;
  workspaceSlug: string;
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-[#1f2634]/80 p-3 text-slate-100">
      <p className="text-sm font-semibold">Create list</p>
      <p className="mt-0.5 text-xs text-slate-300">Add a new column to this board.</p>
      <form action={createList} className="space-y-2">
        <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
        <input name="boardId" type="hidden" value={board.id} />
        <div className="mt-2 space-y-1.5">
          <Label className="text-xs text-slate-200" htmlFor="list-title">
            List title
          </Label>
          <Input
            className="min-h-9 border-slate-500 bg-slate-100 text-slate-900 placeholder:text-slate-500"
            id="list-title"
            maxLength={200}
            minLength={1}
            name="title"
            placeholder="To do"
            required
          />
        </div>
        <SubmitButton className="min-h-9 w-full bg-[#0c66e4] text-white hover:bg-[#0055cc]" pendingLabel="Adding list...">
          Add list
        </SubmitButton>
      </form>
    </div>
  );
}
