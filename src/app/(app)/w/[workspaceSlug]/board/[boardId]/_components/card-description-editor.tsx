"use client";

import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code2,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { LoadingInline } from "@/components/ui";

type CardDescriptionEditorProps = {
  canWrite: boolean;
  onChange: (nextValue: string) => void;
  onRequestCancel?: () => void;
  onRequestSave?: () => void;
  value: string;
};

type ToolbarAction = {
  disabled?: (editor: Editor) => boolean;
  icon: LucideIcon;
  isActive?: (editor: Editor) => boolean;
  key: string;
  label: string;
  run: (editor: Editor) => void;
};

function ToolbarDivider() {
  return <span className="mx-1 h-6 w-px bg-slate-700" />;
}

function ToolbarActionButton({
  action,
  canWrite,
  editor,
}: {
  action: ToolbarAction;
  canWrite: boolean;
  editor: Editor;
}) {
  const Icon = action.icon;
  const isActive = action.isActive?.(editor) ?? false;
  const isDisabled = !canWrite || (action.disabled ? action.disabled(editor) : false);
  const baseClass =
    "inline-flex h-8 w-8 items-center justify-center rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-60";
  const variantClass = isActive
    ? "border-cyan-300/70 bg-cyan-500/20 text-cyan-100"
    : "border-slate-700 bg-[#1f2530] text-slate-200 hover:bg-[#2a313d]";

  return (
    <button
      className={`${baseClass} ${variantClass}`}
      disabled={isDisabled}
      onClick={() => action.run(editor)}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      title={action.label}
      type="button"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ToolbarActions({
  actions,
  canWrite,
  editor,
}: {
  actions: ToolbarAction[];
  canWrite: boolean;
  editor: Editor;
}) {
  return actions.map((action) => (
    <ToolbarActionButton action={action} canWrite={canWrite} editor={editor} key={action.key} />
  ));
}

function RichToolbar({ canWrite, editor }: { canWrite: boolean; editor: Editor }) {
  const activeBlock = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
      ? "h2"
      : editor.isActive("heading", { level: 3 })
        ? "h3"
        : "paragraph";

  const textActions: ToolbarAction[] = [
    {
      icon: Bold,
      isActive: (activeEditor) => activeEditor.isActive("bold"),
      key: "bold",
      label: "Bold",
      run: (activeEditor) => activeEditor.chain().focus().toggleBold().run(),
    },
    {
      icon: Italic,
      isActive: (activeEditor) => activeEditor.isActive("italic"),
      key: "italic",
      label: "Italic",
      run: (activeEditor) => activeEditor.chain().focus().toggleItalic().run(),
    },
    {
      icon: Strikethrough,
      isActive: (activeEditor) => activeEditor.isActive("strike"),
      key: "strike",
      label: "Strikethrough",
      run: (activeEditor) => activeEditor.chain().focus().toggleStrike().run(),
    },
  ];
  const structureActions: ToolbarAction[] = [
    {
      icon: List,
      isActive: (activeEditor) => activeEditor.isActive("bulletList"),
      key: "bulletList",
      label: "Bullet list",
      run: (activeEditor) => activeEditor.chain().focus().toggleBulletList().run(),
    },
    {
      icon: ListOrdered,
      isActive: (activeEditor) => activeEditor.isActive("orderedList"),
      key: "orderedList",
      label: "Ordered list",
      run: (activeEditor) => activeEditor.chain().focus().toggleOrderedList().run(),
    },
    {
      icon: Quote,
      isActive: (activeEditor) => activeEditor.isActive("blockquote"),
      key: "blockquote",
      label: "Quote",
      run: (activeEditor) => activeEditor.chain().focus().toggleBlockquote().run(),
    },
    {
      icon: Code2,
      isActive: (activeEditor) => activeEditor.isActive("codeBlock"),
      key: "codeBlock",
      label: "Code block",
      run: (activeEditor) => activeEditor.chain().focus().toggleCodeBlock().run(),
    },
    {
      icon: Minus,
      key: "horizontalRule",
      label: "Horizontal line",
      run: (activeEditor) => activeEditor.chain().focus().setHorizontalRule().run(),
    },
  ];
  const historyActions: ToolbarAction[] = [
    {
      disabled: (activeEditor) => !activeEditor.can().chain().focus().undo().run(),
      icon: Undo2,
      key: "undo",
      label: "Undo",
      run: (activeEditor) => activeEditor.chain().focus().undo().run(),
    },
    {
      disabled: (activeEditor) => !activeEditor.can().chain().focus().redo().run(),
      icon: Redo2,
      key: "redo",
      label: "Redo",
      run: (activeEditor) => activeEditor.chain().focus().redo().run(),
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-700 bg-[#1a212c] px-2 py-1.5">
      <select
        className="h-8 rounded border border-slate-700 bg-[#1f2530] px-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70"
        disabled={!canWrite}
        onChange={(event) => {
          const nextValue = event.target.value;
          if (nextValue === "paragraph") {
            editor.chain().focus().setParagraph().run();
            return;
          }
          editor
            .chain()
            .focus()
            .setHeading({ level: Number(nextValue.replace("h", "")) as 1 | 2 | 3 })
            .run();
        }}
        value={activeBlock}
      >
        <option value="paragraph">Tt</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <ToolbarDivider />
      <ToolbarActions actions={textActions} canWrite={canWrite} editor={editor} />
      <ToolbarDivider />
      <ToolbarActions actions={structureActions} canWrite={canWrite} editor={editor} />
      <ToolbarDivider />
      <ToolbarActions actions={historyActions} canWrite={canWrite} editor={editor} />
    </div>
  );
}

export function CardDescriptionEditor({
  canWrite,
  onChange,
  onRequestCancel,
  onRequestSave,
  value,
}: CardDescriptionEditorProps) {
  const [isEditorEmpty, setIsEditorEmpty] = useState(() => value.trim().length === 0);
  const saveRequestRef = useRef(onRequestSave);
  const cancelRequestRef = useRef(onRequestCancel);

  useEffect(() => {
    saveRequestRef.current = onRequestSave;
    cancelRequestRef.current = onRequestCancel;
  }, [onRequestCancel, onRequestSave]);

  const editor = useEditor({
    content: value.length > 0 ? value : "<p></p>",
    editable: canWrite,
    editorProps: {
      handleKeyDown: (_view, event) => {
        if (!canWrite) {
          return false;
        }

        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          saveRequestRef.current?.();
          return true;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          cancelRequestRef.current?.();
          return true;
        }
        return false;
      },
    },
    extensions: [StarterKit],
    immediatelyRender: false,
    onUpdate: ({ editor: activeEditor }) => {
      onChange(activeEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setEditable(canWrite);
  }, [canWrite, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const nextValue = value.length > 0 ? value : "<p></p>";
    if (editor.getHTML() !== nextValue) {
      editor.commands.setContent(nextValue, { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const syncEditorEmpty = () => {
      setIsEditorEmpty(editor.getText().trim().length === 0);
    };
    syncEditorEmpty();
    editor.on("update", syncEditorEmpty);
    editor.on("selectionUpdate", syncEditorEmpty);
    editor.on("focus", syncEditorEmpty);
    editor.on("blur", syncEditorEmpty);

    return () => {
      editor.off("update", syncEditorEmpty);
      editor.off("selectionUpdate", syncEditorEmpty);
      editor.off("focus", syncEditorEmpty);
      editor.off("blur", syncEditorEmpty);
    };
  }, [editor]);

  if (!editor) {
    return (
      <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3">
        <LoadingInline label="Đang tải trình soạn thảo..." />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-600 bg-[#22272f]">
      <RichToolbar canWrite={canWrite} editor={editor} />
      <div className="relative min-h-56">
        {isEditorEmpty ? (
          <p className="pointer-events-none absolute left-4 top-4 text-base text-slate-400">
            Cần trợ giúp về định dạng? Gõ /trợ giúp.
          </p>
        ) : null}
        <EditorContent
          className="px-4 py-4 text-base text-slate-100 [&_.ProseMirror]:min-h-52 [&_.ProseMirror]:leading-7 [&_.ProseMirror]:outline-none [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-slate-600 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-slate-900/60 [&_.ProseMirror_code]:px-1 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_p]:my-1.5 [&_.ProseMirror_pre]:rounded [&_.ProseMirror_pre]:bg-slate-950/65 [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5"
          editor={editor}
        />
      </div>
    </div>
  );
}
