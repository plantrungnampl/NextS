

# 🏗️ System Design: Trello Board

---

## 1. TỔNG QUAN YÊU CẦU

### 1.1 Functional Requirements

```
👤 User Management
   ├── Đăng ký / Đăng nhập (OAuth, Email)
   ├── Quản lý profile
   └── Phân quyền (Admin, Member, Observer)

📋 Board Management
   ├── CRUD boards
   ├── Chia sẻ board (invite members)
   ├── Board visibility (Private, Workspace, Public)
   └── Board templates

📝 List Management
   ├── CRUD lists trong board
   ├── Kéo thả sắp xếp lists
   └── Copy/Move list

🎫 Card Management
   ├── CRUD cards trong list
   ├── Kéo thả card giữa các lists
   ├── Card details:
   │   ├── Description (Markdown)
   │   ├── Comments
   │   ├── Attachments
   │   ├── Labels (màu + text)
   │   ├── Due date
   │   ├── Checklist
   │   ├── Members assigned
   │   └── Cover image
   └── Card activity log

🔔 Real-time & Notifications
   ├── Real-time sync giữa users
   ├── Push notifications
   └── Email notifications

🔍 Search
   ├── Search boards, cards
   └── Filter cards by labels, members, due date
```

### 1.2 Non-Functional Requirements

```
┌─────────────────────────────────────────────────┐
│  Metric              │  Target                   │
├─────────────────────────────────────────────────┤
│  Latency             │  < 200ms (API response)   │
│  Real-time delay     │  < 100ms                  │
│  Availability        │  99.9%                    │
│  Concurrent users    │  100K+ per board          │
│  Storage             │  Attachments up to 250MB  │
│  DAU                 │  10M users                │
└─────────────────────────────────────────────────┘
```

---

## 2. KIẾN TRÚC TỔNG THỂ (High-Level Architecture)

```
┌──────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Web App  │  │ Mobile   │  │ Desktop  │  │  API     │            │
│  │ (React)   │  │ (RN)    │  │ (Electron)│  │ Clients  │            │
│  └─────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
└────────┼──────────────┼─────────────┼──────────────┼─────────────────┘
         │              │             │              │
         ▼              ▼             ▼              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        CDN (CloudFront)                               │
│              Static assets + Attachment delivery                      │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     LOAD BALANCER (ALB/Nginx)                         │
│                   ┌─────────┬──────────┐                              │
│                   │  HTTP   │WebSocket │                               │
│                   │ Routes  │ Routes   │                               │
│                   └────┬────┴─────┬────┘                              │
└────────────────────────┼──────────┼──────────────────────────────────┘
                         │          │
              ┌──────────┘          └──────────┐
              ▼                                ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│     API GATEWAY         │    │   WEBSOCKET GATEWAY     │
│  (Rate Limit, Auth,     │    │  (Socket.io / WS)       │
│   Routing, Throttle)    │    │  Real-time events       │
└───────────┬─────────────┘    └───────────┬─────────────┘
            │                              │
            ▼                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      MICROSERVICES LAYER                              │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  Auth    │ │  Board   │ │  Card    │ │Notifica- │ │  Search  │  │
│  │ Service  │ │ Service  │ │ Service  │ │  tion    │ │ Service  │  │
│  │          │ │          │ │          │ │ Service  │ │          │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       │            │            │             │            │         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                            │
│  │ Activity │ │Attachment│ │ User     │                             │
│  │ Service  │ │ Service  │ │ Service  │                             │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘                            │
└───────┼────────────┼────────────┼────────────────────────────────────┘
        │            │            │
        ▼            ▼            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     MESSAGE QUEUE (Kafka / Redis Pub/Sub)             │
│              Event-driven communication between services              │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                     │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  PostgreSQL  │  │    Redis     │  │Elasticsearch │               │
│  │  (Primary    │  │  (Cache +    │  │  (Full-text  │               │
│  │   Database)  │  │   Pub/Sub)   │  │   Search)    │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐                                  │
│  │  Amazon S3   │  │  MongoDB     │                                  │
│  │  (File       │  │  (Activity   │                                  │
│  │   Storage)   │  │   Logs)      │                                  │
│  └──────────────┘  └──────────────┘                                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. DATABASE SCHEMA DESIGN

### 3.1 ERD (Entity Relationship Diagram)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   users      │     │  workspace_      │     │ workspaces  │
│─────────────│     │  members         │     │─────────────│
│ id (PK)      │◄───┤──────────────────│────►│ id (PK)     │
│ email        │     │ id (PK)          │     │ name        │
│ username     │     │ user_id (FK)     │     │ description │
│ password_hash│     │ workspace_id(FK) │     │ owner_id(FK)│
│ avatar_url   │     │ role             │     │ created_at  │
│ created_at   │     │ joined_at        │     └──────┬──────┘
│ updated_at   │     └──────────────────┘            │
└──────┬──────┘                                      │
       │           ┌──────────────────┐              │
       │           │  board_members   │     ┌────────▼──────┐
       │           │──────────────────│     │   boards      │
       ├──────────►│ id (PK)          │◄────│───────────────│
       │           │ user_id (FK)     │     │ id (PK)       │
       │           │ board_id (FK)    │     │ workspace_id  │
       │           │ role             │     │ title         │
       │           └──────────────────┘     │ description   │
       │                                    │ background    │
       │                                    │ visibility    │
       │                                    │ is_archived   │
       │                                    │ position      │
       │                                    │ created_by(FK)│
       │                                    │ created_at    │
       │                                    └────────┬──────┘
       │                                             │
       │                                    ┌────────▼──────┐
       │                                    │   lists       │
       │                                    │───────────────│
       │                                    │ id (PK)       │
       │                                    │ board_id (FK) │
       │                                    │ title         │
       │                                    │ position      │
       │                                    │ is_archived   │
       │                                    │ created_at    │
       │                                    └────────┬──────┘
       │                                             │
       │    ┌──────────────┐                ┌────────▼──────┐
       │    │ card_members │                │   cards       │
       ├───►│──────────────│◄───────────────│───────────────│
       │    │ id (PK)      │                │ id (PK)       │
       │    │ card_id (FK) │                │ list_id (FK)  │
       │    │ user_id (FK) │                │ title         │
       │    └──────────────┘                │ description   │
       │                                    │ position      │
       │    ┌──────────────┐                │ cover_url     │
       │    │  comments    │                │ due_date      │
       ├───►│──────────────│◄───────────────│ is_completed  │
       │    │ id (PK)      │                │ is_archived   │
       │    │ card_id (FK) │                │ created_by(FK)│
       │    │ user_id (FK) │                │ created_at    │
       │    │ content      │                │ updated_at    │
       │    │ created_at   │                └───┬───┬───┬───┘
       │    │ updated_at   │                    │   │   │
       │    └──────────────┘                    │   │   │
       │                                        │   │   │
       │    ┌──────────────┐    ┌───────────────┘   │   │
       │    │ attachments  │◄───┘                    │   │
       │    │──────────────│        ┌────────────────┘   │
       │    │ id (PK)      │        │                    │
       │    │ card_id (FK) │   ┌────▼────────┐     ┌────▼────────┐
       │    │ user_id (FK) │   │card_labels  │     │ checklists  │
       │    │ filename     │   │─────────────│     │─────────────│
       │    │ file_url     │   │ id (PK)     │     │ id (PK)     │
       │    │ file_size    │   │ card_id(FK) │     │ card_id(FK) │
       │    │ mime_type    │   │ label_id(FK)│     │ title       │
       │    │ created_at   │   └──────┬──────┘     │ position    │
       │    └──────────────┘          │            └──────┬──────┘
       │                              │                   │
       │                     ┌────────▼──────┐   ┌────────▼──────┐
       │                     │   labels      │   │checklist_items│
       │                     │───────────────│   │───────────────│
       │                     │ id (PK)       │   │ id (PK)       │
       │                     │ board_id (FK) │   │ checklist_id  │
       │                     │ name          │   │ content       │
       │                     │ color         │   │ is_completed  │
       │                     └───────────────┘   │ position      │
       │                                         └───────────────┘
       │
       │    ┌──────────────────┐
       └───►│  activities      │
            │──────────────────│
            │ id (PK)          │
            │ user_id (FK)     │
            │ board_id (FK)    │
            │ card_id (FK)     │
            │ action_type      │
            │ data (JSONB)     │
            │ created_at       │
            └──────────────────┘
```

