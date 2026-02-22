"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Textarea,
} from "@/components/ui";

import {
  createCardCommentInline,
  deleteCardCommentInline,
  updateCardCommentInline,
} from "../actions.card-richness";
import type { CommentRecord, WorkspaceMemberRecord } from "../types";
import {
  filterMentionCandidates,
  formatCommentTimestamp,
  resolveMentionContext,
  toFormData,
  type CommentMutationResult,
  type MentionContext,
} from "./card-richness-comments-helpers";
import type { CardRichnessSnapshot } from "../types";
import { buildCardModalMutationKey } from "./card-richness-mutation-keys";
import { getInitials } from "./card-ui-utils";

type SubmitMutation = (run: () => Promise<CommentMutationResult>) => void;

function invalidateRichnessQuery(params: {
  queryClient: QueryClient;
  richnessQueryKey: readonly [string, string, string, string];
}) {
  void params.queryClient.invalidateQueries({ queryKey: params.richnessQueryKey });
}

function MentionDropdown({
  candidates,
  onSelect,
}: {
  candidates: WorkspaceMemberRecord[];
  onSelect: (member: WorkspaceMemberRecord) => void;
}) {
  return (
    <div className="absolute z-20 mt-1 w-full max-w-sm rounded-md border border-slate-700 bg-[#161b22] p-1 shadow-xl">
      {candidates.map((member) => (
        <button
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
          key={member.id}
          onClick={() => onSelect(member)}
          type="button"
        >
          <Avatar className="h-7 w-7 border border-slate-700">
            {member.avatarUrl ? <AvatarImage alt={member.displayName} src={member.avatarUrl} /> : null}
            <AvatarFallback className="bg-slate-700 text-[10px] text-slate-100">
              {getInitials(member.displayName)}
            </AvatarFallback>
          </Avatar>
          <span>{member.displayName}</span>
        </button>
      ))}
    </div>
  );
}

function CommentComposer({
  boardId,
  canWrite,
  cardId,
  isPending,
  onSubmit,
  viewer,
  workspaceMembers,
  workspaceSlug,
}: {
  boardId: string;
  canWrite: boolean;
  cardId: string;
  isPending: boolean;
  onSubmit: SubmitMutation;
  viewer: WorkspaceMemberRecord | null;
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
}) {
  const [body, setBody] = useState("");
  const [mentionContext, setMentionContext] = useState<MentionContext | null>(null);
  const textareaElementRef = useRef<HTMLTextAreaElement | null>(null);
  const mentionCandidates = useMemo(
    () => filterMentionCandidates(mentionContext, workspaceMembers),
    [mentionContext, workspaceMembers],
  );
  const handleCreateComment = () => {
    const normalizedBody = body.trim();
    if (normalizedBody.length < 1) {
      return;
    }
    onSubmit(async () => {
      const result = await createCardCommentInline(
        toFormData([
          ["boardId", boardId],
          ["body", normalizedBody],
          ["cardId", cardId],
          ["workspaceSlug", workspaceSlug],
        ]),
      );
      if (result.ok) {
        setBody("");
        setMentionContext(null);
      }
      return result;
    });
  };
  const applyMention = (member: WorkspaceMemberRecord) => {
    if (!mentionContext) {
      return;
    }
    const mentionText = `@${member.displayName}`;
    const nextBody = `${body.slice(0, mentionContext.start)}${mentionText} ${body.slice(mentionContext.end)}`;
    const nextCursor = mentionContext.start + mentionText.length + 1;
    setBody(nextBody);
    setMentionContext(null);
    requestAnimationFrame(() => {
      if (!textareaElementRef.current) {
        return;
      }
      textareaElementRef.current.focus();
      textareaElementRef.current.selectionStart = nextCursor;
      textareaElementRef.current.selectionEnd = nextCursor;
    });
  };
  if (!canWrite) {
    return <p className="text-[11px] text-slate-400">Read-only mode: comments are locked.</p>;
  }
  return (
    <div className="flex items-start gap-3">
      <Avatar className="h-9 w-9 shrink-0 border border-slate-700">
        {viewer?.avatarUrl ? <AvatarImage alt={viewer.displayName} src={viewer.avatarUrl} /> : null}
        <AvatarFallback className="bg-slate-700 text-xs text-slate-100">
          {getInitials(viewer?.displayName ?? "You")}
        </AvatarFallback>
      </Avatar>
      <div className="relative min-w-0 flex-1">
        <div className="flex items-end gap-2">
          <Textarea
            className="min-h-16 flex-1 resize-y border-slate-600 bg-[#0f1318] text-sm text-slate-100 placeholder:text-slate-400"
            maxLength={5000}
            onChange={(event) => {
              textareaElementRef.current = event.target;
              const nextValue = event.target.value;
              setBody(nextValue);
              setMentionContext(resolveMentionContext(nextValue, event.target.selectionStart));
            }}
            onClick={(event) => {
              const target = event.target as HTMLTextAreaElement;
              textareaElementRef.current = target;
              setMentionContext(resolveMentionContext(target.value, target.selectionStart));
            }}
            onFocus={(event) => {
              textareaElementRef.current = event.target;
            }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                handleCreateComment();
              }
            }}
            placeholder="Write a comment... Use @ to mention"
            value={body}
          />
          <Button
            className="h-9 shrink-0 bg-[#0c66e4] px-3 text-white hover:bg-[#0055cc]"
            disabled={isPending || body.trim().length < 1}
            onClick={handleCreateComment}
            type="button"
          >
            Add comment
          </Button>
        </div>
        {mentionContext && mentionCandidates.length > 0 ? (
          <MentionDropdown candidates={mentionCandidates} onSelect={applyMention} />
        ) : null}
      </div>
    </div>
  );
}

