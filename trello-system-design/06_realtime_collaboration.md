# 06 — Realtime & Collaboration

## 1) Mục tiêu realtime
- Người A kéo card → người B thấy thay đổi gần như tức thì
- Presence: đang có ai mở board
- Giảm “đạp nhau” (conflict) khi nhiều người chỉnh

## 2) Approaches
### Option A — Postgres Changes (dễ MVP)
- Subscribe table changes (INSERT/UPDATE/DELETE) cho `cards`, `lists`, `comments`
- Pros: setup nhanh
- Cons:
  - Nhiều event “thô” (raw row changes), client phải tự suy luận
  - Scale có thể kém hơn khi board rất active
  - Cần cẩn thận về security/filtering

### Option B — Broadcast Events + Presence (khuyến nghị product)
- Khi mutation xảy ra, server action publish event dạng domain:
  - `card_created`
  - `card_updated`
  - `card_moved`
  - `list_reordered`
  - `card_archived`
- Client apply event vào state
- Presence:
  - channel presence state: `{userId, name, avatar, lastActiveAt}`

**Rule:** DB vẫn là source of truth, broadcast chỉ để sync UI nhanh.

## 3) Event schema (gợi ý)
```json
{
  "type": "card_moved",
  "boardId": "uuid",
  "actorId": "uuid",
  "payload": {
    "cardId": "uuid",
    "fromListId": "uuid",
    "toListId": "uuid",
    "newPosition": "numeric",
    "version": 12
  },
  "ts": "2026-02-16T00:00:00Z"
}
```

## 4) Conflict resolution
### 4.1 Optimistic concurrency
- Card có `version`:
  - Update/move yêu cầu `expectedVersion`
  - Server update: `WHERE id = $cardId AND version = $expectedVersion`
  - Thành công: version++
  - Fail: 0 rows → 409 conflict

### 4.2 Client behavior khi conflict
- Nếu conflict khi kéo:
  - Refetch list (hoặc board snapshot)
  - Apply lại move nếu user vẫn muốn (optional)

## 5) Presence UX
- Avatar stack “Currently viewing”
- Hiển thị “X is editing card …” (optional)
- Cursor tracking (v2)

## 6) Performance tactics
- Debounce typing (card title editing)
- Batch updates (multi-card move)
- Coalesce events: nếu drag liên tục, chỉ commit cuối cùng