### 3.2 SQL Schema

```sql
-- =============================================
-- USERS & AUTHENTICATION
-- =============================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    username        VARCHAR(50) UNIQUE NOT NULL,
    password_hash   VARCHAR(255),
    full_name       VARCHAR(100),
    avatar_url      TEXT,
    bio             TEXT,
    auth_provider   VARCHAR(20) DEFAULT 'local', -- 'local', 'google', 'github'
    auth_provider_id VARCHAR(255),
    is_verified     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- =============================================
-- WORKSPACES
-- =============================================
CREATE TABLE workspaces (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    short_name      VARCHAR(20) UNIQUE NOT NULL,
    description     TEXT,
    logo_url        TEXT,
    website         VARCHAR(255),
    owner_id        UUID NOT NULL REFERENCES users(id),
    visibility      VARCHAR(20) DEFAULT 'private', -- 'private', 'public'
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workspace_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) DEFAULT 'member', -- 'admin', 'member', 'observer'
    joined_at       TIMESTAMP DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- =============================================
-- BOARDS
-- =============================================
CREATE TABLE boards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    background_color VARCHAR(7),
    background_image TEXT,
    visibility      VARCHAR(20) DEFAULT 'workspace', -- 'private','workspace','public'
    is_archived     BOOLEAN DEFAULT FALSE,
    is_starred      BOOLEAN DEFAULT FALSE,
    position        FLOAT NOT NULL DEFAULT 65535,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_boards_workspace ON boards(workspace_id);
CREATE INDEX idx_boards_created_by ON boards(created_by);

CREATE TABLE board_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id        UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) DEFAULT 'member', -- 'admin', 'member', 'observer'
    joined_at       TIMESTAMP DEFAULT NOW(),
    UNIQUE(board_id, user_id)
);

-- =============================================
-- LISTS
-- =============================================
CREATE TABLE lists (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id        UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    position        FLOAT NOT NULL DEFAULT 65535,
    is_archived     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_lists_board ON lists(board_id);
CREATE INDEX idx_lists_position ON lists(board_id, position);

-- =============================================
-- CARDS
-- =============================================
CREATE TABLE cards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id         UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    position        FLOAT NOT NULL DEFAULT 65535,
    cover_url       TEXT,
    cover_color     VARCHAR(7),
    due_date        TIMESTAMP,
    due_complete     BOOLEAN DEFAULT FALSE,
    is_archived     BOOLEAN DEFAULT FALSE,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cards_list ON cards(list_id);
CREATE INDEX idx_cards_position ON cards(list_id, position);
CREATE INDEX idx_cards_due_date ON cards(due_date) WHERE due_date IS NOT NULL;

-- =============================================
-- LABELS
-- =============================================
CREATE TABLE labels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id        UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name            VARCHAR(50),
    color           VARCHAR(20) NOT NULL, -- 'green','yellow','orange','red','purple','blue'
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE card_labels (
    card_id         UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    label_id        UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (card_id, label_id)
);

-- =============================================
-- CARD MEMBERS
-- =============================================
CREATE TABLE card_members (
    card_id         UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at     TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (card_id, user_id)
);

-- =============================================
-- CHECKLISTS
-- =============================================
CREATE TABLE checklists (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id         UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL DEFAULT 'Checklist',
    position        FLOAT NOT NULL DEFAULT 65535,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE checklist_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id    UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
    content         VARCHAR(500) NOT NULL,
    is_completed    BOOLEAN DEFAULT FALSE,
    position        FLOAT NOT NULL DEFAULT 65535,
    assigned_to     UUID REFERENCES users(id),
    due_date        TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- COMMENTS
-- =============================================
CREATE TABLE comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id         UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    content         TEXT NOT NULL,
    is_edited       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_comments_card ON comments(card_id);

-- =============================================
-- ATTACHMENTS
-- =============================================
CREATE TABLE attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id         UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    file_name       VARCHAR(255) NOT NULL,
    file_url        TEXT NOT NULL,
    file_size       BIGINT NOT NULL, -- bytes
    mime_type       VARCHAR(100),
    is_cover        BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- ACTIVITY LOG
-- =============================================
CREATE TABLE activities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id        UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    card_id         UUID REFERENCES cards(id) ON DELETE SET NULL,
    user_id         UUID NOT NULL REFERENCES users(id),
    action_type     VARCHAR(50) NOT NULL,
    -- 'card_created','card_moved','card_archived','comment_added',
    -- 'member_added','label_added','due_date_changed', etc.
    data            JSONB DEFAULT '{}',
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activities_board ON activities(board_id);
CREATE INDEX idx_activities_card ON activities(card_id);
CREATE INDEX idx_activities_created ON activities(created_at DESC);

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    message         TEXT,
    data            JSONB DEFAULT '{}',
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
```