function CommentCardActions({
  boardId,
  canManageComment,
  comment,
  onEdit,
  onSubmit,
  workspaceSlug,
}: {
  boardId: string;
  canManageComment: boolean;
  comment: CommentRecord;
  onEdit: () => void;
  onSubmit: SubmitMutation;
  workspaceSlug: string;
}) {
  if (!canManageComment) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Comment actions"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          type="button"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Edit comment
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-rose-200 focus:text-rose-100"
          onSelect={() => {
            onSubmit(async () => {
              return deleteCardCommentInline(
                toFormData([
                  ["boardId", boardId],
                  ["commentId", comment.id],
                  ["workspaceSlug", workspaceSlug],
                ]),
              );
            });
          }}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete comment
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CommentInlineEditor({
  boardId,
  comment,
  editBody,
  isPending,
  onCancel,
  onChange,
  onSubmit,
  workspaceSlug,
}: {
  boardId: string;
  comment: CommentRecord;
  editBody: string;
  isPending: boolean;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSubmit: SubmitMutation;
  workspaceSlug: string;
}) {
  const handleSave = () => {
    const nextBody = editBody.trim();
    if (nextBody.length < 1) {
      return;
    }

    onSubmit(async () => {
      const result = await updateCardCommentInline(
        toFormData([
          ["boardId", boardId],
          ["body", nextBody],
          ["commentId", comment.id],
          ["workspaceSlug", workspaceSlug],
        ]),
      );
      if (result.ok) {
        onCancel();
      }
      return result;
    });
  };

  return (
    <div className="mt-2 space-y-2">
      <Textarea
        className="min-h-16 border-slate-600 bg-[#161b22] text-sm text-slate-100 placeholder:text-slate-400"
        maxLength={5000}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        value={editBody}
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          className="h-8 border-slate-600 bg-slate-800 px-3 text-slate-100 hover:bg-slate-700"
          onClick={onCancel}
          type="button"
          variant="secondary"
        >
          Cancel
        </Button>
        <Button
          className="h-8 bg-[#0c66e4] px-3 text-white hover:bg-[#0055cc]"
          disabled={isPending || editBody.trim().length < 1}
          onClick={handleSave}
          type="button"
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function CommentCard({
  boardId,
  canManageComment,
  comment,
  isPending,
  onSubmit,
  workspaceSlug,
}: {
  boardId: string;
  canManageComment: boolean;
  comment: CommentRecord;
  isPending: boolean;
  onSubmit: SubmitMutation;
  workspaceSlug: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);

  return (
    <article className="rounded-md border border-slate-700/80 bg-[#0f1318] p-3">
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9 shrink-0 border border-slate-700">
          {comment.authorAvatarUrl ? <AvatarImage alt={comment.authorDisplayName} src={comment.authorAvatarUrl} /> : null}
          <AvatarFallback className="bg-slate-700 text-xs text-slate-100">
            {getInitials(comment.authorDisplayName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-200">{comment.authorDisplayName}</p>
              <p className="text-[11px] text-slate-400">{formatCommentTimestamp(comment.createdAt)}</p>
            </div>
            <CommentCardActions
              boardId={boardId}
              canManageComment={canManageComment}
              comment={comment}
              onEdit={() => {
                setEditBody(comment.body);
                setIsEditing(true);
              }}
              onSubmit={onSubmit}
              workspaceSlug={workspaceSlug}
            />
          </div>
          {isEditing ? (
            <CommentInlineEditor
              boardId={boardId}
              comment={comment}
              editBody={editBody}
              isPending={isPending}
              onCancel={() => {
                setIsEditing(false);
                setEditBody(comment.body);
              }}
              onChange={setEditBody}
              onSubmit={onSubmit}
              workspaceSlug={workspaceSlug}
            />
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{comment.body}</p>
          )}
        </div>
      </div>
    </article>
  );
}

export function CardRichnessCommentsSection({
  boardId,
  canManageAllComments,
  canWrite,
  cardId,
  comments,
  richnessQueryKey,
  viewerId,
  workspaceMembers,
  workspaceSlug,
}: {
  boardId: string;
  canManageAllComments: boolean;
  canWrite: boolean;
  cardId: string;
  comments: CommentRecord[];
  richnessQueryKey: readonly [string, string, string, string];
  viewerId: string;
  workspaceMembers: WorkspaceMemberRecord[];
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const modalMutationKey = buildCardModalMutationKey({
    boardId,
    cardId,
    workspaceSlug,
  });
  const mutation = useMutation({
    mutationKey: [...modalMutationKey, "comments"],
    mutationFn: async (run: () => Promise<CommentMutationResult>) => run(),
    onError: () => {
      toast.error("Không thể đồng bộ bình luận.");
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      invalidateRichnessQuery({
        queryClient,
        richnessQueryKey,
      });
    },
  });
  const isPending = mutation.isPending;
  const viewer = workspaceMembers.find((member) => member.id === viewerId) ?? null;

  const submitMutation = (run: () => Promise<CommentMutationResult>) => {
    mutation.mutate(run);
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-700/60 bg-slate-950/35 p-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Activity</p>
      <CommentComposer
        boardId={boardId}
        canWrite={canWrite}
        cardId={cardId}
        isPending={isPending}
        onSubmit={submitMutation}
        viewer={viewer}
        workspaceMembers={workspaceMembers}
        workspaceSlug={workspaceSlug}
      />
      <div className="space-y-2">
        {comments.length > 0 ? (
          comments.map((comment) => (
            <CommentCard
              boardId={boardId}
              canManageComment={canWrite && (canManageAllComments || comment.createdBy === viewerId)}
              comment={comment}
              isPending={isPending}
              key={comment.id}
              onSubmit={submitMutation}
              workspaceSlug={workspaceSlug}
            />
          ))
        ) : (
          <p className="text-xs text-slate-400">No comments yet.</p>
        )}
      </div>
    </section>
  );
}
