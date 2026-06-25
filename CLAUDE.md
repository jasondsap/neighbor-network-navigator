# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A community resource navigation tool for Louisville Neighbor Network / South Louisville Community Ministries (SLCM). Navigators search ~300+ local resources, blend in live SAMHSA treatment facilities, get AI guidance, and report data-quality problems. Admins curate the resource database with full version history.

## Commands

```bash
npm run dev      # next dev — local development
npm run build    # next build — production build (also the typecheck gate; there is no separate `tsc` script)
npm start        # next start — serve the production build
npm run lint     # eslint (flat config in eslint.config.mjs)
```

There is **no test runner** configured — don't assume `npm test` exists. `tsx` is installed for running ad-hoc TS scripts but no `scripts/` directory is committed.

## Stack reality vs. README

The README and some dependencies are **stale/misleading** — trust the code, not the README:

- **Database is Neon serverless Postgres**, not Supabase. All data access goes through `lib/db.ts` (`@neondatabase/serverless`). The `@supabase/*` packages in `package.json` are leftovers and not used by the data layer. Connection comes from `DATABASE_URL`, not the `NEXT_PUBLIC_SUPABASE_*` vars the README lists.
- **Auth is NextAuth v4 with AWS Cognito** (`lib/auth-options.ts`), not generic Supabase auth. JWT session strategy, 8-hour expiry.

### Environment variables actually used

```
DATABASE_URL              # Neon Postgres connection string
NEXTAUTH_SECRET           # NextAuth JWT signing
COGNITO_CLIENT_ID
COGNITO_CLIENT_SECRET
COGNITO_ISSUER
OPENAI_API_KEY            # Resource Assistant (gpt-4o)
RESEND_API_KEY            # Resend — welcome email on admin user creation (lib/email/resend.ts)
RESEND_FROM_EMAIL         # verified sender, e.g. "Louisville Neighbor Network <no-reply@yourdomain.org>"
# Google Maps key for @react-google-maps/api (see app/components/ResourceMap.tsx)
```

## Architecture

Next.js 15 App Router, React 19, TypeScript (strict), Tailwind v4. Path alias `@/*` maps to the repo root. There are two distinct surfaces: the **navigator-facing app** (`app/`) and the **admin console** (`app/admin/`).

### Auth model (two layers — important)

1. **Edge middleware** (`middleware.ts`) guards `/admin/*` and `/api/admin/*`. It only checks that a NextAuth JWT cookie exists (via `getToken`) — it deliberately does **not** hit the DB so it stays edge-compatible. UI routes redirect to `/auth/signin`; API routes return 401 JSON.
2. **Server-side role check** runs inside each admin route/layout. `requireAdmin()` (`lib/admin.ts`) re-fetches the user and verifies `role === 'admin'`, throwing `NotAdminError` (→ 403) vs. `'Unauthorized'` (→ 401). `app/admin/layout.tsx` calls `tryRequireAdmin()` and redirects non-admins to `/admin/unauthorized` before rendering, preventing flash-of-unauth-content.

Non-admin API routes gate with `requireAuth()` (`lib/auth.ts`), which throws `'Unauthorized'` — the pattern is `try { await requireAuth() } catch { return 401 }` at the top of each handler.

**User identity mapping:** sessions carry the Cognito `sub`, but DB rows key on an internal `users.id` UUID. `getInternalUserId(cognitoSub, email)` resolves it and self-heals by backfilling `cognito_sub` when a user is matched by email. Always resolve to the internal UUID before touching user-scoped tables.

### Data layer (`lib/db.ts`)

- `sql` is a **Proxy** wrapping a lazily-initialized Neon client (env may be absent at module-load time on Amplify/Lambda). It supports both tagged-template form (`` sql`SELECT ...` ``) and property access (`sql.query`, `sql.transaction`).
- For **parameterized dynamic queries**, use the `query()` / `queryOne()` helpers — they call `sql.query(text, params)` because Neon driver v1+ removed the old `sql(text, params)` call form. Tagged templates are fine for static queries.
- Generic CRUD helpers: `insert`, `update` (auto-sets `updated_at`), `softDelete` (sets `is_active = FALSE`), `hardDelete`. Soft-delete/`is_active` is the convention — most reads filter `WHERE is_active = TRUE`.
- `searchResources()` builds SQL dynamically with placeholders and ranks via Postgres full-text (`search_vector @@ plainto_tsquery`) with an `ILIKE` fallback on org name.
- `logAuditEvent()` writes to `audit_log` and **never throws** — audit failures must not break requests.

### Resource versioning (admin edits)

