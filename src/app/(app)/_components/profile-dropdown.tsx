"use client";

import { UserButton } from "@clerk/nextjs";

export function ProfileDropdown({ email: _email }: { email: string | undefined }) {
  return (
    <div className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-slate-600 bg-slate-700/60">
      <UserButton
        afterSignOutUrl="/login"
        appearance={{
          elements: {
            avatarBox: "h-8 w-8",
            userButtonTrigger: "h-8 w-8 rounded-full border-0 p-0",
          },
        }}
      />
    </div>
  );
}
