# Trello-like Board — System Design (Next.js latest + Supabase)

Tài liệu này là **bản thiết kế / system design** cho một sản phẩm kiểu Trello (Kanban board), dùng:

- **Next.js (App Router, latest)** làm core web/app
- **Supabase** làm backend: Auth + Postgres + RLS + Realtime + Storage

> Không có code triển khai chi tiết. Tập trung vào kiến trúc, dữ liệu, luồng, best practices, và roadmap từ MVP → Product.

## Mục lục files

1. `01_overview_and_scope.md` — Phạm vi, giả định, glossary
2. `02_mvp_to_product.md` — MVP → Product roadmap (functional + non-functional)
3. `03_architecture.md` — Kiến trúc tổng thể + luồng request/mutation + diagram
4. `04_data_model_supabase.md` — Schema dữ liệu, multi-tenant, ordering, RLS, index
5. `05_nextjs_structure_and_patterns.md` — Cấu trúc project Next.js, patterns (Server Components/Actions, caching, auth)
6. `06_realtime_collaboration.md` — Realtime, presence, conflict resolution
7. `07_devops_testing_observability.md` — CI/CD, testing, monitoring, backup, vận hành
8. `08_roadmap.md` — Roadmap ưu tiên + milestones + rủi ro

## Quick decisions (tóm tắt)
- Multi-tenant theo **workspace** (tenant key: `workspace_id`)
- Board thuộc workspace; list thuộc board; card thuộc list (và denormalize `board_id`)
- Thứ tự list/card dùng **fractional indexing** (position numeric + renormalize khi cần)
- Quyền truy cập enforce bằng **Postgres RLS** (không dựa vào “frontend hides button”)
- Mutations qua **Server Actions** (có validate + atomic transaction/RPC khi reorder)
- Realtime giai đoạn đầu có thể dùng Postgres Changes, nhưng production nên ưu tiên **Broadcast events + Presence**