Resource edits are snapshotted by a **Postgres trigger** (`fn_snapshot_resource`) into `resource_versions`. The trigger reads editor metadata from transaction-local session vars. To set them, `lib/resource-admin.ts` `buildEditorContextStatements()` emits `set_config('app.editor_id'/'app.edit_summary'/'app.edit_kind', ..., true)` statements, and the route runs them **in the same `sql.transaction([...])` batch** as the UPDATE (Neon serverless can't span `BEGIN/COMMIT` across awaits). See `app/api/admin/resources/[id]/route.ts` for the canonical PUT/DELETE pattern. An `edit_summary` is required on every mutating admin action, including archive.

### Three data domains

Each has a shared lib module of canonical option/status vocabulary used by both the user-facing modal and the admin queue, plus a validation function:

- **Resources** — `lib/resource-admin.ts` (validation), versioning above. Admin CRUD under `app/api/admin/resources/`.
- **Flags** (`lib/flags.ts`) — user-reported data errors (wrong phone, closed, etc.). Submitted via `FlagResourceModal`, triaged in `app/admin/flags/`.
- **Access reports** (`lib/access-reports.ts`) — structured "I couldn't get my client this resource" reports (barriers, attempt methods, outcomes; multi-selects stored as JSONB arrays). Submitted via `UnableToAccessModal`, triaged in `app/admin/access-reports/`.

When adding/changing an option or status for flags or access reports, edit the canonical array in the corresponding lib file — labels, validation, and admin filters all derive from it.

### Admin user management & Cognito provisioning

The admin Users panel (`app/admin/users/`, `app/api/admin/users/`) creates app users and their Cognito logins together. Two groups: `role='admin'` ("Admin User") and `role='navigator'` ("User") — the only two roles the app uses; the admin gate is `role === 'admin'`.

`lib/cognito.ts` wraps the Cognito admin API (`provisionCognitoLogin`, `disableCognitoLogin`). Region + pool ID are parsed from `COGNITO_ISSUER` (not a generic AWS region). New logins use `MessageAction: 'SUPPRESS'` (no email), pre-verified email, and shared temp password `Slcm!1234` (override via `COGNITO_DEFAULT_TEMP_PASSWORD`).

**Gotcha — create order:** `users.cognito_sub` is `NOT NULL + UNIQUE`, so creation provisions Cognito **first**, then inserts the DB row with the returned `sub`. If provisioning fails (or returns no `sub`), no row is written. This is the opposite of DDOR's nullable-`cognito_sub`/best-effort flow. Removal hard-deletes the row (there is no `is_active` on users) and best-effort *disables* the Cognito login. Admins can't demote or delete their own account.

**Deployment is Vercel** (not Amplify) — there's no attached AWS IAM role, so the SDK default provider chain finds no credentials. `COGNITO_ADMIN_ACCESS_KEY_ID` / `COGNITO_ADMIN_SECRET_ACCESS_KEY` must be set in Vercel env (and locally), belonging to an IAM **user** with `cognito-idp:AdminCreateUser`, `AdminGetUser`, and `AdminDisableUser` on the pool (legacy `APP_AWS_*` names are accepted as a fallback). A non-`AWS_` prefix is intentional — Vercel/Lambda reserve the bare `AWS_` prefix. Without these keys, provisioning fails with "Missing credentials".

### External integrations

- **SAMHSA** (`app/api/resource-search/route.ts`) — live `findtreatment.gov` API, merged with local Neon results. Only included when the query/category looks treatment-related (`shouldIncludeSAMHSA`). Results are normalized to the same shape as local rows with `source: 'SAMHSA'` vs `source: 'Local'`; local sorts first.
- **OpenAI** (`app/api/resource-assistant/route.ts`) — gpt-4o, returns strict JSON (summary, recommended resources, next steps, advocacy script, barriers). The prompt forbids inventing org names/contacts not in the passed-in matched resources; there's a markdown-fence-stripping + parse-fallback guard around the response.
- **Google Maps** — `app/components/ResourceMap.tsx`, dynamically imported with `ssr: false` to avoid SSR issues. Transit/bus directions via `app/api/transit-directions/route.ts` + `BusDirectionsModal`.

## Conventions

- API route files open with a block comment documenting the endpoint's purpose, params, and response shape — keep this when adding routes.
- Brand colors appear as hard-coded hex throughout (Blue `#2E4A8E`, Gold `#E8B84A`, Red `#8B2332`, Teal `#2A8B8B`); status colors live alongside their status definitions in the lib files.
- Dynamic route params are async in Next 15: `{ params }: { params: Promise<{ id: string }> }` then `await params`.
