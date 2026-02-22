"use client";

import type { ComponentProps } from "react";
import type { MouseEvent } from "react";
import { useRef } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "./button";

type SubmitButtonProps = ComponentProps<typeof Button> & {
  pendingLabel?: string;
};

export function SubmitButton({
  children,
  disabled,
  onClick,
  pendingLabel = "Saving...",
  type,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const clickLockRef = useRef(false);
  const isDisabled = Boolean(disabled || pending);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isDisabled || clickLockRef.current) {
      event.preventDefault();
      return;
    }

    clickLockRef.current = true;
    setTimeout(() => {
      clickLockRef.current = false;
    }, 700);

    onClick?.(event);
  };

  return (
    <Button
      aria-disabled={isDisabled}
      disabled={isDisabled}
      onClick={handleClick}
      type={type ?? "submit"}
      {...props}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
