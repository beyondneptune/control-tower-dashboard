# Control Tower & Dashboard

A role‑based **operations & finance "control tower"** for a mid‑sized manufacturing SME —
a single pane of glass over **cash, orders, production, quality, stores, purchasing,
dispatch, billing, collections, vendor payments, bank debt and payroll**, with every job
traceable end‑to‑end:

```
Quote → Customer PO → Job → BOM → Route Card → Material Issue →
Production → QC → Dispatch → Invoice → Collection → Job Margin → Cash
```

> **Portfolio note.** This is a public, **fully anonymised** showcase build. It runs on a
> single coherent **synthetic dataset** (fictional company "Meridian Alloys", fictional
> customers, suppliers and people). No real company data, credentials, or third‑party
> information is present. It demonstrates the architecture and engineering, not any real
> business's numbers.

---

## Why it's interesting

The hard part of a finance dashboard isn't the charts — it's **trustworthy numbers**. So
all arithmetic is isolated in a **pure‑TypeScript financial engine** (`src/domain/calc/`)
that is **unit‑tested in isolation**; the UI never re‑implements a calculation, and
**unknown inputs render "Data required", never a misleading zero.**

- **Verified calc core** — ageing, collections, cash runway, margin, alerts and validation
  are pure functions with their own tests (**50 passing**, `npm test`).
- **Role‑based access (RBAC)** — MD / Finance / Production / Quality / Stores / Purchase
  views, enforced by a small tested policy layer (`src/domain/rbac.ts`).
- **Maker‑checker** — sensitive actions (payments, overrides) are modelled as propose →
  approve, with an audit trail.
- **Honest data quality** — the dashboards surface *missing/ambiguous* data explicitly
  rather than papering over gaps.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, React 19, Turbopack) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 (CSS‑first tokens) |
| Components | shadcn/ui (Radix) |
| Charts | Recharts 3 |
| Forms / validation | React Hook Form + Zod |
| Tests | Vitest |
| Backend (planned) | Supabase (Postgres, RLS, server actions) — keys via env only |

## Run it

```bash
npm install
npm run dev        # http://localhost:3000  (runs on the built-in demo dataset)
npm test           # the financial-engine unit tests
npm run typecheck  # strict TypeScript
```

No environment variables are needed for the demo — the UI renders from the in‑memory
synthetic dataset in `src/data/`. Supabase keys (for the planned backend) are read from
the environment only; see `.env.example`.

## Project shape

```
src/
  app/        route-per-domain App Router pages (cash, orders, production, quality,
              stores, purchase, dispatch-billing, collections, finance, people-payroll,
              bank-debt, risk, alerts, audit-log, …)
  domain/
    calc/     the pure, unit-tested financial engine (ageing, cash, collections,
              margin, alerts, validation) — the heart of the project
    rbac.ts   tested role/permission policy
    types.ts  the domain model
  data/       the coherent synthetic demo dataset (replaced by Supabase queries later)
  components/ shadcn/ui kit + dashboard views + app shell
  lib/        formatting, status, Supabase client scaffolding (env-only)
```

## Status

**Sprint 1 — UI‑first on demo data (this repo):** complete, clickable, role‑based UI on a
coherent dataset, backed by the verified calc engine. Supabase auth/RLS, server actions,
maker‑checker enforcement, the live alert engine and spreadsheet imports are the Sprint 2/3
scope.

*Built with the help of [Claude Code](https://claude.com/claude-code).*
