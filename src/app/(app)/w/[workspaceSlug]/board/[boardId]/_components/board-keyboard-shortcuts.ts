"use client";

import { useEffect } from "react";

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  return Boolean(target.closest("[contenteditable='true']"));
}

function openFirstDetailsAndFocusInput(selector: string): void {
  const detailsElement = document.querySelector<HTMLDetailsElement>(selector);
  if (!detailsElement) {
    return;
  }

  detailsElement.open = true;
  const input = detailsElement.querySelector<HTMLInputElement>("input[name='title']");
  input?.focus();
  input?.select();
}

type UseBoardKeyboardShortcutsArgs = {
  canMutate: boolean;
  hasOpenCardModal: boolean;
  onSearchShortcut: () => void;
};

export function useBoardKeyboardShortcuts({
  canMutate,
  hasOpenCardModal,
  onSearchShortcut,
}: UseBoardKeyboardShortcutsArgs) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const editable = isEditableElement(event.target);

      if ((event.metaKey || event.ctrlKey) && key === "enter") {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
          const form = activeElement.closest("form");
          if (form instanceof HTMLFormElement) {
            event.preventDefault();
            form.requestSubmit();
          }
        }
        return;
      }

      if (editable) {
        return;
      }

      if (key === "/") {
        event.preventDefault();
        onSearchShortcut();
        return;
      }

      if (!canMutate || hasOpenCardModal || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (key === "c") {
        event.preventDefault();
        openFirstDetailsAndFocusInput("[data-shortcut-add-card-container]");
        return;
      }

      if (key === "n") {
        event.preventDefault();
        openFirstDetailsAndFocusInput("[data-shortcut-add-list-container]");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [canMutate, hasOpenCardModal, onSearchShortcut]);
}
