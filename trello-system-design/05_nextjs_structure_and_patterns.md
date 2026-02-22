# 05 — Next.js Project Structure & Best Practices (App Router)

## 1) Core principles
- Server-first: dùng **Server Components** cho phần read/SSR, giảm JS bundle.
- Client Components chỉ cho phần cần tương tác mạnh (DnD, realtime).
- Tất cả mutation đi qua **Server Actions** để:
  - validate input (Zod)
  - enforce auth
  - gom transaction/reorder atomic
  - emit realtime event/audit log

## 2) Suggested project structure
Dùng `src/` để tránh lẫn config root.

```
src/
  app/
    (public)/
      page.tsx
    (auth)/
      login/
      signup/
      callback/
    (app)/
      w/[workspaceSlug]/
        layout.tsx
        page.tsx                # workspace overview
        boards/
          page.tsx
          new/
        board/[boardId]/
          page.tsx              # board view
  features/
    workspaces/
      queries.ts               # server-side reads
      actions.ts               # server actions (mutations)
      validators.ts            # zod schemas
      types.ts
    boards/
    lists/
    cards/
  components/
    ui/                        # design system (button, dialog)
    board/                     # kanban UI
  lib/
    supabase/
      server.ts
      client.ts
      middleware.ts
    auth/
    errors/
    logger/
  db/
    types.ts                   # generated types từ Supabase
  styles/
  tests/
```

**Rule:** folder `features/*` là “domain modules”, tránh để logic vương vãi trong UI.

## 3) Routing design
### MVP routes (gợi ý)
- `/login`, `/signup`
- `/w/{workspaceSlug}` — workspace home
- `/w/{workspaceSlug}/boards` — list boards
- `/w/{workspaceSlug}/board/{boardId}` — board page

### Product routes
- `/w/{workspaceSlug}/board/{boardId}/card/{cardId}` (modal via intercepting routes)
- `/settings/*`
- `/invite/{token}`

## 4) Data fetching
### 4.1 Server Components reads
- Query Supabase trong server component để render initial state.
- Board page: fetch lists + cards (2 queries hoặc 1 query với join/view tùy performance).

### 4.2 Caching strategy
- Public pages mới cache; app pages (per-user) default dynamic.
- Dùng tag/path revalidation khi hợp lý (vd danh sách boards).

## 5) Mutations with Server Actions
### 5.1 Action boundaries
- `createBoard`, `renameBoard`, `archiveBoard`
- `createList`, `reorderLists`
- `createCard`, `updateCard`, `moveCard`, `archiveCard`
- `inviteMember`, `acceptInvite`

### 5.2 Input validation
- Mỗi action có `zodSchema.parse(input)`
- Normalize text (trim, max length)
- Enforce invariants:
  - card phải thuộc board/list hợp lệ
  - member phải có role phù hợp

### 5.3 Atomic reorder
Reorder/move card nên là 1 transaction:
- update card.list_id + position
- (optional) bump versions
- insert activity log
- (optional) broadcast event

Nếu bạn muốn làm sạch hơn:
- viết Postgres RPC function `move_card(...)` và gọi từ server action.

## 6) Auth (Supabase SSR)
- Dùng Supabase Auth session lưu trong cookie.
- Next.js middleware:
  - refresh session
  - redirect unauthenticated user về /login cho route private

## 7) UI/UX best practices
- DnD: giới hạn hydration — chỉ hydrate board grid, còn header/sidebar vẫn server.
- Optimistic UI:
  - apply local move
  - send mutation
  - on fail: rollback or refetch
- Virtualization: nếu list có hàng ngàn cards, dùng windowing.

## 8) Error handling conventions
- AppError taxonomy:
  - `UNAUTHENTICATED` (401)
  - `FORBIDDEN` (403)
  - `NOT_FOUND` (404)
  - `CONFLICT` (409) — reorder version mismatch
  - `VALIDATION_ERROR` (422)
  - `INTERNAL` (500)
- UI map:
  - 401 → redirect login
  - 403 → show “no access”
  - 409 → refresh data + toast
