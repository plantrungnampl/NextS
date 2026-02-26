"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Globe2, Lock, Users, UsersRound, X, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { cn } from "@/shared";

import { updateBoardVisibilityInline } from "../actions.visibility.inline";
import type { BoardVisibility } from "../types";
import { BOARD_HERO_ICON_BUTTON_BASE_CLASS } from "./board-hero-toolbar-icon-button";
import {
  buildBoardVisibilityQueryKey,
  type BoardVisibilityClientState,
} from "./board-visibility-query";

type VisibilityOption = {
  description: string;
  icon: LucideIcon;
  isDisabled?: boolean;
  label: string;
  value?: BoardVisibilityClientState;
};

const VISIBILITY_OPTIONS: VisibilityOption[] = [
  {
    description:
      "Chỉ thành viên bảng và quản trị viên không gian làm việc mới có thể xem hoặc chỉnh sửa bảng.",
    icon: Lock,
    label: "Riêng tư",
    value: "private",
  },
  {
    description: "Tất cả thành viên không gian làm việc có thể xem và chỉnh sửa bảng này.",
    icon: Users,
    label: "Không gian làm việc",
    value: "workspace",
  },
  {
    description: "Bất kỳ ai có liên kết đều có thể xem bảng. Chỉ thành viên bảng mới có quyền sửa.",
    icon: Globe2,
    label: "Công khai",
    value: "public",
  },
  {
    description: "Chưa hỗ trợ trong phiên bản hiện tại.",
    icon: Building2,
    isDisabled: true,
    label: "Tổ chức",
  },
];

// eslint-disable-next-line max-lines-per-function
export function BoardHeroVisibilityButton({
  boardId,
  canManage,
  visibility,
  workspaceSlug,
}: {
  boardId: string;
  canManage: boolean;
  visibility: BoardVisibility;
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const queryKey = useMemo(
    () => buildBoardVisibilityQueryKey({ boardId, workspaceSlug }),
    [boardId, workspaceSlug],
  );

  const mutation = useMutation({
    mutationFn: async (nextVisibility: BoardVisibilityClientState) =>
      updateBoardVisibilityInline({
        boardId,
        nextVisibility,
        workspaceSlug,
      }),
    onError: (_, __, context) => {
      if (context?.previousVisibility) {
        queryClient.setQueryData(queryKey, context.previousVisibility);
      }
      toast.error("Không thể cập nhật quyền xem bảng.");
    },
    onMutate: async (nextVisibility: BoardVisibilityClientState) => {
      await queryClient.cancelQueries({ queryKey });
      const previousVisibility = queryClient.getQueryData<BoardVisibilityClientState>(queryKey) ?? visibility;
      queryClient.setQueryData(queryKey, nextVisibility);
      return {
        previousVisibility,
      };
    },
    onSuccess: (result, _, context) => {
      if (!result.ok) {
        queryClient.setQueryData(queryKey, context?.previousVisibility ?? visibility);
        toast.error(result.error ?? "Không thể cập nhật quyền xem bảng.");
        return;
      }

      queryClient.setQueryData(queryKey, result.visibility);
      if (result.visibility !== context?.previousVisibility) {
        toast.success("Đã cập nhật quyền xem bảng.");
      }
    },
  });

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label="Members"
          className={BOARD_HERO_ICON_BUTTON_BASE_CLASS}
          type="button"
        >
          <UsersRound className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] border-[#4a5160] bg-[#2f343d] p-0 text-slate-100">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-sm font-semibold">Khả năng xem</p>
          <button
            aria-label="Đóng"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
            onClick={() => {
              setOpen(false);
            }}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1 px-2 py-2" role="menu">
          {VISIBILITY_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isCurrent = option.value ? option.value === visibility : false;
            const isMutationDisabled = mutation.isPending;
            const isDisabled = option.isDisabled || !option.value || !canManage || isMutationDisabled;

            return (
              <button
                aria-checked={isCurrent}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left transition",
                  isDisabled
                    ? "cursor-not-allowed opacity-60"
                    : "hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70",
                )}
                disabled={isDisabled}
                key={option.label}
                onClick={() => {
                  if (!option.value || option.value === visibility || !canManage || mutation.isPending) {
                    return;
                  }

                  mutation.mutate(option.value);
                }}
                role="menuitemradio"
                type="button"
              >
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center text-slate-200">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium text-slate-100">{option.label}</span>
                  <span className="mt-0.5 block text-sm leading-5 text-slate-300">{option.description}</span>
                </span>
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-slate-100">
                  {isCurrent ? <Check className="h-4 w-4" /> : null}
                </span>
              </button>
            );
          })}
        </div>
        {!canManage ? (
          <p className="border-t border-white/10 px-4 py-2 text-xs text-slate-300">Bạn chỉ có quyền xem.</p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
