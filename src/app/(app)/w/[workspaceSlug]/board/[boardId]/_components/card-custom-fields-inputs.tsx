"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui";

import { CARD_PRIORITY_ITEMS, CARD_STATUS_ITEMS } from "../card-custom-fields";

const customFieldSelectClass =
  "h-10 w-full rounded-md border border-slate-700 bg-[#36373c] px-3 text-sm text-slate-100 outline-none transition focus:border-slate-500";

function StatusDropdown({
  disabled,
  onValueChange,
  value,
}: {
  disabled: boolean;
  onValueChange: (nextValue: string) => void;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const activeOption = CARD_STATUS_ITEMS.find((option) => option.value === value);

  return (
    <Popover onOpenChange={setOpen} open={disabled ? false : open}>
      <PopoverTrigger asChild>
        <button
          className={`${customFieldSelectClass} flex items-center justify-between text-left ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          disabled={disabled}
          type="button"
        >
          <span className="truncate">{activeOption?.label ?? "Chọn..."}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] border-slate-600 bg-[#33363d] p-1"
      >
        <div className="space-y-1">
          {CARD_STATUS_ITEMS.map((option) => (
            <button
              className={`flex h-8 w-full items-center rounded-md px-2 text-left text-sm text-slate-100 transition ${
                option.value === value ? "bg-[#1d4ed8]" : "hover:bg-white/10"
              }`}
              key={option.value}
              onClick={() => {
                onValueChange(option.value);
                setOpen(false);
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PriorityDropdown({
  disabled,
  onValueChange,
  value,
}: {
  disabled: boolean;
  onValueChange: (nextValue: string) => void;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const activeOption = CARD_PRIORITY_ITEMS.find((option) => option.value === value);
  const triggerLabel = value.length > 0 ? activeOption?.label : "Chọn...";

  return (
    <Popover onOpenChange={setOpen} open={disabled ? false : open}>
      <PopoverTrigger asChild>
        <button
          className={`${customFieldSelectClass} flex items-center justify-between text-left ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          disabled={disabled}
          type="button"
        >
          <span className="truncate">{triggerLabel ?? "Chọn..."}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] border-slate-600 bg-[#33363d] p-1"
      >
        <div className="space-y-1">
          {CARD_PRIORITY_ITEMS.map((option) => (
            <button
              className={`flex h-8 w-full items-center rounded-md px-2 text-left text-sm text-slate-100 transition ${
                option.value === value ? "bg-[#1d4ed8]" : "hover:bg-white/10"
              }`}
              key={`${option.value || "none"}:${option.label}`}
              onClick={() => {
                onValueChange(option.value);
                setOpen(false);
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CardCustomFieldsInputs({
  canWrite,
  effort,
  isEditing,
  onEffortChange,
  onPriorityChange,
  onStatusChange,
  priority,
  status,
}: {
  canWrite: boolean;
  effort: string;
  isEditing: boolean;
  onEffortChange: (nextValue: string) => void;
  onPriorityChange: (nextValue: string) => void;
  onStatusChange: (nextValue: string) => void;
  priority: string;
  status: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <label className="space-y-1">
        <span className="text-sm text-slate-300">Priority</span>
        <PriorityDropdown
          disabled={!isEditing || !canWrite}
          onValueChange={onPriorityChange}
          value={priority}
        />
      </label>
      <label className="space-y-1">
        <span className="text-sm text-slate-300">Status</span>
        <StatusDropdown
          disabled={!canWrite}
          onValueChange={onStatusChange}
          value={status}
        />
      </label>
      <label className="space-y-1">
        <span className="text-sm text-slate-300">Effort</span>
        <input
          className={customFieldSelectClass}
          disabled={!isEditing || !canWrite}
          onChange={(event) => {
            onEffortChange(event.target.value);
          }}
          placeholder="Thêm Effort..."
          type="text"
          value={effort}
        />
      </label>
    </div>
  );
}
