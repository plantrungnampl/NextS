# 01 — Overview & Scope

## 1) Mục tiêu sản phẩm
Xây một ứng dụng kiểu Trello:
- Người dùng có **Workspace** (team/tenant)
- Workspace có nhiều **Board**
- Board có nhiều **List** (column)
- List có nhiều **Card**
- Hỗ trợ kéo-thả (drag & drop) để:
  - Reorder list trong board
  - Reorder card trong list
  - Move card giữa các list

Sản phẩm cần:
- Multi-tenant isolation (không leak data giữa workspace)
- Quyền (role) rõ ràng
- Tương tác nhanh (board là UI “sống”)
- Có lộ trình nâng cấp lên product-grade (realtime, comment, label, checklist, attachment, audit log…)

## 2) Assumptions (giả định để thiết kế)
- Định danh tenant theo **workspace_id** (UUID)
- Routing tenancy dùng path: `/w/{workspaceSlug}/...`
  - Dễ SEO, dễ deploy, không cần cấu hình wildcard DNS như subdomain
  - Có thể nâng cấp subdomain về sau
- Auth MVP: email/password hoặc magic link (Supabase Auth)
- “Public share board” là tính năng product (không bắt buộc MVP)
- Tập trung vào web app (desktop-first); mobile UX tối ưu sau

## 3) Glossary (thuật ngữ)
- **Tenant**: 1 workspace (team)
- **Member**: user thuộc workspace (role owner/admin/member)
- **Board**: không gian làm việc dạng Kanban
- **List**: cột trên board
- **Card**: task/item
- **Ordering**: thứ tự list/card
- **RLS**: Row Level Security của Postgres, enforce quyền trên từng dòng

## 4) Success metrics (đề xuất)
MVP:
- Time-to-first-board < 2 phút từ lúc sign up
- DnD reorder/move card latency cảm nhận < 150–250ms (optimistic UI)
- Không có bug “thấy dữ liệu workspace khác”

Product:
- Realtime sync: P95 event propagation < 300ms
- Ít conflict reorder khi nhiều người kéo cùng lúc
- Audit log đầy đủ để debug “ai làm gì”