---

## 4. API DESIGN (RESTful)

### 4.1 Authentication

```
┌────────┬──────────────────────────┬────────────────────────────┐
│ Method │ Endpoint                 │ Description                │
├────────┼──────────────────────────┼────────────────────────────┤
│ POST   │ /api/auth/register       │ Đăng ký tài khoản         │
│ POST   │ /api/auth/login          │ Đăng nhập                 │
│ POST   │ /api/auth/logout         │ Đăng xuất                 │
│ POST   │ /api/auth/refresh        │ Refresh token             │
│ POST   │ /api/auth/forgot-password│ Quên mật khẩu             │
│ GET    │ /api/auth/google         │ OAuth Google              │
│ GET    │ /api/auth/github         │ OAuth GitHub              │
└────────┴──────────────────────────┴────────────────────────────┘
```

### 4.2 Boards

```
┌────────┬──────────────────────────────────────┬─────────────────────────┐
│ Method │ Endpoint                             │ Description             │
├────────┼──────────────────────────────────────┼─────────────────────────┤
│ GET    │ /api/boards                          │ Lấy tất cả boards      │
│ POST   │ /api/boards                          │ Tạo board mới          │
│ GET    │ /api/boards/:boardId                 │ Chi tiết board         │
│ PUT    │ /api/boards/:boardId                 │ Cập nhật board         │
│ DELETE │ /api/boards/:boardId                 │ Xóa board              │
│ POST   │ /api/boards/:boardId/members         │ Thêm member            │
│ DELETE │ /api/boards/:boardId/members/:userId │ Xóa member             │
│ GET    │ /api/boards/:boardId/activity        │ Activity log           │
│ PUT    │ /api/boards/:boardId/archive         │ Archive board          │
└────────┴──────────────────────────────────────┴─────────────────────────┘
```

### 4.3 Lists

```
┌────────┬──────────────────────────────────────────────┬──────────────────┐
│ Method │ Endpoint                                     │ Description      │
├────────┼──────────────────────────────────────────────┼──────────────────┤
│ GET    │ /api/boards/:boardId/lists                   │ Lấy lists        │
│ POST   │ /api/boards/:boardId/lists                   │ Tạo list mới     │
│ PUT    │ /api/lists/:listId                           │ Cập nhật list    │
│ DELETE │ /api/lists/:listId                           │ Xóa list         │
│ PUT    │ /api/lists/:listId/move                      │ Di chuyển list   │
│ PUT    │ /api/boards/:boardId/lists/reorder           │ Sắp xếp lại     │
│ POST   │ /api/lists/:listId/archive-all-cards         │ Archive all cards│
└────────┴──────────────────────────────────────────────┴──────────────────┘
```

### 4.4 Cards

```
┌────────┬────────────────────────────────────────────────┬────────────────────┐
│ Method │ Endpoint                                       │ Description        │
├────────┼────────────────────────────────────────────────┼────────────────────┤
│ GET    │ /api/lists/:listId/cards                       │ Lấy cards          │
│ POST   │ /api/lists/:listId/cards                       │ Tạo card mới       │
│ GET    │ /api/cards/:cardId                             │ Chi tiết card      │
│ PUT    │ /api/cards/:cardId                             │ Cập nhật card      │
│ DELETE │ /api/cards/:cardId                             │ Xóa card           │
│ PUT    │ /api/cards/:cardId/move                        │ Move card          │
│ PUT    │ /api/cards/reorder                             │ Reorder cards      │
│ POST   │ /api/cards/:cardId/members                    │ Assign member      │
│ DELETE │ /api/cards/:cardId/members/:userId             │ Remove member      │
│ POST   │ /api/cards/:cardId/labels                     │ Add label          │
│ DELETE │ /api/cards/:cardId/labels/:labelId             │ Remove label       │
│ POST   │ /api/cards/:cardId/comments                   │ Add comment        │
│ PUT    │ /api/cards/:cardId/comments/:commentId         │ Edit comment       │
│ DELETE │ /api/cards/:cardId/comments/:commentId         │ Delete comment     │
│ POST   │ /api/cards/:cardId/attachments                │ Upload attachment  │
│ DELETE │ /api/cards/:cardId/attachments/:attachmentId   │ Delete attachment  │
│ POST   │ /api/cards/:cardId/checklists                 │ Add checklist      │
│ PUT    │ /api/checklists/:checklistId/items/:itemId    │ Toggle item        │
└────────┴────────────────────────────────────────────────┴────────────────────┘
```

### 4.5 Request/Response Examples

```json
// POST /api/boards/:boardId/lists
// Request:
{
  "title": "To Do",
  "position": 65535
}

// Response: 201 Created
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "boardId": "board-uuid",
    "title": "To Do",
    "position": 65535,
    "cards": [],
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

```json
// PUT /api/cards/:cardId/move
// Request:
{
  "targetListId": "list-uuid-2",
  "position": 32767.5
}

