"use client";

import { type ReactNode, useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui";

export function useMobileSheetBreakpoint() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const sync = () => {
      setIsMobile(mediaQuery.matches);
    };
    sync();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", sync);
      return () => {
        mediaQuery.removeEventListener("change", sync);
      };
    }

    mediaQuery.addListener(sync);
    return () => {
      mediaQuery.removeListener(sync);
    };
  }, []);

  return isMobile;
}

export function CardModalContainer({
  cardTitle,
  children,
  isMobile,
  isOpen,
  onClose,
}: {
  cardTitle: string;
  children: ReactNode;
  isMobile: boolean;
  isOpen: boolean;
  onClose: () => void;
}) {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  if (isMobile) {
    return (
      <Sheet onOpenChange={handleOpenChange} open={isOpen}>
        <SheetContent
          className="h-[min(94dvh,920px)] w-full overflow-hidden border-t border-slate-600/70 bg-[#2a2b31] text-slate-100 shadow-[0_-20px_60px_rgba(15,23,42,0.5)]"
          side="bottom"
        >
          <SheetTitle className="sr-only">{`Card details: ${cardTitle}`}</SheetTitle>
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={isOpen}>
      <DialogContent className="h-[min(88vh,760px)] w-[min(96vw,860px)] overflow-hidden border border-slate-600/70 bg-[#2a2b31] p-0 text-slate-100 shadow-[0_20px_70px_rgba(15,23,42,0.55)]">
        <DialogTitle className="sr-only">{`Card details: ${cardTitle}`}</DialogTitle>
        <DialogDescription className="sr-only">
          Xem và chỉnh sửa chi tiết thẻ, bao gồm mô tả, ngày, checklist, thành viên và hoạt động.
        </DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
