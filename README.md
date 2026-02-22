# NextS App

Production-oriented Next.js App Router project with a feature-first structure for scalable growth.

## Getting Started

```bash
npm run dev
```

Open `http://localhost:3000`.

## Folder Structure

```text
src/
  app/                         # Next.js App Router entrypoints (thin)
    globals.css
    layout.tsx
    page.tsx                   # Thin entrypoint -> feature module
  core/                        # Global app config, routing, metadata, fonts
    config/
    routing/
  features/
    home/                      # Business domain module: landing/home
      components/              # Feature-local reusable UI blocks
      config/                  # Feature constants/contracts
      data/                    # Canonical content source
      lib/                     # Pure helpers/utilities
      sections/                # Route section composition units
      types/                   # Domain type contracts
      home-page.tsx            # Feature orchestrator
      index.ts                 # Feature public exports
  shared/                      # Cross-feature primitives/helpers only
    lib/
    index.ts
```

## Conventions

- Keep `src/app` minimal: compose from feature public APIs only.
- Keep one source of truth per domain (`config`, `data`, `types` inside each feature).
- Keep dependency direction strict: `app -> features -> shared`, while `core` is infra-only and cannot depend on `app/features`.
- Promote code to `shared` only when reused by at least 2 features.
- Enforce architecture guardrails in `eslint.config.mjs` (`no-restricted-imports`, file-size limits).

## Build and Quality

```bash
npm run lint
npm run build
```

## E2E Tests

Happy-path E2E tests use Playwright and require a real login account.

```bash
npm run test:e2e:list
npm run test:e2e
```

Required env vars:

- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`
- `E2E_TEST_EMAIL_2` (optional, fallback to `E2E_TEST_EMAIL`)
- `E2E_TEST_PASSWORD_2` (optional, fallback to `E2E_TEST_PASSWORD`)

The suite currently covers:
- Milestone 1 happy path flow:
- login
- create workspace
- create board
- create 2 lists
- create card
- drag card cross-list
- reorder lists
- Milestone 2 collaboration conflict flow:
- 2 sessions open same board
- both try to move the same card concurrently
- board state converges to one canonical target list on both sessions

## References

- Next.js docs: https://nextjs.org/docs
