# 08 — Roadmap (Priority & Milestones)

## Milestone 0 — Foundation (1–3 ngày)
- Setup Next.js App Router + TypeScript
- Setup Supabase: Auth, DB schema, RLS base
- Core layouts + routing: auth/app separation
- Minimal UI kit (Tailwind + shadcn/radix)

## Milestone 1 — MVP Board (3–7 ngày)
- Workspace create + member table
- Board CRUD
- List CRUD + reorder
- Card CRUD + move/reorder
- Activity log tối thiểu
- Basic permissions
- E2E tests happy path

**MVP release criteria**
- 0 critical RLS leak
- DnD stable, rollback ok

## Milestone 2 — Collaboration (1–2 tuần)
- Realtime sync (broadcast or Postgres changes)
- Presence
- Better optimistic conflict handling

## Milestone 3 — Card richness (2–4 tuần)
- Comments
- Labels
- Assignees
- Attachments (Storage)
- Search

## Milestone 4 — Product hardening (ongoing)
- Rate limiting
- Monitoring dashboards + alert
- Performance: virtualization, query optimization
- Billing/Plans (nếu SaaS)

## Risks & mitigations
1) **RLS sai** → viết tests cho RLS, audit policy, use helper functions.
2) **Reorder conflict** → versioning + server canonical + occasional renormalize.
3) **Realtime scale** → ưu tiên broadcast events, hạn chế subscribe raw table.
4) **Board rất lớn** → virtualization + pagination + partial loading.
