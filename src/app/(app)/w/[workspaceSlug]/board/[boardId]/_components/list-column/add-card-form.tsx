"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Input, Label, SubmitButton } from "@/components/ui";
import { cn } from "@/shared";

import { useCreateCardMutation } from "../board-mutations/hooks";

export function AddCardForm({
  boardId,
  emphasize,
  listId,
  workspaceSlug,
}: {
  boardId: string;
  emphasize?: boolean;
  listId: string;
  workspaceSlug: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const createCardMutation = useCreateCardMutation({
    boardId,
    listId,
    onCreateSuccess: () => {
      setTitle("");
      setDescription("");
      setIsOpen(false);
    },
    workspaceSlug,
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createCardMutation.isPending) {
      return;
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 1) {
      toast.error("Card title is required.");
      return;
    }

    const trimmedDescription = description.trim();
    createCardMutation.mutate({
      description: trimmedDescription.length > 0 ? trimmedDescription : undefined,
      title: trimmedTitle,
    });
  };

  return (
    <details
      className="mt-2 rounded-md p-1"
      data-shortcut-add-card-container
      onToggle={(event) => {
        setIsOpen((event.currentTarget as HTMLDetailsElement).open);
      }}
      open={isOpen}
    >
      <summary
        className={cn(
          "cursor-pointer rounded-lg px-2 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10",
          emphasize ? "bg-cyan-500/15 text-base font-bold text-cyan-100 ring-1 ring-cyan-400/50" : "",
        )}
        onClick={(event) => {
          event.preventDefault();
          setIsOpen((currentValue) => !currentValue);
        }}
      >
        + Add a card
      </summary>
      <form className="mt-2 space-y-2" onSubmit={handleSubmit}>
        <Label className="sr-only" htmlFor={`new-card-${listId}`}>
          Card title
        </Label>
        <Input
          className="min-h-9 border-slate-600 bg-slate-900/80 text-slate-100 placeholder:text-slate-500"
          disabled={createCardMutation.isPending}
          id={`new-card-${listId}`}
          maxLength={500}
          minLength={1}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          placeholder="Enter a title for this card..."
          required
          value={title}
        />
        <details className="rounded-md border border-white/10 bg-slate-950/55 p-2">
          <summary className="cursor-pointer text-[11px] font-medium text-slate-300">
            Add description
          </summary>
          <Input
            className="mt-2 min-h-9 border-slate-600 bg-slate-900/80 text-slate-100 placeholder:text-slate-500"
            disabled={createCardMutation.isPending}
            maxLength={5000}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            placeholder="Optional description"
            value={description}
          />
        </details>
        <SubmitButton
          className="min-h-9 w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={createCardMutation.isPending}
        >
          {createCardMutation.isPending ? "Adding card..." : "Add card"}
        </SubmitButton>
      </form>
    </details>
  );
}
