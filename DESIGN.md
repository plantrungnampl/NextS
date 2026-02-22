# Trello Board Canonical Design (Merged from V1 + V2)

## 1) Mục tiêu và phạm vi
- Xây Trello-like board theo hướng production-grade, multi-tenant, realtime collaboration.
- Dùng `Next.js App Router` + `Supabase` làm kiến trúc chuẩn, tránh tách microservices sớm.
- Tài liệu này là **single source of truth** cho implementation trong repo hiện tại.

## 2) Decision Matrix: lấy tốt nhất từ 2 bản

| Chủ đề | V1 (modular) | V2 (`DESIGN_V2.md`) | Quyết định canonical |
|---|---|---|---|
| Core architecture | Next.js BFF + Supabase (Auth/DB/RLS/Realtime/Storage) | Microservices + API Gateway + Socket cluster | Giữ V1 làm chuẩn; chỉ tách service khi có tín hiệu scale rõ ràng |
| Tenancy & auth | Workspace tenant, role rõ | Scope rộng hơn (board members, observer) | Giữ workspace-tenant + role `owner/admin/member`; `observer` là product option |
| Data model | Gọn, đúng Supabase + RLS, có `version`, `activity_events` | Rất đầy đủ (labels/checklist/attachments/notifications) | Giữ lõi V1, nhập entity richness từ V2 theo phase |
| Ordering | Fractional indexing + renormalize + optimistic lock | Fractional indexing step `65535`, thuật toán rõ | Dùng `numeric` + step `65535` + renormalize trong transaction |
| Realtime | Broadcast + Presence (khuyến nghị), DB source of truth | Event contracts chi tiết + flow rõ | Giữ kiến trúc V1, lấy event contract/flow từ V2 |
| Drag-drop | Nguyên tắc optimistic + rollback | Flow end-to-end chi tiết | Áp dụng flow V2 cho implementation chuẩn |
| Caching | Dynamic by user, revalidate hợp lý | Redis layers + invalidation flow | Phase 1: Next.js + React Query cache; Phase 2: thêm Redis cho hot-path |
| Search | Nêu requirement mức product | Elasticsearch integration chi tiết | Phase 1: Postgres FTS/trigram; Phase 2: OpenSearch/Elastic khi cần |
| File upload | Supabase Storage + RLS path | Pre-signed URL flow | Dùng Supabase signed upload URL + path policy theo workspace/board/card |
| Security/Observability | RLS-first, test policy, monitoring cơ bản | Checklist security + metrics/alerts chi tiết | Merge cả hai: RLS-first + security hardening + SLO/alerts rõ |
| Roadmap | MVP → Product rõ, thực dụng | Scope lớn, nhiều module enterprise | Dùng roadmap V1 làm xương sống, chèn module mạnh của V2 vào phase phù hợp |

## 3) Functional scope theo phase

### Phase 0: Foundation
- Auth, profile, workspace, workspace membership.
- Board/List/Card CRUD cơ bản.
- `RLS` đầy đủ cho tất cả bảng private.
- Activity log tối thiểu cho mutation chính.

### Phase 1: MVP usable
- Drag & drop: reorder list, reorder/move card.
- Optimistic UI + rollback + conflict handling (`409`).
- Realtime tối thiểu cho board (card/list changes).
- E2E happy path đầy đủ.

### Phase 2: Product v1
- Comments, labels, assignees, attachments, due date.
- Presence + notification in-app.
- Search trong workspace.
- Board-level permission (private board trong workspace).

### Phase 3: Scale/Enterprise
- Automation, templates, public sharing, webhook/API keys.
- SSO/SCIM (nếu B2B).
- Advanced analytics, retention/export policies.

## 4) Non-functional targets (thực tế cho production)
- Board initial load p95: `< 2s` (mạng bình thường, data vừa).
- Mutation ack p95: `< 250ms` (cảm nhận mượt với optimistic UI).
- Realtime propagation p95: `< 300ms`.
- Availability mục tiêu: `99.9%`.
- Không có cross-tenant data leak (RLS test bắt buộc).
- Với board lớn: virtualization + incremental loading để giữ UX ổn định.

