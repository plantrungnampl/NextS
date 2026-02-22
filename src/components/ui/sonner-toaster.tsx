"use client";

import { Toaster } from "sonner";

export function SonnerToaster() {
  return (
    <Toaster
      closeButton
      richColors
      position="bottom-right"
      toastOptions={{
        classNames: {
          description: "!text-slate-200",
          toast: "!border !border-slate-700 !bg-[#111827] !text-slate-100",
          title: "!text-slate-100",
        },
      }}
    />
  );
}
