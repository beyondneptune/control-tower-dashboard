# Control Tower & Dashboard — project instructions

A role‑based operations & finance control tower for a manufacturing SME, built with
Next.js 16 + TypeScript. **Public, anonymised showcase build** running on a synthetic
demo dataset (fictional company, customers, suppliers, people — no real data).

## Invariants (do not break)

- **All arithmetic lives in `src/domain/calc/`** (pure functions, unit‑tested). The UI must
  never re‑implement a calculation — always call the engine. Keep `npm test` green.
- **Unknown inputs render "Data required", never 0** — don't fabricate numbers.
- **No real data, ever.** The demo dataset in `src/data/` is entirely synthetic. Never add
  real company names, customers, suppliers, people, GSTINs, or figures.
- **Secrets via env only.** Supabase keys come from the environment (`.env.local`, which is
  gitignored). Never hardcode URLs or keys; never commit `.env.local`.
- **RBAC + maker‑checker** are part of the model — respect `src/domain/rbac.ts` and the
  propose→approve flow for sensitive actions.

## Commands

```bash
npm run dev        # dev server on demo data
npm test           # vitest — the financial engine
npm run typecheck  # tsc --noEmit (strict)
npm run build      # next build
```

## Layout

```
src/domain/calc/  pure, tested financial engine (the core)
src/domain/       rbac, types, link methods
src/data/         synthetic demo dataset
src/app/          App Router pages, one per operating domain
src/components/   shadcn/ui kit + dashboards + shell
src/lib/          formatting, status, Supabase scaffolding (env-only)
```