// Response: 200 OK
{
  "success": true,
  "data": {
    "id": "card-uuid",
    "listId": "list-uuid-2",
    "position": 32767.5,
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

---

## 5. THUẬT TOÁN SẮP XẾP (Position/Ordering)

### 5.1 Fractional Indexing Strategy

```
Vấn đề: Khi kéo thả card/list, cần tính toán vị trí mới
         mà KHÔNG phải cập nhật lại toàn bộ position

Giải pháp: Dùng FLOAT cho position, vị trí mới = trung bình 2 vị trí kề

┌─────────────────────────────────────────────────────────┐
│                                                          │
│  Ban đầu:                                                │
│  Card A (pos: 1000)                                      │
│  Card B (pos: 2000)                                      │
│  Card C (pos: 3000)                                      │
│  Card D (pos: 4000)                                      │
│                                                          │
│  Di chuyển Card D giữa A và B:                           │
│  Card A (pos: 1000)                                      │
│  Card D (pos: 1500)  ← new_pos = (1000 + 2000) / 2     │
│  Card B (pos: 2000)                                      │
│  Card C (pos: 3000)                                      │
│                                                          │
│  Nếu đặt đầu tiên:                                      │
│  new_pos = first_pos / 2  →  500                         │
│                                                          │
│  Nếu đặt cuối cùng:                                     │
│  new_pos = last_pos + 65535                               │
│                                                          │
│  ⚠️ Rebalance khi khoảng cách < threshold (< 1)         │
│     → Gán lại position cho tất cả items: 65535 bước      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

```typescript
// position-utils.ts
export function calculatePosition(
  prevPosition: number | null,
  nextPosition: number | null
): number {
  const STEP = 65535;

  if (prevPosition === null && nextPosition === null) {
    return STEP; // First item
  }
  if (prevPosition === null) {
    return nextPosition! / 2;
  }
  if (nextPosition === null) {
    return prevPosition + STEP;
  }
  return (prevPosition + nextPosition) / 2;
}

export function needsRebalancing(
  prevPosition: number | null,
  nextPosition: number | null
): boolean {
  if (prevPosition === null || nextPosition === null) return false;
  return (nextPosition - prevPosition) < 0.001;
}

export function rebalancePositions(count: number): number[] {
  const STEP = 65535;
  return Array.from({ length: count }, (_, i) => (i + 1) * STEP);
}
```

---

## 6. REAL-TIME SYSTEM

### 6.1 WebSocket Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    REAL-TIME ARCHITECTURE                      │
│                                                               │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐                │
│  │ Client1 │     │ Client2 │     │ Client3 │                │
│  │(Board A)│     │(Board A)│     │(Board B)│                │
│  └────┬────┘     └────┬────┘     └────┬────┘                │
│       │               │               │                      │
│       │   WebSocket    │   WebSocket   │   WebSocket         │
│       ▼               ▼               ▼                      │
│  ┌─────────────────────────────────────────────┐             │
│  │          WebSocket Server Cluster            │            │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │            │
│  │  │ Server 1 │  │ Server 2 │  │ Server 3 │  │            │
│  │  └─────┬────┘  └─────┬────┘  └─────┬────┘  │            │
│  └────────┼──────────────┼──────────────┼──────┘            │
│           │              │              │                    │
│           ▼              ▼              ▼                    │
│  ┌──────────────────────────────────────────────┐            │
│  │         Redis Pub/Sub (Adapter)               │           │
│  │                                                │          │
│  │  Channel: board:{boardId}                      │          │
│  │  Channel: user:{userId}                        │          │
│  │  Channel: card:{cardId}                        │          │
│  └──────────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 WebSocket Events

```typescript
// =============================================
// CLIENT → SERVER Events
// =============================================
interface ClientEvents {
  // Room management
  'board:join':       { boardId: string };
  'board:leave':      { boardId: string };
  'card:open':        { cardId: string };
  'card:close':       { cardId: string };

  // Cursor/typing indicators
  'card:typing':      { cardId: string, field: string };
  'cursor:move':      { boardId: string, x: number, y: number };
}

// =============================================
// SERVER → CLIENT Events
// =============================================
interface ServerEvents {
  // Board events
  'board:updated':        BoardUpdatePayload;
  'board:member-added':   MemberPayload;
  'board:member-removed': MemberPayload;

  // List events
  'list:created':     ListPayload;
  'list:updated':     ListPayload;
  'list:deleted':     { listId: string };
  'list:reordered':   { lists: PositionUpdate[] };

  // Card events
  'card:created':     CardPayload;
  'card:updated':     CardUpdatePayload;
  'card:moved':       CardMovePayload;
  'card:deleted':     { cardId: string };
  'card:reordered':   { cards: PositionUpdate[] };

  // Card detail events
  'comment:added':      CommentPayload;
  'comment:updated':    CommentPayload;
  'comment:deleted':    { commentId: string };
  'attachment:added':   AttachmentPayload;
  'attachment:deleted': { attachmentId: string };
  'label:toggled':      LabelTogglePayload;
  'member:assigned':    CardMemberPayload;
  'member:unassigned':  CardMemberPayload;
  'checklist:updated':  ChecklistPayload;

  // Presence
  'user:online':        { userId: string, boardId: string };
  'user:offline':       { userId: string, boardId: string };
  'user:typing':        { userId: string, cardId: string, field: string };
  'cursors:update':     CursorPayload[];

  // Notifications
  'notification:new':   NotificationPayload;
}

// =============================================
// Event Payload Types
// =============================================
interface CardMovePayload {
  cardId: string;
  fromListId: string;
  toListId: string;
  position: number;
  movedBy: string; // userId
}

interface PositionUpdate {
  id: string;
  position: number;
}
```

### 6.3 Socket.IO Server Implementation

```typescript
// socket.server.ts
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export async function initializeSocketServer(httpServer: any) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL },
    transports: ['websocket', 'polling'],
  });

  // Redis adapter cho horizontal scaling
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const user = await verifyToken(token);
      socket.data.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.user.id;
    console.log(`User connected: ${userId}`);

    // Join user's personal room for notifications
    socket.join(`user:${userId}`);

    // ---- Board Room Management ----
    socket.on('board:join', async ({ boardId }) => {
      // Verify user has access to board
      const hasAccess = await checkBoardAccess(userId, boardId);
      if (!hasAccess) return;

      socket.join(`board:${boardId}`);

      // Track online users
      await redis.sadd(`board:${boardId}:online`, userId);

      // Notify others
      socket.to(`board:${boardId}`).emit('user:online', {
        userId,
        boardId,
      });
    });

    socket.on('board:leave', async ({ boardId }) => {
      socket.leave(`board:${boardId}`);
      await redis.srem(`board:${boardId}:online`, userId);
      socket.to(`board:${boardId}`).emit('user:offline', {
        userId,
        boardId,
      });
    });

    // ---- Card Detail Room ----
    socket.on('card:open', ({ cardId }) => {
      socket.join(`card:${cardId}`);
    });

    socket.on('card:close', ({ cardId }) => {
      socket.leave(`card:${cardId}`);
    });

    // ---- Typing Indicators ----
    socket.on('card:typing', ({ cardId, field }) => {
      socket.to(`card:${cardId}`).emit('user:typing', {
        userId,
        cardId,
        field,
      });
    });

    // ---- Disconnect ----
    socket.on('disconnect', async () => {
      // Clean up online status from all boards
      const rooms = Array.from(socket.rooms);
      for (const room of rooms) {
        if (room.startsWith('board:')) {
          const boardId = room.replace('board:', '');
          await redis.srem(`board:${boardId}:online`, userId);
          io.to(room).emit('user:offline', { userId, boardId });
        }
      }
    });
  });

  return io;
}

