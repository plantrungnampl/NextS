# 07 — DevOps, Testing, Observability

## 1) Environments
- `dev`: local supabase / shared dev project
- `staging`: test integration
- `prod`: production

**Config rules**
- Không bao giờ để Supabase service role key ở client.
- Secrets dùng env vars platform (Vercel/Render), không commit.

## 2) Database migrations
- Dùng Supabase CLI migrations (khuyến nghị):
  - Mọi thay đổi schema được version hoá
  - Review SQL trong PR

## 3) CI/CD (gợi ý)
- GitHub Actions:
  - lint + typecheck
  - unit tests
  - e2e tests (Playwright) chạy trên preview/staging
- Deploy:
  - preview per PR
  - staging branch
  - prod branch + manual approval

## 4) Testing strategy
### Unit tests
- Validate logic: ordering (position calculation), permission helper, parsing.

### Integration tests
- Với DB thật (staging):
  - RLS policies đúng (user A không đọc workspace B)
  - RPC reorder atomic

### E2E tests (Playwright)
- sign up → create workspace → create board/list/card → drag-drop → reload

## 5) Observability
### App monitoring
- Error tracking (Sentry) cho both server & client
- Metrics:
  - board load latency
  - mutation success/fail rate
  - realtime event lag

### Database monitoring
- Theo dõi slow query
- Logs & alerts trong Supabase dashboard

## 6) Backups & recovery (product)
- Enable daily backups + PITR (nếu cần)
- Runbook: cách restore + validate

## 7) Security hardening checklist
- CSP headers
- Rate limit login/invite endpoints
- Audit log immutable
- Email invite tokens:
  - random, single-use, expiry
- Storage signed URL cho private files
