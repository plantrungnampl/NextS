import Image from "next/image";

import { SubmitButton, Textarea } from "@/components/ui";

import {
  removeWorkspaceLogoAction,
  updateWorkspaceCoreAction,
  uploadWorkspaceLogoAction,
} from "../actions.general";

type WorkspaceGeneralData = {
  description: string | null;
  id: string;
  logo_path: string | null;
  name: string;
  slug: string;
};

type WorkspaceSettingsGeneralTabProps = {
  canManageCore: boolean;
  workspace: WorkspaceGeneralData;
};

function WorkspaceLogoPreview({ workspace }: { workspace: WorkspaceGeneralData }) {
  if (workspace.logo_path) {
    return (
      <Image
        alt={`${workspace.name} logo`}
        className="h-14 w-14 rounded-lg border border-slate-700 object-cover"
        height={56}
        src={`/api/workspaces/${workspace.id}/logo`}
        unoptimized
        width={56}
      />
    );
  }

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-slate-600 text-xl font-semibold text-slate-400">
      {workspace.name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function WorkspaceCoreForm({
  canManageCore,
  workspace,
}: WorkspaceSettingsGeneralTabProps) {
  return (
    <form action={updateWorkspaceCoreAction} className="mt-4 space-y-3">
      <input name="workspaceSlug" type="hidden" value={workspace.slug} />

      <label className="space-y-1" htmlFor="workspace-name">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tên workspace</span>
        <input
          className="h-10 w-full rounded-md border border-slate-700 bg-[#0e1420] px-3 text-sm text-slate-100 outline-none focus:border-sky-500"
          defaultValue={workspace.name}
          disabled={!canManageCore}
          id="workspace-name"
          name="name"
          required
        />
      </label>

      <label className="space-y-1" htmlFor="workspace-slug">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Slug</span>
        <input
          className="h-10 w-full rounded-md border border-slate-700 bg-[#0e1420] px-3 text-sm text-slate-100 outline-none focus:border-sky-500"
          defaultValue={workspace.slug}
          disabled={!canManageCore}
          id="workspace-slug"
          name="slug"
          required
        />
      </label>

      <label className="space-y-1" htmlFor="workspace-description">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mô tả</span>
        <Textarea
          className="min-h-28 border-slate-700 bg-[#0e1420] text-slate-100 placeholder:text-slate-500"
          defaultValue={workspace.description ?? ""}
          disabled={!canManageCore}
          id="workspace-description"
          name="description"
          placeholder="Mô tả mục tiêu, phạm vi hoặc nguyên tắc làm việc của workspace"
        />
      </label>

      {canManageCore ? (
        <SubmitButton className="min-h-10" pendingLabel="Đang lưu thay đổi...">
          Lưu thay đổi
        </SubmitButton>
      ) : (
        <p className="text-sm text-slate-400">Bạn chỉ có quyền xem. Owner/Admin mới có quyền chỉnh sửa phần này.</p>
      )}
    </form>
  );
}

function WorkspaceLogoForm({
  canManageCore,
  workspace,
}: WorkspaceSettingsGeneralTabProps) {
  return (
    <article className="rounded-xl border border-slate-800 bg-[#101623]/80 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Logo workspace</h2>
      <p className="mt-1 text-sm text-slate-400">Logo được dùng ở các vùng nhận diện workspace và chia sẻ nội bộ.</p>

      <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-700 bg-[#0d1320] p-3">
        <WorkspaceLogoPreview workspace={workspace} />
        <div>
          <p className="text-sm font-medium text-slate-100">{workspace.name}</p>
          <p className="text-xs text-slate-400">PNG/JPG/WebP, tối đa 5MB</p>
        </div>
      </div>

      {canManageCore ? (
        <>
          <form action={uploadWorkspaceLogoAction} className="mt-3 space-y-2">
            <input name="workspaceSlug" type="hidden" value={workspace.slug} />
            <input
              accept="image/*"
              className="block w-full rounded-md border border-slate-700 bg-[#0e1420] px-3 py-2 text-sm text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-sky-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-sky-50"
              name="logo"
              required
              type="file"
            />
            <SubmitButton className="min-h-10" pendingLabel="Đang tải logo...">
              Tải logo lên
            </SubmitButton>
          </form>

          {workspace.logo_path ? (
            <form action={removeWorkspaceLogoAction} className="mt-2">
              <input name="workspaceSlug" type="hidden" value={workspace.slug} />
              <SubmitButton
                className="min-h-10 border border-slate-700 bg-[#0f1625] text-slate-200 hover:bg-[#182135]"
                pendingLabel="Đang xóa logo..."
                type="submit"
                variant="secondary"
              >
                Xóa logo hiện tại
              </SubmitButton>
            </form>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-400">Bạn chỉ có quyền xem logo workspace.</p>
      )}
    </article>
  );
}

export function WorkspaceSettingsGeneralTab({
  canManageCore,
  workspace,
}: WorkspaceSettingsGeneralTabProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <article className="rounded-xl border border-slate-800 bg-[#101623]/80 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">Thông tin cơ bản</h2>
        <p className="mt-1 text-sm text-slate-400">Cập nhật tên, slug và mô tả của workspace.</p>
        <WorkspaceCoreForm canManageCore={canManageCore} workspace={workspace} />
      </article>

      <WorkspaceLogoForm canManageCore={canManageCore} workspace={workspace} />
    </div>
  );
}