// =============================================
// Broadcast helper (dùng trong API handlers)
// =============================================
export function broadcastToBoard(
  io: Server,
  boardId: string,
  event: string,
  data: any,
  excludeUserId?: string
) {
  if (excludeUserId) {
    // Gửi cho tất cả trừ user thực hiện action
    io.to(`board:${boardId}`).except(`user:${excludeUserId}`).emit(event, data);
  } else {
    io.to(`board:${boardId}`).emit(event, data);
  }
}
```

---

## 7. DRAG & DROP - FLOW CHI TIẾT

```
┌─────────────────────────────────────────────────────────────────┐
│                  DRAG & DROP FLOW                                │
│                                                                  │
│  1. User kéo Card X từ List A → List B                          │
│                                                                  │
│  ┌──────────┐                                                    │
│  │ Frontend │                                                    │
│  │ (React)  │                                                    │
│  └─────┬────┘                                                    │
│        │ 1. onDragEnd() triggered                                │
│        │                                                         │
│        │ 2. OPTIMISTIC UPDATE (cập nhật UI ngay lập tức)        │
│        │    - Remove card from source list state                 │
│        │    - Insert card into target list state                 │
│        │    - Calculate new position                             │
│        │                                                         │
│        │ 3. API call: PUT /api/cards/:cardId/move               │
│        ▼                                                         │
│  ┌──────────┐                                                    │
│  │ Backend  │                                                    │
│  │  API     │                                                    │
│  └─────┬────┘                                                    │
│        │ 4. Validate request                                     │
│        │ 5. Begin transaction                                    │
│        │    - UPDATE cards SET list_id = :targetListId,          │
│        │      position = :newPosition WHERE id = :cardId         │
│        │    - Check if rebalancing needed                        │
│        │    - INSERT INTO activities (...)                       │
│        │ 6. Commit transaction                                   │
│        │                                                         │
│        │ 7. Broadcast WebSocket event                            │
│        ▼                                                         │
│  ┌──────────────┐                                                │
│  │  WebSocket   │ → emit('card:moved', {                        │
│  │  Server      │     cardId, fromListId, toListId,             │
│  │              │     position, movedBy                          │
│  └──────┬───────┘   })                                           │
│         │                                                        │
│         │ 8. Other clients receive event                         │
│         ▼                                                        │
│  ┌──────────┐                                                    │
│  │ Other    │ 9. Update local state to reflect move             │
│  │ Clients  │                                                    │
│  └──────────┘                                                    │
│                                                                  │
│  ⚠️ ERROR HANDLING:                                              │
│  Nếu API call fail → ROLLBACK optimistic update trên UI         │
│  Hiển thị toast error cho user                                   │
└─────────────────────────────────────────────────────────────────┘
```

```typescript
// Frontend: Drag & Drop handler
// Sử dụng @dnd-kit/core hoặc react-beautiful-dnd

import { DragEndEvent } from '@dnd-kit/core';

async function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const cardId = active.id as string;
  const sourceListId = active.data.current?.listId;
  const targetListId = over.data.current?.listId;
  const targetIndex = over.data.current?.index;

  // 1. Calculate new position
  const targetList = lists.find(l => l.id === targetListId);
  const targetCards = targetList?.cards || [];

  let newPosition: number;
  if (targetCards.length === 0) {
    newPosition = 65535;
  } else if (targetIndex === 0) {
    newPosition = targetCards[0].position / 2;
  } else if (targetIndex >= targetCards.length) {
    newPosition = targetCards[targetCards.length - 1].position + 65535;
  } else {
    newPosition = (
      targetCards[targetIndex - 1].position +
      targetCards[targetIndex].position
    ) / 2;
  }

  // 2. Optimistic update
  const previousState = cloneDeep(boardState);
  dispatch(moveCard({ cardId, sourceListId, targetListId, newPosition }));

  // 3. API call
  try {
    await api.put(`/cards/${cardId}/move`, {
      targetListId,
      position: newPosition,
    });
  } catch (error) {
    // 4. Rollback on failure
    dispatch(setBoardState(previousState));
    toast.error('Failed to move card');
  }
}
```

---

## 8. CACHING STRATEGY

```
┌─────────────────────────────────────────────────────────────────┐
│                     REDIS CACHING LAYERS                         │
│                                                                  │
│  ┌─────────────────────────────────────────────┐                │
│  │  Layer 1: Board Data Cache                   │                │
│  │                                               │               │
│  │  Key: board:{boardId}:data                    │               │
│  │  Value: { board info, lists, cards summary }  │               │
│  │  TTL: 5 minutes                               │               │
│  │  Invalidate: on any board/list/card change    │               │
│  └─────────────────────────────────────────────┘                │
│                                                                  │
│  ┌─────────────────────────────────────────────┐                │
│  │  Layer 2: User Session & Permissions         │                │
│  │                                               │               │
│  │  Key: user:{userId}:boards                    │               │
│  │  Value: [boardId1, boardId2, ...]             │               │
│  │  TTL: 15 minutes                              │               │
│  │                                               │               │
│  │  Key: user:{userId}:board:{boardId}:role      │               │
│  │  Value: "admin" | "member" | "observer"       │               │
│  │  TTL: 10 minutes                              │               │
│  └─────────────────────────────────────────────┘                │
│                                                                  │
│  ┌─────────────────────────────────────────────┐                │
│  │  Layer 3: Online Users Tracking              │                │
│  │                                               │               │
│  │  Key: board:{boardId}:online                  │               │
│  │  Type: SET                                    │               │
│  │  Members: [userId1, userId2, ...]             │               │
│  │  No TTL (managed by WebSocket lifecycle)      │               │
│  └─────────────────────────────────────────────┘                │
│                                                                  │
│  ┌─────────────────────────────────────────────┐                │
│  │  Layer 4: Rate Limiting                      │                │
│  │                                               │               │
│  │  Key: ratelimit:{userId}:{endpoint}           │               │
│  │  Value: request count                         │               │
│  │  TTL: sliding window (1 minute)               │               │
│  └─────────────────────────────────────────────┘                │
│                                                                  │
│  Cache Invalidation Strategy:                                    │
│  ┌──────────────────────────────────────┐                       │
│  │  Write-through + Event-based         │                       │
│  │                                       │                      │
│  │  API Handler:                         │                      │
│  │    1. Update DB                       │                      │
│  │    2. Delete cache key                │                      │
│  │    3. Emit WebSocket event            │                      │
│  │    4. Publish to Kafka (async tasks)  │                      │
│  └──────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. SEARCH SYSTEM

