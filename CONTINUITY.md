Goal (incl. success criteria):
- Standardize `Gắn sao` UI/UX between board topbar and `...` menu using Trello-like visual semantics.
- Success criteria:
  - Topbar star active state uses amber fill + subtle active surface (not heavy purple block).
  - Menu `Gắn sao` uses star state + subtitle `Đã gắn sao`, without green check trailing.
  - Tooltip text is short one line and keeps non-clipping overlay behavior.
  - Favorite state remains synced through shared TanStack Query key.
  - Lint/build pass.

Constraints/Assumptions:
- TanStack Query remains main client state layer.
- Canonical implementation only (no duplicate legacy share paths).
- Existing board share flow remains intact and now supports controlled open state from `...` menu.

Key decisions:
- `...` menu renders full Trello-like list; only core actions are functional in this phase.
- Visibility in `...` opens inline submenu.
- Non-core items stay disabled with `Sắp có`.
- `Members` button remains unchanged.
- Core settings are inline (non-redirect) actions for rename/archive board.

State:
- Completed: `Gắn sao` topbar + menu visual standardization implemented and verified.

Done:
- Queried Graphiti for latest UI/UX and board header context before changes.
- Implemented new server action `actions.visibility.inline.ts`:
  - zod-validated payload
  - write access check via `resolveBoardAccess(..., { requiredPermission: "write" })`
  - board visibility update + activity event + revalidatePath
- Added shared client query key in `_components/board-visibility-query.ts`.
- Added `BoardHeroVisibilityButton` popover UI:
  - Members icon trigger
  - panel title `Khả năng xem`
  - options: `Riêng tư`, `Không gian làm việc`, `Công khai`, disabled `Tổ chức`
  - immediate save with optimistic TanStack Query update and rollback on error
  - read-only note for non-writable users
- Added `BoardHeroVisibilityControls` to bind Members trigger + reactive visibility badge from a single TanStack Query key.
- Wired board topbar:
  - replaced static Members tooltip icon with visibility controls
  - removed old static visibility badge and switched to reactive badge
- Re-validated:
  - `cd /Data/NextS/nexts-app && npm run lint -- --quiet` (pass)
  - `cd /Data/NextS/nexts-app && npm run build` (pass)
- Improved topbar visual hierarchy in `board-hero.tsx`:
  - grouped controls into a rounded action cluster
  - added safer responsive spacing and horizontal overflow handling
  - refined topbar background/contrast for clearer action focus
- Fixed tooltip UX in topbar icon system:
  - removed hardcoded width/whitespace from shared tooltip base class in `board-hero-toolbar-icon-button.tsx`
  - set explicit nowrap behavior only for short icon tooltips
- Fixed favorite tooltip readability in `board-hero-favorite-button.tsx`:
  - rewritten copy to shorter, clearer Vietnamese text
  - responsive width + word wrapping to prevent vertical stacked words
- Fixed hover tooltip regression after topbar polish:
  - removed clipping behavior by replacing action container `overflow-x-auto` with wrapping layout in `board-hero.tsx`
  - restored tooltip visibility on hover for topbar icon buttons
- Applied migration to Supabase: `board_share_acl` (success).
- Fixed runtime issue "Không thể tải dữ liệu chia sẻ bảng":
  - Refactored `resolveBoardShareAccess` in `actions.board-share.ts` to use explicit auth + board/workspace checks + RPC (`can_read_board`, `can_manage_board_access`) instead of redirect-based `resolveBoardAccess`.
  - Replaced embedded `profiles(...)` fetch from `board_members` with 2-step fetch (`board_members` then `profiles` by ids) and safe mapping.
- Re-validated:
  - `cd /Data/NextS/nexts-app && npm run lint -- --quiet` (pass)
  - `cd /Data/NextS/nexts-app && npm run build` (pass)
- Added reusable favorite query state helper in `_components/board-favorite-query.ts` and refactored `BoardHeroFavoriteButton` to use canonical query key.
- Added inline settings server actions in `actions.board-settings.inline.ts`:
  - `renameBoardInline`
  - `archiveBoardInline`
- Refactored `BoardShareDialog` to support controlled mode:
  - optional `open`, `onOpenChange`, `hideTrigger`
  - backward-compatible uncontrolled behavior remains.
- Implemented `BoardHeroMoreMenu` Trello-like panel with portal popover:
  - root menu + `Khả năng hiển thị` submenu + `Cài đặt` submenu
  - functional actions: `Chia sẻ`, visibility update, favorite toggle, rename, archive
  - non-core rows disabled with `Sắp có`
  - viewer sees submenus in read-only mode (mutations disabled)
- Wired `BoardHeroMoreMenu` into `board-hero.tsx`, replacing static `More options` button while keeping `Members` and topbar `Chia sẻ` intact.
- Extracted menu view layer to `_components/board-hero-more-menu.views.tsx` to satisfy lint constraints and keep maintainable split between behavior and presentation.
- Re-validated after final wiring:
  - `cd /Data/NextS/nexts-app && npm run lint -- --quiet` (pass)
  - `cd /Data/NextS/nexts-app && npm run build` (pass)
- Applied scoped menu scrollbar customization:
  - Added `board-menu-scroll` class to the `...` menu scroll host in `board-hero-more-menu.tsx`.
  - Added dedicated dark/cyan scrollbar styles for `.board-menu-scroll` in `src/app/globals.css`.
- Re-validated after scrollbar customization:
  - `cd /Data/NextS/nexts-app && npm run lint -- --quiet` (pass)
  - `cd /Data/NextS/nexts-app && npm run build` (pass)
- Polished `BoardHeroFavoriteButton` UX:
  - short one-line tooltip copy
  - `aria-label` state text: `Gắn sao bảng` / `Bỏ gắn sao bảng`
  - `aria-busy` + pending visual feedback
  - active icon/surface switched to Trello-like amber + subtle surface.
- Standardized `Gắn sao` row in more-menu:
  - removed trailing green check
  - active state now shown with filled amber star + subtitle `Đã gắn sao`
  - added local semantic class constants for active/inactive icon and active surface.
- Re-validated after star UX polish:
  - `cd /Data/NextS/nexts-app && npm run lint -- --quiet` (pass)
  - `cd /Data/NextS/nexts-app && npm run build` (pass)

Now:
- Star UX implementation complete; waiting for in-browser visual confirmation.

Next:
- Fine-tune star contrast/spacing if user asks for tighter Trello parity.

Open questions (UNCONFIRMED if needed):
- None for current implementation scope.

Working set (files/ids/commands):
- `CONTINUITY.md`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-hero.tsx`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-hero-more-menu.tsx`
- `nexts-app/src/app/globals.css`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-hero-more-menu.views.tsx`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-hero-favorite-button.tsx`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-favorite-query.ts`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/actions.board-settings.inline.ts`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-share-dialog.tsx`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-hero-toolbar-icon-button.tsx`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-hero-favorite-button.tsx`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/actions.visibility.inline.ts`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-visibility-query.ts`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-hero-visibility-button.tsx`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-hero-visibility-controls.tsx`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-hero-more-menu.tsx`
- `cd /Data/NextS/nexts-app && npm run lint -- --quiet`
- `cd /Data/NextS/nexts-app && npm run build`
