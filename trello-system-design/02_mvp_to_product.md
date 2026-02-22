# 02 — MVP → Product (Requirements)

## 1) MVP (tối thiểu nhưng dùng được)
### 1.1 Functional requirements
**Auth & Identity**
- Sign up / login / logout
- Profile cơ bản: name, avatar

**Workspace**
- Tạo workspace (name + slug)
- Danh sách workspaces của user
- Role trong workspace: `owner`, `admin`, `member`
- Invite member bằng email (tối thiểu: tạo invite record + gửi email; hoặc MVP chỉ tạo invite link/token)

**Board**
- CRUD board trong workspace
- Archive board (soft delete)

**List**
- CRUD list trong board
- Reorder list (drag & drop)
- Archive list

**Card**
- CRUD card trong list
- Card fields MVP: `title`, `description` (optional), `due_at` (optional)
- Reorder trong list
- Move card giữa list
- Archive card

**Permissions**
- Workspace member mới xem/đổi dữ liệu thuộc workspace
- Owner/Admin mới được mời người khác, đổi role, xóa workspace/board

### 1.2 UX scope cho MVP
- Board page:
  - Load board + lists + cards
  - DnD mượt, optimistic update
  - Hiển thị lỗi nhẹ nhàng nếu save fail (rollback)
- Không cần: comment, label, checklist, attachment (để product)

### 1.3 MVP non-functional requirements
- Data isolation: enforce bằng RLS
- Audit tối thiểu: activity log cho create/update/move
- Performance: board load 1–2s trên mạng bình thường
- Reliability: reorder phải atomic (không “mất card”)

---

## 2) Product (v1) — dùng cho team thật
### 2.1 Collaboration
- **Realtime updates**: người khác kéo card là mình thấy
- Presence: ai đang online trong board
- Cursor/selection (optional)

### 2.2 Card richness
- Comments + mentions
- Labels + filters
- Checklists
- Attachments (Supabase Storage)
- Assignees
- Due date reminders

### 2.3 Governance & org
- Board-level permission (private board trong workspace)
- Invites: trạng thái pending/accepted/expired; resend
- Activity log đầy đủ + export

### 2.4 Quality
- Search trong workspace (cards/boards)
- Better notifications (in-app + email digest)
- Mobile responsive tốt

---

## 3) Product (v2/scale) — mở rộng & enterprise
- Public share board/link (read-only / password / expiry)
- Templates, automation rules
- Integrations (Slack, GitHub)
- API keys, public API + webhooks
- SSO (SAML/OAuth), SCIM
- Advanced analytics (cycle time, throughput)
- Compliance: retention policies, data export/delete

---

## 4) “Definition of done” theo giai đoạn
### MVP done
- User tạo workspace → tạo board → tạo list → tạo card → kéo card sang list khác → refresh vẫn đúng
- 100% table có RLS đúng, không có endpoint nào bypass quyền user

### Product done
- 2 user mở cùng board kéo card đồng thời: không phá order; state eventually consistent
- Có audit log để trace mọi mutation
- Có monitoring + alerting cơ bản