```
┌─────────────────────────────────────────────────────────────────┐
│                    ELASTICSEARCH INTEGRATION                      │
│                                                                   │
│  ┌──────────┐    ┌──────────┐    ┌─────────────────┐            │
│  │ API      │───►│  Kafka   │───►│  Search Indexer │            │
│  │ Server   │    │ (events) │    │  (Consumer)     │            │
│  └──────────┘    └──────────┘    └────────┬────────┘            │
│                                           │                      │
│                                           ▼                      │
│                                  ┌─────────────────┐            │
│                                  │ Elasticsearch    │            │
│                                  │                  │            │
│                                  │ Index: cards     │            │
│                                  │ Index: boards    │            │
│                                  └─────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

```json
// Elasticsearch Card Index Mapping
{
  "mappings": {
    "properties": {
      "id":           { "type": "keyword" },
      "boardId":      { "type": "keyword" },
      "listId":       { "type": "keyword" },
      "title":        { "type": "text", "analyzer": "standard" },
      "description":  { "type": "text", "analyzer": "standard" },
      "labels":       { "type": "keyword" },
      "memberIds":    { "type": "keyword" },
      "dueDate":      { "type": "date" },
      "isArchived":   { "type": "boolean" },
      "createdAt":    { "type": "date" },
      "comments": {
        "type": "nested",
        "properties": {
          "content": { "type": "text" }
        }
      }
    }
  }
}
```

---

## 10. FILE UPLOAD SYSTEM

```
┌─────────────────────────────────────────────────────────────────┐
│              FILE UPLOAD FLOW (Pre-signed URL)                    │
│                                                                   │
│  ┌────────┐  1. Request upload URL   ┌──────────┐               │
│  │ Client │─────────────────────────►│ API      │               │
│  │        │◄─────────────────────────│ Server   │               │
│  │        │  2. Return pre-signed    │          │               │
│  │        │     URL + attachment ID  └─────┬────┘               │
│  │        │                                │                     │
│  │        │  3. Upload file directly  ┌────▼─────┐              │
│  │        │─────────────────────────►│ AWS S3   │               │
│  │        │                          │          │               │
│  │        │  4. Upload complete      └──────────┘               │
│  │        │                                                      │
│  │        │  5. Confirm upload       ┌──────────┐               │
│  │        │─────────────────────────►│ API      │               │
│  │        │                          │ Server   │               │
│  │        │◄─────────────────────────│          │               │
│  │        │  6. Return attachment    └──────────┘               │
│  └────────┘     details                                          │
│                                                                   │
│  Benefits:                                                        │
│  ✅ File không đi qua server → giảm bandwidth                   │
│  ✅ S3 xử lý directly → scalable                                │
│  ✅ Pre-signed URL → secure, time-limited                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. NOTIFICATION SYSTEM

```
┌─────────────────────────────────────────────────────────────────┐
│                   NOTIFICATION FLOW                               │
│                                                                   │
│  ┌──────────┐                                                    │
│  │  Action  │  User A assigns User B to a card                  │
│  │  Trigger │                                                    │
│  └─────┬────┘                                                    │
│        │                                                         │
│        ▼                                                         │
│  ┌──────────────┐                                                │
│  │  Event Bus   │  Publish: 'card.member.assigned'              │
│  │  (Kafka)     │                                                │
│  └──────┬───────┘                                                │
│         │                                                        │
│    ┌────┴────┬────────────┐                                     │
│    ▼         ▼            ▼                                      │
│  ┌────┐  ┌────────┐  ┌─────────┐                               │
│  │In- │  │  Push  │  │  Email  │                                │
│  │App │  │ Notif. │  │ Service │                                │
│  │    │  │ (FCM)  │  │(SendGrid│                                │
│  └─┬──┘  └────────┘  │  /SES)  │                               │
│    │                  └─────────┘                                │
│    │                                                             │
│    ▼                                                             │
│  ┌──────────────────────────────────────────┐                   │
│  │  WebSocket: emit to user:{userId}        │                   │
│  │  'notification:new' → { type, message }  │                   │
│  └──────────────────────────────────────────┘                   │
│                                                                   │
│  Notification Preferences (per user):                             │
│  ┌───────────────────────────────────────┐                       │
│  │  assigned_to_card    │ in-app, email  │                       │
│  │  card_due_soon       │ in-app, push   │                       │
│  │  mentioned_in_comment│ in-app, email  │                       │
│  │  board_invited       │ in-app, email  │                       │
│  │  card_moved          │ in-app only    │                       │
│  └───────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. TECH STACK ĐỀ XUẤT

```
┌─────────────────────────────────────────────────────────────────┐
│                      TECHNOLOGY STACK                             │
│                                                                   │
│  ┌─── FRONTEND ──────────────────────────────────────┐           │
│  │                                                    │          │
│  │  Framework:    React 18 + TypeScript               │          │
│  │  State:        Zustand / Redux Toolkit             │          │
│  │  Drag & Drop:  @dnd-kit/core                       │          │
│  │  Real-time:    Socket.IO Client                    │          │
│  │  Styling:      Tailwind CSS                        │          │
│  │  Forms:        React Hook Form + Zod               │          │
│  │  Rich Text:    TipTap (for descriptions)           │          │
│  │  Data Fetch:   TanStack Query (React Query)        │          │
│  │  Router:       React Router v6                     │          │
│  │  Build:        Vite                                │          │
│  └────────────────────────────────────────────────────┘          │
│                                                                   │
│  ┌─── BACKEND ───────────────────────────────────────┐           │
│  │                                                    │          │
│  │  Runtime:      Node.js 20 LTS                      │          │
│  │  Framework:    NestJS (hoặc Express + TypeScript)  │          │
│  │  ORM:          Prisma / TypeORM                    │          │
│  │  Validation:   class-validator / Zod               │          │
│  │  Auth:         Passport.js + JWT                   │          │
│  │  WebSocket:    Socket.IO                           │          │
│  │  API Docs:     Swagger (OpenAPI)                   │          │
│  │  Testing:      Jest + Supertest                    │          │
│  └────────────────────────────────────────────────────┘          │
│                                                                   │
│  ┌─── DATABASE & INFRASTRUCTURE ─────────────────────┐           │
│  │                                                    │          │
│  │  Primary DB:     PostgreSQL 16                     │          │
│  │  Cache:          Redis 7                           │          │
│  │  Search:         Elasticsearch 8                   │          │
│  │  Message Queue:  Apache Kafka (or BullMQ + Redis)  │          │
│  │  File Storage:   AWS S3 / MinIO                    │          │
│  │  CDN:            CloudFront / Cloudflare            │          │
│  └────────────────────────────────────────────────────┘          │
│                                                                   │
│  ┌─── DEVOPS ────────────────────────────────────────┐           │
│  │                                                    │          │
│  │  Container:     Docker + Docker Compose            │          │
│  │  Orchestration: Kubernetes (K8s)                   │          │
│  │  CI/CD:         GitHub Actions                     │          │
│  │  Monitoring:    Prometheus + Grafana               │          │
│  │  Logging:       ELK Stack (Elastic)                │          │
│  │  APM:           Datadog / New Relic                 │          │
│  │  Cloud:         AWS / GCP                          │          │
│  └────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. FOLDER STRUCTURE

