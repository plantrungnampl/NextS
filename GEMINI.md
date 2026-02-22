# GEMINI.md - NextS Project Context

## Project Overview
NextS is a production-grade, Trello-inspired task management application designed for high performance and scalability. It features multi-tenant isolation, drag-and-drop kanban boards, and real-time collaboration.

- **Core Technologies:** Next.js 16 (App Router), React 19, Supabase (Auth, DB, RLS, Realtime), Tailwind CSS 4.
- **Key Patterns:** Feature-first modular architecture, Multi-tenant routing (`/w/{workspaceSlug}/...`), Optimistic UI, and Row-Level Security (RLS).
- **Design Philosophy:** Desktop-first, interactive, and "alive" UI with micro-animations.

## Technical Stack
- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Backend/DB:** [Supabase](https://supabase.com/) (PostgreSQL + RLS)
- **State Management:** [TanStack Query](https://tanstack.com/query) (React Query)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/)
- **UI Components:** [Radix UI](https://www.radix-ui.com/), [Shadcn UI](https://ui.shadcn.com/), [Lucide React](https://lucide.dev/)
- **Forms & Validation:** [React Hook Form](https://react-hook-form.com/), [Zod](https://zod.dev/)
- **Drag & Drop:** [@dnd-kit](https://dnd-kit.com/)
- **Testing:** [Playwright](https://playwright.dev/) (E2E)

## Project Structure (nexts-app/)
- `src/app/`: Thin Next.js App Router entrypoints.
- `src/features/`: Business domain modules (e.g., `home`). Each module contains its own components, hooks, types, and logic.
- `src/core/`: Global infrastructure, configuration, and routing (no dependency on features).
- `src/shared/`: Cross-feature primitives and helpers.
- `supabase/migrations/`: Database schema and RLS policies.
- `e2e/`: Playwright E2E test suites.

## Building and Running
All commands should be executed within the `nexts-app/` directory:

- **Development:** `npm run dev` (Starts server at `http://localhost:3000`)
- **Build:** `npm run build` (Production build)
- **Linting:** `npm run lint` (ESLint + TypeScript checks)
- **E2E Testing:** `npm run test:e2e` (Requires `.env` with test credentials)
- **Database:** Supabase CLI is used for migrations and local development.

## Development Conventions & Mandates
1. **Architecture Guardrails:**
   - Follow strict dependency direction: `app -> features -> shared`.
   - `core` is infra-only and cannot depend on `app` or `features`.
   - Max 500 lines per file; max 120 lines per function.
2. **UI/UX Excellence:**
   - Use `ui-ux-pro-max` skill for design guidance.
   - Use `sonner` for notifications and `framer-motion` for interactions.
   - Prefer Shadcn UI components.
3. **Security:**
   - **Never leak data:** Multi-tenancy is enforced via `workspace_id` and Supabase RLS.
   - Validate all server-side inputs.
4. **Context & Memory:**
   - Consult `CONTINUITY.md` for current task state and recent history.
   - Use Graphiti MCP to store and retrieve long-term project knowledge and decisions.
5. **Coding Style:**
   - TypeScript strict mode.
   - PascalCase for components, camelCase for variables/functions.
   - Double quotes, 2-space indentation.

## Key References
- `DESIGN.md`: Visual and UX specifications.
- `trello-system-design/`: Comprehensive architectural and data model documentation.
- `AGENTS.md`: Repository-specific agent instructions and rules.
