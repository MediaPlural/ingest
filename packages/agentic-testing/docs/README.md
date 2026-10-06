# Refurb

AI-powered platform for homeowner services — from ad creative to contractor matching.

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 15+ with pgvector extension
- (Optional) n8n instance for agent orchestration

### Setup

1. **Clone and install:**

   ```bash
   git clone <repo>
   cd refurb
   pnpm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your database URL and API keys
   ```

3. **Set up database:**

   First, ensure pgvector is installed in your Postgres:

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

   Then run the migration:

   ```bash
   pnpm db:push
   ```

4. **Start development:**
   ```bash
   pnpm dev
   ```

## Project Structure

```
/refurb
├── packages/
│   └── schema/           ← Database schema (source of truth)
├── apps/
│   └── dashboard/        ← Hook Genie + Review Dashboard (coming soon)
├── agents/
│   └── prompts/          ← Agent system prompts (coming soon)
└── docs/
    └── PRD.md            ← Product requirements
```

## Database

The schema is managed with Drizzle ORM. All apps import from `@refurb/schema`.

```bash
# Generate migration files
pnpm db:generate

# Push schema to database (dev)
pnpm db:push

# Run migrations (prod)
pnpm db:migrate

# Open Drizzle Studio (database GUI)
pnpm db:studio
```

## Documentation

- [PRD](./docs/PRD.md) — Product requirements and architecture
- [Schema](./packages/schema/src/index.ts) — Database tables and types

## Phase 1 Scope

1. **Database foundation** — 25 tables covering hooks, ads, customers, interactions
2. **Hook Genie** — Input → Process → Estimate → Review flow
3. **Review Dashboard** — Human review with structured feedback
4. **n8n Integration** — Webhook-based agent orchestration

## Tech Stack

- **Monorepo:** Turborepo + pnpm
- **Database:** PostgreSQL + pgvector + Drizzle ORM
- **Frontend:** React + Vite + Tailwind
- **Backend:** Express/Fastify
- **Agents:** n8n + OpenAI
- **Hosting:** Vercel (apps) + Railway (db, n8n)
