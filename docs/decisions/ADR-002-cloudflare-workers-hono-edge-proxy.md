# ADR-002: Use Cloudflare Workers (Hono) for the Serverless AI Proxy & Quota Engine

## Status
Accepted

## Date
2026-11-06

## Context
End users of SelectCheck should not have to create an OpenAI developer account or manage an `OPENAI_API_KEY` locally. Instead, the desktop app needs a cloud backend that:
- Secures the `OPENAI_API_KEY` server-side.
- Responds with minimal network overhead from any geographic region when a user clicks the Floating Ball.
- Provides frictionless onboarding with a free daily device quota (`10 checks/day`) and a higher tier (`100 checks/day`) when signed in.

## Decision
Use **Cloudflare Workers** with the **Hono** TypeScript framework (`apps/api`), backed by **Cloudflare KV** (`QUOTA_KV`) for atomic daily rate-limit counters, **Cloudflare D1** (`DB`) for usage logging, and `HS256` JWT verification (`hono/jwt`) with optional **Supabase Auth** Email OTP integration.

## Alternatives Considered

### Traditional Long-Running Node.js / Express Server (Docker / VPS)
- **Pros**: Familiar Node.js runtime; easy local stateful debugging.
- **Cons**: Single-region deployment adds round-trip latency for global desktop users; requires server maintenance and idle hosting costs.
- **Rejected**: Edge functions start in `<5ms` globally with zero idle cost.

### Client-Side Bring-Your-Own-Key (BYOK) Only
- **Pros**: No backend infrastructure required.
- **Cons**: High onboarding friction for non-technical desktop users who don't have an OpenAI API key.
- **Rejected**: Product requirement specifies a zero-key experience for end users with a free daily trial.

## Consequences
- **Positive**: Hono runs identically on Cloudflare Workers in production (`wrangler deploy`), in Vitest unit tests (`app.request()`), and in local Node development (`@hono/node-server` via `pnpm dev:api`).
- **Positive**: Daily quotas reset automatically at midnight UTC using date-partitioned KV keys (`quota:{actorId}:{YYYY-MM-DD}`) with a 26-hour TTL.