## 5) Kiến trúc canonical

### 5.1 Runtime architecture
- `Browser` ↔ `Next.js App Router` (SSR/RSC + Server Actions + Route Handlers).
- `Next.js` ↔ `Supabase` cho: Auth session (cookie-based SSR), Postgres + RLS, Realtime (Broadcast + Presence), Storage (attachments), Edge Functions/cron cho async tasks.

### 5.2 Nguyên tắc kiến trúc
- DB là source of truth.
- Mọi mutation qua server-side boundary (Server Action/Route Handler), không mutate trực tiếp từ client.
- Business invariants kiểm tra upfront: input validation, authz, tenancy.
- Không dùng service role cho request user path.

### 5.3 Khi nào mới tách microservices
- Chỉ tách khi có metric chứng minh và xuất hiện ít nhất một tín hiệu sau.
- Team boundary rõ (nhiều team độc lập theo domain).
- Bottleneck compute/throughput cụ thể.
- SLA domain khác nhau cần scale độc lập.

## 6) Data model (canonical)

### 6.1 Core entities
- `profiles(id, display_name, avatar_url, ...)`
- `workspaces(id, slug, name, created_by, ...)`
- `workspace_members(workspace_id, user_id, role)` PK `(workspace_id, user_id)`
- `boards(id, workspace_id, name, visibility, archived_at, created_by, ...)`
- `lists(id, board_id, title, position, archived_at, ...)`
- `cards(id, board_id, list_id, title, description, position, due_at, version, archived_at, ...)`
- `activity_events(id, workspace_id, board_id, actor_id, entity_type, entity_id, action, metadata, created_at)`

### 6.2 Product entities (bật theo phase)
- `labels`, `card_labels`
- `card_comments`
- `card_assignees`
- `attachments`
- `checklists`, `checklist_items`
- `notifications`

### 6.3 Data invariants
- Mọi row private phải suy ra được `workspace_id`.
- `cards.board_id` denormalized để query/realtime/filter nhanh.
- Soft delete dùng `archived_at` thay vì hard delete cho domain chính.
- `activity_events` append-only (immutable log).

## 7) RLS strategy (bắt buộc)
- Enable RLS cho toàn bộ bảng domain private.
- Policy dựa trên workspace membership và role.
- Helper functions chuẩn: `is_workspace_member(workspace_id)`, `is_workspace_admin(workspace_id)`.
- Nếu cần, thêm helper `board_workspace_id(board_id)` để policy gọn hơn.
- Storage path chuẩn: `{workspaceId}/{boardId}/{cardId}/{fileId}` và policy dựa trên membership.

## 8) Ordering + concurrency chuẩn

### 8.1 Fractional indexing
- Dùng `position numeric`.
- Khoảng bước mặc định: `65535`.
- Insert giữa 2 item: `(prev + next) / 2`.
- Đặt cuối danh sách: `last + 65535`.

### 8.2 Conflict handling
- Dùng `cards.version` (optimistic lock).
- Update/move với điều kiện `expectedVersion`.
- Mismatch trả `409 CONFLICT`, client refetch snapshot.

### 8.3 Renormalize
- Trigger khi khoảng cách position dưới threshold.
- Reassign theo bội số `65535` trong **một transaction** để tránh jump order.

## 9) Realtime & collaboration

### 9.1 Realtime approach
- MVP: Supabase Broadcast/Postgres Changes (ưu tiên Broadcast cho domain events).
- Product: Presence + typed domain event contract.

### 9.2 Event envelope chuẩn
```json
{
  "type": "card_moved",
  "workspaceId": "uuid",
  "boardId": "uuid",
  "actorId": "uuid",
  "payload": {},
  "version": 12,
  "eventId": "uuid",
  "ts": "2026-02-16T00:00:00Z"
}
```

### 9.3 Event types ưu tiên
- `list_created`, `list_updated`, `list_reordered`
- `card_created`, `card_updated`, `card_moved`, `card_archived`
- `comment_added`, `attachment_added`, `label_toggled` (phase product)
- `presence_joined`, `presence_left`