```
trello-clone/
├── 📁 apps/
│   ├── 📁 web/                          # React Frontend
│   │   ├── 📁 src/
│   │   │   ├── 📁 components/
│   │   │   │   ├── 📁 Board/
│   │   │   │   │   ├── BoardHeader.tsx
│   │   │   │   │   ├── BoardCanvas.tsx
│   │   │   │   │   └── BoardSidebar.tsx
│   │   │   │   ├── 📁 List/
│   │   │   │   │   ├── ListColumn.tsx
│   │   │   │   │   ├── ListHeader.tsx
│   │   │   │   │   └── AddListButton.tsx
│   │   │   │   ├── 📁 Card/
│   │   │   │   │   ├── CardItem.tsx
│   │   │   │   │   ├── CardModal.tsx
│   │   │   │   │   ├── CardDescription.tsx
│   │   │   │   │   ├── CardChecklist.tsx
│   │   │   │   │   ├── CardComments.tsx
│   │   │   │   │   ├── CardLabels.tsx
│   │   │   │   │   ├── CardMembers.tsx
│   │   │   │   │   ├── CardAttachments.tsx
│   │   │   │   │   └── CardActivity.tsx
│   │   │   │   ├── 📁 DragDrop/
│   │   │   │   │   ├── DragOverlay.tsx
│   │   │   │   │   ├── SortableCard.tsx
│   │   │   │   │   └── SortableList.tsx
│   │   │   │   └── 📁 common/
│   │   │   │       ├── Navbar.tsx
│   │   │   │       ├── Avatar.tsx
│   │   │   │       ├── Modal.tsx
│   │   │   │       └── Loading.tsx
│   │   │   ├── 📁 hooks/
│   │   │   │   ├── useBoard.ts
│   │   │   │   ├── useCards.ts
│   │   │   │   ├── useDragDrop.ts
│   │   │   │   ├── useSocket.ts
│   │   │   │   └── useAuth.ts
│   │   │   ├── 📁 stores/
│   │   │   │   ├── boardStore.ts
│   │   │   │   ├── authStore.ts
│   │   │   │   └── notificationStore.ts
│   │   │   ├── 📁 services/
│   │   │   │   ├── api.ts
│   │   │   │   ├── socket.ts
│   │   │   │   ├── boardService.ts
│   │   │   │   ├── cardService.ts
│   │   │   │   └── authService.ts
│   │   │   ├── 📁 pages/
│   │   │   │   ├── Home.tsx
│   │   │   │   ├── Board.tsx
│   │   │   │   ├── Login.tsx
│   │   │   │   └── Profile.tsx
│   │   │   ├── 📁 types/
│   │   │   │   ├── board.types.ts
│   │   │   │   ├── card.types.ts
│   │   │   │   └── user.types.ts
│   │   │   └── 📁 utils/
│   │   │       ├── position.ts
│   │   │       └── helpers.ts
│   │   └── package.json
│   │
│   └── 📁 api/                          # NestJS Backend
│       ├── 📁 src/
│       │   ├── 📁 modules/
│       │   │   ├── 📁 auth/
│       │   │   │   ├── auth.controller.ts
│       │   │   │   ├── auth.service.ts
│       │   │   │   ├── auth.module.ts
│       │   │   │   ├── strategies/
│       │   │   │   │   ├── jwt.strategy.ts
│       │   │   │   │   └── google.strategy.ts
│       │   │   │   └── guards/
│       │   │   │       ├── jwt-auth.guard.ts
│       │   │   │       └── board-member.guard.ts
│       │   │   ├── 📁 boards/
│       │   │   │   ├── boards.controller.ts
│       │   │   │   ├── boards.service.ts
│       │   │   │   ├── boards.module.ts
│       │   │   │   └── dto/
│       │   │   │       ├── create-board.dto.ts
│       │   │   │       └── update-board.dto.ts
│       │   │   ├── 📁 lists/
│       │   │   │   ├── lists.controller.ts
│       │   │   │   ├── lists.service.ts
│       │   │   │   └── lists.module.ts
│       │   │   ├── 📁 cards/
│       │   │   │   ├── cards.controller.ts
│       │   │   │   ├── cards.service.ts
│       │   │   │   ├── cards.module.ts
│       │   │   │   └── dto/
│       │   │   │       ├── create-card.dto.ts
│       │   │   │       ├── move-card.dto.ts
│       │   │   │       └── update-card.dto.ts
│       │   │   ├── 📁 comments/
│       │   │   ├── 📁 attachments/
│       │   │   ├── 📁 labels/
│       │   │   ├── 📁 notifications/
│       │   │   ├── 📁 search/
│       │   │   └── 📁 websocket/
│       │   │       ├── websocket.gateway.ts
│       │   │       ├── websocket.module.ts
│       │   │       └── websocket.service.ts
│       │   ├── 📁 common/
│       │   │   ├── 📁 decorators/
│       │   │   ├── 📁 filters/
│       │   │   ├── 📁 interceptors/
│       │   │   ├── 📁 pipes/
│       │   │   └── 📁 middleware/
│       │   ├── 📁 config/
│       │   │   ├── database.config.ts
│       │   │   ├── redis.config.ts
│       │   │   └── app.config.ts
│       │   ├── 📁 prisma/
│       │   │   ├── schema.prisma
│       │   │   └── migrations/
│       │   └── main.ts
│       └── package.json
│
├── 📁 packages/                         # Shared packages
│   ├── 📁 shared-types/                 # Shared TypeScript types
│   └── 📁 utils/                        # Shared utilities
│
├── 📁 infrastructure/
│   ├── 📁 docker/
│   │   ├── Dockerfile.web
│   │   ├── Dockerfile.api
│   │   └── docker-compose.yml
│   ├── 📁 k8s/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── ingress.yaml
│   └── 📁 terraform/
│
├── turbo.json                           # Turborepo config
├── package.json
└── README.md
```

