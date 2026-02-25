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
---
Goal (incl. success criteria):
- Implement Trello-like Board Filters in board topbar with real filtering on canvas and URL-persisted state.
- Success criteria:
  - Clicking `Board filters` opens full Vietnamese filter panel.
  - Filters apply live to board cards/lists with `Khớp bất kỳ` / `Khớp tất cả` behavior.
  - Filter state persists via URL params (`bf_*`) across reload.
  - Drag and drop is disabled while filters are active, without blocking general board interactions.
  - Lint/build pass and dedicated E2E spec for filter panel exists.

Constraints/Assumptions:
- No new dependency.
- Keep App Router + current board visual style.
- Existing query params (`c`, `view`, `views`) remain intact.

Key decisions:
- Added canonical filter domain in `_components/board-filters.ts`.
- Added shared location change utility in `_components/board-location-change.ts`.
- Replaced tooltip-only filter icon with functional `BoardHeroFiltersButton` popover.
- Applied filtering on render list set only; kept snapshot/mutation source lists canonical.
- Introduced separate locks:
  - pointer lock for card modal state
  - drag lock for card modal OR active filters.
- Added `CardRecord.updated_at` for activity-based buckets.

State:
- Completed: board filters implementation + validation done.

Done:
- Queried Graphiti before implementation for board hero/canvas context.
- Added new files:
  - `/Data/NextS/nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-filters.ts`
  - `/Data/NextS/nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-location-change.ts`
  - `/Data/NextS/nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-hero-filters-button.tsx`
  - `/Data/NextS/nexts-app/e2e/board-filters-panel.spec.ts`
- Wired filter button into board hero and page data flow.
- Extended card model/data pipeline with `updated_at`:
  - `data.ts`, `data.snapshot.ts`, `data.private-inbox-api.ts`, mutation cache fallback card creation.
- Applied filters into board canvas render path with URL sync and active-filter drag lock notice.
- Validation:
  - `cd /Data/NextS/nexts-app && npm run lint -- --quiet` (pass)
  - `cd /Data/NextS/nexts-app && npm run build` (pass)
  - `cd /Data/NextS/nexts-app && npm run test:e2e -- e2e/board-filters-panel.spec.ts` (pass, test skipped due missing E2E creds)

Now:
- Waiting for visual QA and behavior confirmation on real board data.

Next:
- If requested, extend E2E assertions for members/labels/due/activity buckets and match mode permutations.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- `/Data/NextS/nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-filters.ts`
- `/Data/NextS/nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-location-change.ts`
- `/Data/NextS/nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-hero-filters-button.tsx`
- `/Data/NextS/nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-hero.tsx`
- `/Data/NextS/nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/page.tsx`
- `/Data/NextS/nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-dnd-canvas.tsx`
- `/Data/NextS/nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-dnd-canvas-layout.tsx`
- `/Data/NextS/nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-dnd-layout.tsx`
- `/Data/NextS/nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/types.ts`
- `/Data/NextS/nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/data.ts`
- `/Data/NextS/nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/data.snapshot.ts`
- `/Data/NextS/nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/data.private-inbox-api.ts`
- `/Data/NextS/nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-mutations/cache.ts`
- `/Data/NextS/nexts-app/e2e/board-filters-panel.spec.ts`
---
Goal (incl. success criteria):
- Implement Trello-like card template flow parity: toggle template in card menu, show template banner in modal, show template badge on front card, and persist in DB.
- Success criteria:
  - `Tạo mẫu` is functional (not disabled) and persists after reload.
  - Modal shows `Đây là thẻ mẫu.` with CTA `Tạo thẻ từ mẫu`.
  - Front card shows badge `Thẻ này là một mẫu.`.
  - Copying from template creates a normal card (`is_template = false`).
  - Lint/build pass.

Constraints/Assumptions:
- No new dependency.
- Keep existing card copy flow and open the existing copy panel from template CTA.
- Preserve existing optimistic board/card mutation patterns.

Key decisions:
- Persistence is DB-backed via new `cards.is_template` column.
- `Tạo thẻ từ mẫu` reuses existing `Sao chép thẻ` panel.
- Copied cards always insert with `is_template = false`.

State:
- Completed: card template flow implemented and validated.

Done:
- Added migration `supabase/migrations/20260223193000_card_templates.sql`:
  - `cards.is_template boolean not null default false`
  - partial index `cards_is_template_idx`
- Extended board card model and loaders:
  - `types.ts` adds `CardRecord.is_template`
  - `data.ts` loads `id,is_template` with missing-column fallback to `false`
- Added server action in `actions.card-advanced.ts`:
  - `toggleCardTemplateInline(formData)`
  - write-access guard + activity log `template.toggle`
- Ensured template-copy behavior:
  - copy insert explicitly sets `is_template: false`
- Wired UI behavior:
  - `card-header-options-menu.tsx`: `Tạo mẫu` now toggles state with check indicator
  - `card-richness-panel.tsx`: template banner + CTA
  - `card-richness-modern-ui.tsx`: pass `openCopyRequestToken` to header menu
  - `card-header-options-menu.tsx`: supports external copy-panel open trigger
  - `card-summary-content.tsx`: template badge on front card
- Synced optimistic defaults:
  - `board-dnd-helpers.ts`: optimistic copied card `is_template: false`
  - `board-mutations/cache.ts`: inline-created card `is_template: false`
  - patch types extended to include `is_template`
- Validation:
  - `cd /Data/NextS/nexts-app && npm run lint -- --quiet` (pass)
  - `cd /Data/NextS/nexts-app && npm run build` (pass)

Now:
- Implementation complete and ready for user verification in-browser.

Next:
- Optional: add/extend E2E coverage for template toggle + banner + copy-from-template flow.

Open questions (UNCONFIRMED if needed):
- None.

Working set (files/ids/commands):
- `nexts-app/supabase/migrations/20260223193000_card_templates.sql`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/types.ts`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/data.ts`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/actions.card-advanced.ts`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/card-header-options-menu.tsx`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/card-richness-modern-ui.tsx`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/card-richness-panel.tsx`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/card-summary-content.tsx`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-dnd-helpers.ts`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/board-mutations/cache.ts`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/sortable-list-card.tsx`
- `nexts-app/src/app/(app)/w/[workspaceSlug]/board/[boardId]/_components/card-richness-custom-fields-section.tsx`
- `cd /Data/NextS/nexts-app && npm run lint -- --quiet`
- `cd /Data/NextS/nexts-app && npm run build`