## 10) Drag & drop flow (canonical)
1. Client `onDragEnd` tính `newPosition`.
2. Optimistic update local state.
3. Gọi mutation server (`moveCard`/`reorderLists`).
4. Server validate + authz + transaction + activity log + emit event.
5. Thành công: nhận canonical state.
6. Thất bại: rollback + toast + refetch nếu cần.

## 11) API/Action surface

### 11.1 Server Actions chính
- `createBoard`, `renameBoard`, `archiveBoard`
- `createList`, `updateList`, `reorderLists`
- `createCard`, `updateCard`, `moveCard`, `archiveCard`
- `inviteMember`, `updateMemberRole`, `removeMember`

### 11.2 Route Handlers dùng cho
- Webhook/callback từ external integrations.
- Upload handshake (signed URL), download signed access.
- Health endpoints, diagnostics.

## 12) Caching strategy

### 12.1 Phase 1 (đủ tốt)
- Server pages private: dynamic by user/workspace.
- `revalidateTag`/`revalidatePath` cho views aggregate (boards list).
- Client cache: TanStack Query (`staleTime` ngắn cho board data).

### 12.2 Phase 2 (scale)
- Redis cho permission snapshot cache (short TTL).
- Redis cho rate limiting counters.
- Redis cho presence auxiliary state.
- Cache invalidation: write-through + event-driven invalidation.

## 13) Search, upload, notifications

### 13.1 Search
- Phase 1: Postgres `tsvector` + trigram indexes.
- Phase 2: OpenSearch/Elasticsearch nếu query phức tạp hoặc volume lớn.

### 13.2 Upload
- Signed upload URL (Supabase Storage).
- Validate MIME/size trước khi cấp URL.
- Object private; read qua signed URL có expiry.

### 13.3 Notifications
- In-app realtime notifications cho events quan trọng.
- Email async qua queue/edge functions (invite, mention, due-soon).
- User preference matrix theo channel (`in_app`, `email`, `push` optional).

## 14) Security baseline
- AuthN qua Supabase Auth (session cookies).
- AuthZ bằng RLS + role checks trong mutation boundary.
- Input validation bằng Zod, sanitize rich-text input.
- Rate limiting cho login/invite/mutation hot endpoints.
- CSP + secure headers + strict CORS.
- Secrets chỉ qua env store, không commit.
- Audit log cho mutation quan trọng.

## 15) Testing & observability

### 15.1 Testing
- Unit: position utils, validators, policy helpers.
- Integration: RLS policies, transaction/RPC atomicity.
- E2E: signup → workspace → board/list/card → dnd → reload consistency.

### 15.2 Metrics/alerts
- API latency p50/p95/p99, mutation success/fail rate.
- Realtime lag, reconnection spike.
- DB slow query, connection pool usage.
- Alert gợi ý: Critical khi error rate > 5% hoặc DB pool exhausted.
- Alert gợi ý: Warning khi p95 > 500ms trong 10 phút.

## 16) Deployment topology
- Next.js deploy trên Vercel (hoặc Node runtime tương đương).
- Supabase region gần app runtime.
- Migrations qua Supabase CLI, review SQL trong PR.
- Preview per PR + staging + production approval gate.

## 17) Roadmap thực thi đề xuất
- Milestone 0 (1-3 ngày): foundation + auth + schema + RLS base.
- Milestone 1 (3-7 ngày): MVP board + dnd + activity + e2e.
- Milestone 2 (1-2 tuần): realtime + presence + conflict handling.
- Milestone 3 (2-4 tuần): comments/labels/attachments/search.
- Milestone 4 (ongoing): hardening, scaling, security, observability.

## 18) Open decisions (UNCONFIRMED)
- UNCONFIRMED: có bật role `observer` ngay MVP hay để phase product.
- UNCONFIRMED: chọn Postgres Changes hay Broadcast làm realtime mặc định ở MVP.
- UNCONFIRMED: ngưỡng board size cụ thể để bật virtualization + partial loading mặc định.