---

## 14. SCALING & PERFORMANCE

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCALING STRATEGY                               │
│                                                                   │
│  ┌── Horizontal Scaling ──────────────────────────────┐          │
│  │                                                     │         │
│  │  API Servers:     Auto-scale 2-20 instances         │         │
│  │  WS Servers:      Auto-scale 2-10 instances         │         │
│  │  Workers:         Auto-scale based on queue depth    │         │
│  │                                                     │         │
│  │  ⚙️ Redis Adapter cho Socket.IO                     │         │
│  │     → Đảm bảo events broadcast across all instances │         │
│  └─────────────────────────────────────────────────────┘         │
│                                                                   │
│  ┌── Database Scaling ────────────────────────────────┐          │
│  │                                                     │         │
│  │  PostgreSQL:                                        │         │
│  │    Primary (Write) ──► Replica 1 (Read)            │         │
│  │                   └──► Replica 2 (Read)            │         │
│  │                                                     │         │
│  │  Connection Pooling: PgBouncer (max 100 per server)│         │
│  │                                                     │         │
│  │  Partitioning: activities table by created_at       │         │
│  │  (monthly partitions)                               │         │
│  └─────────────────────────────────────────────────────┘         │
│                                                                   │
│  ┌── Performance Optimizations ───────────────────────┐          │
│  │                                                     │         │
│  │  1. Board data: Single query with JOINs             │         │
│  │     (board + lists + cards in 1 request)            │         │
│  │                                                     │         │
│  │  2. Lazy loading: Card details loaded on click      │         │
│  │     (comments, activity, checklists)                │         │
│  │                                                     │         │
│  │  3. Virtual scrolling: For boards with 100+ cards   │         │
│  │                                                     │         │
│  │  4. Debounce: Card description auto-save (500ms)    │         │
│  │                                                     │         │
│  │  5. Batch operations: Reorder multiple cards         │         │
│  │     in single API call                              │         │
│  │                                                     │         │
│  │  6. Cursor-based pagination: For activity feed      │         │
│  │     & comments                                      │         │
│  └─────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 15. SECURITY

```
┌─────────────────────────────────────────────────────────────────┐
│                      SECURITY MEASURES                            │
│                                                                   │
│  🔐 Authentication                                               │
│  ├── JWT Access Token (15min) + Refresh Token (7days)            │
│  ├── Refresh token rotation                                      │
│  ├── Token stored in httpOnly cookie (not localStorage)          │
│  └── OAuth 2.0 (Google, GitHub)                                  │
│                                                                   │
│  🛡️ Authorization                                                │
│  ├── Role-based (Admin, Member, Observer)                        │
│  ├── Board-level permissions checked via middleware/guard        │
│  ├── Card-level: only board members can view/edit               │
│  └── API: user can only access their own resources              │
│                                                                   │
│  🔒 Data Protection                                              │
│  ├── HTTPS everywhere (TLS 1.3)                                  │
│  ├── Passwords: bcrypt (salt rounds: 12)                         │
│  ├── Input sanitization (XSS prevention)                         │
│  ├── SQL injection: Parameterized queries (ORM)                  │
│  ├── CORS: whitelist specific origins                            │
│  ├── Helmet.js for HTTP security headers                         │
│  └── Rate limiting: 100 req/min per user                         │
│                                                                   │
│  📁 File Upload Security                                         │
│  ├── File type validation (whitelist)                            │
│  ├── File size limit (10MB per file, 250MB per board)            │
│  ├── Virus scanning (ClamAV)                                    │
│  ├── Pre-signed URLs expire after 5 minutes                     │
│  └── S3 bucket: private, no public access                       │
│                                                                   │
│  🕐 WebSocket Security                                          │
│  ├── Auth token required on connection                           │
│  ├── Board membership verified before room join                  │
│  └── Message validation & rate limiting                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 16. MONITORING & OBSERVABILITY

```
┌─────────────────────────────────────────────────────────────────┐
│                     MONITORING STACK                              │
│                                                                   │
│  ┌─── Metrics (Prometheus + Grafana) ──────────────┐            │
│  │  • API response time (p50, p95, p99)            │            │
│  │  • WebSocket connections count                   │            │
│  │  • Database query duration                       │            │
│  │  • Cache hit/miss ratio                         │            │
│  │  • Error rate by endpoint                       │            │
│  │  • Active boards / concurrent users             │            │
│  └─────────────────────────────────────────────────┘            │
│                                                                   │
│  ┌─── Logging (ELK Stack) ────────────────────────┐             │
│  │  • Structured JSON logs                         │            │
│  │  • Request/Response logging                     │            │
│  │  • Error tracking with stack traces             │            │
│  │  • Audit trail for sensitive actions            │            │
│  └─────────────────────────────────────────────────┘            │
│                                                                   │
│  ┌─── Alerting ───────────────────────────────────┐             │
│  │  🔴 Critical: API error rate > 5%               │            │
│  │  🔴 Critical: DB connection pool exhausted      │            │
│  │  🟡 Warning:  Response time p95 > 500ms         │            │
│  │  🟡 Warning:  WebSocket reconnection spike      │            │
│  │  🟢 Info:     Deploy completed                  │            │
│  └─────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## TÓM TẮT

| Component | Technology | Lý do |
|-----------|-----------|-------|
| **Frontend** | nextJS + TypeScript | Component-based, ecosystem lớn |
| **Database** | PostgreSQL | ACID, JSONB, mature |
| **Cache** | Redis | Fast, Pub/Sub, data structures |
| **Real-time** | Socket.IO + Redis Adapter | Cross-server broadcasting |
| **Search** | Elasticsearch | Full-text search, filtering |
| **File Storage** | S3 | Scalable, cheap, pre-signed URLs |
| **Message Queue** | Kafka/BullMQ | Async processing, decoupling |
| **Ordering** | Fractional Indexing | O(1) reorder, no cascade updates |

> 💡 **MVP Approach**: Bắt đầu với **monolith** (NestJS), PostgreSQL, Redis, Socket.IO. Tách microservices khi scale lên. Elasticsearch và Kafka thêm khi cần thiết.