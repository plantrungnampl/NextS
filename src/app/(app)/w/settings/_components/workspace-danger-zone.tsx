"use client";

import { useMemo, useState, type ReactNode } from "react";

import { SubmitButton } from "@/components/ui";

import {
  deleteWorkspaceAction,
  leaveWorkspaceAction,
  transferWorkspaceOwnershipAction,
} from "../actions.danger";
import type { TransferCandidate } from "../page.data";

type WorkspaceDangerZoneProps = {
  canLeaveWorkspace: boolean;
  canManageDanger: boolean;
  transferCandidates: TransferCandidate[];
  workspaceSlug: string;
};

function ConfirmTextField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="space-y-1" htmlFor={id}>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <input
        className="h-10 w-full rounded-md border border-slate-700 bg-[#101520] px-3 text-sm text-slate-100 outline-none focus:border-sky-500"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Nhập đúng workspace slug"
        value={value}
      />
    </label>
  );
}

function ConfirmCheckbox({
  id,
  label,
  onChange,
  checked,
}: {
  checked: boolean;
  id: string;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-300" htmlFor={id}>
      <input
        checked={checked}
        className="h-4 w-4 rounded border-slate-600 bg-[#121826]"
        id={id}
        name="confirmChecked"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

function DangerCard({
  children,
  title,
  tone = "warning",
}: {
  children: ReactNode;
  title: string;
  tone?: "critical" | "warning";
}) {
  return (
    <article
      className={
        tone === "critical"
          ? "rounded-xl border border-rose-900/70 bg-[linear-gradient(145deg,#2a1018,#130b10)] p-4"
          : "rounded-xl border border-amber-900/70 bg-[linear-gradient(145deg,#2b1f0f,#15110d)] p-4"
      }
    >
      <h3 className={tone === "critical" ? "text-sm font-semibold text-rose-200" : "text-sm font-semibold text-amber-200"}>
        {title}
      </h3>
      <div className="mt-3 space-y-3">{children}</div>
    </article>
  );
}

function TransferOwnershipCard({
  transferCandidates,
  workspaceSlug,
}: {
  transferCandidates: TransferCandidate[];
  workspaceSlug: string;
}) {
  const [confirmSlug, setConfirmSlug] = useState("");
  const [checked, setChecked] = useState(false);

  const canSubmit = useMemo(() => {
    return checked && confirmSlug === workspaceSlug;
  }, [checked, confirmSlug, workspaceSlug]);

  return (
    <DangerCard title="Transfer Ownership" tone="warning">
      {transferCandidates.length > 0 ? (
        <form action={transferWorkspaceOwnershipAction} className="space-y-3">
          <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
          <label className="space-y-1" htmlFor="transfer-owner-select">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Owner mới</span>
            <select
              className="h-10 w-full rounded-md border border-slate-700 bg-[#101520] px-3 text-sm text-slate-100 outline-none focus:border-sky-500"
              defaultValue={transferCandidates[0]?.userId}
              id="transfer-owner-select"
              name="newOwnerUserId"
              required
            >
              {transferCandidates.map((candidate) => (
                <option key={candidate.userId} value={candidate.userId}>
                  {candidate.displayName} ({candidate.role})
                </option>
              ))}
            </select>
          </label>

          <ConfirmTextField
            id="transfer-confirm-slug"
            label="Xác nhận slug"
            onChange={setConfirmSlug}
            value={confirmSlug}
          />
          <input name="confirmSlug" type="hidden" value={confirmSlug} />
          <ConfirmCheckbox
            checked={checked}
            id="transfer-confirm-checkbox"
            label="Tôi hiểu rằng owner hiện tại sẽ bị hạ xuống admin."
            onChange={setChecked}
          />

          <SubmitButton
            className="min-h-10 w-full"
            disabled={!canSubmit}
            pendingLabel="Đang chuyển owner..."
            type="submit"
          >
            Chuyển quyền sở hữu
          </SubmitButton>
        </form>
      ) : (
        <p className="text-sm text-amber-100/80">
          Không có thành viên đủ điều kiện để nhận ownership. Hãy mời thêm thành viên trước.
        </p>
      )}
    </DangerCard>
  );
}

function DeleteWorkspaceCard({ workspaceSlug }: { workspaceSlug: string }) {
  const [confirmSlug, setConfirmSlug] = useState("");
  const [checked, setChecked] = useState(false);

  const canSubmit = useMemo(() => {
    return checked && confirmSlug === workspaceSlug;
  }, [checked, confirmSlug, workspaceSlug]);

  return (
    <DangerCard title="Delete Workspace" tone="critical">
      <p className="text-sm text-rose-100/80">
        Hành động này sẽ xóa toàn bộ bảng, thẻ và dữ liệu liên quan. Không thể hoàn tác.
      </p>
      <form action={deleteWorkspaceAction} className="space-y-3">
        <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
        <ConfirmTextField
          id="delete-confirm-slug"
          label="Nhập slug để xác nhận xóa"
          onChange={setConfirmSlug}
          value={confirmSlug}
        />
        <input name="confirmSlug" type="hidden" value={confirmSlug} />
        <ConfirmCheckbox
          checked={checked}
          id="delete-confirm-checkbox"
          label="Tôi hiểu rằng dữ liệu sẽ bị xóa vĩnh viễn."
          onChange={setChecked}
        />

        <SubmitButton
          className="min-h-10 w-full border border-rose-700 bg-rose-900/40 text-rose-100 hover:bg-rose-900/50"
          disabled={!canSubmit}
          pendingLabel="Đang xóa workspace..."
          type="submit"
          variant="secondary"
        >
          Xóa workspace
        </SubmitButton>
      </form>
    </DangerCard>
  );
}

function LeaveWorkspaceCard({ workspaceSlug }: { workspaceSlug: string }) {
  const [confirmSlug, setConfirmSlug] = useState("");
  const [checked, setChecked] = useState(false);

  const canSubmit = useMemo(() => {
    return checked && confirmSlug === workspaceSlug;
  }, [checked, confirmSlug, workspaceSlug]);

  return (
    <DangerCard title="Leave Workspace" tone="warning">
      <p className="text-sm text-amber-100/80">
        Bạn sẽ mất quyền truy cập vào workspace này cho đến khi được mời lại.
      </p>
      <form action={leaveWorkspaceAction} className="space-y-3">
        <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
        <ConfirmTextField
          id="leave-confirm-slug"
          label="Nhập slug để xác nhận rời workspace"
          onChange={setConfirmSlug}
          value={confirmSlug}
        />
        <input name="confirmSlug" type="hidden" value={confirmSlug} />
        <ConfirmCheckbox
          checked={checked}
          id="leave-confirm-checkbox"
          label="Tôi hiểu rằng tôi sẽ rời workspace này."
          onChange={setChecked}
        />

        <SubmitButton
          className="min-h-10 w-full"
          disabled={!canSubmit}
          pendingLabel="Đang rời workspace..."
          type="submit"
        >
          Rời workspace
        </SubmitButton>
      </form>
    </DangerCard>
  );
}

export function WorkspaceDangerZone({
  canLeaveWorkspace,
  canManageDanger,
  transferCandidates,
  workspaceSlug,
}: WorkspaceDangerZoneProps) {
  return (
    <div className="space-y-4">
      {canManageDanger ? (
        <>
          <TransferOwnershipCard transferCandidates={transferCandidates} workspaceSlug={workspaceSlug} />
          <DeleteWorkspaceCard workspaceSlug={workspaceSlug} />
        </>
      ) : null}

      {!canManageDanger && canLeaveWorkspace ? (
        <LeaveWorkspaceCard workspaceSlug={workspaceSlug} />
      ) : null}
    </div>
  );
}
