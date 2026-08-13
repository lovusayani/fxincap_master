# ADR-0001 — Five independently deployed services in one repository

**Status:** Accepted (documented retrospectively, 2026-08-10)

## Context

FXIncap consists of a public marketing site, a trading client, an admin back-office, a REST/trading
API and a market-data feed. These have very different change rates, runtimes and audiences: the
marketing site is static and changes for campaigns; the API holds customer money; the market-data
feed maintains long-lived upstream WebSocket connections.

The repository history shows the platform was assembled from separately built applications (the
`suimfx.world` naming still present in defaults and log scripts) rather than designed as one system
up front.

## Decision

Keep five applications in a single Git repository, each with its own `package.json`, its own
`pnpm-lock.yaml` and its own PM2 process, deployed together from one webhook.

```
fxincap      :4000   Next.js marketing site
fxincaptrade :3000   React trading SPA + thin Express host
fxincapadmin :5001   React admin SPA + Express credential-injecting proxy
fxincapapi   :7000   Express REST API, trading engine, P&L, background workers
fxincapws    :4040   Market-data aggregation and fan-out
```

There is deliberately **no root workspace**: `install-prod.sh` runs `pnpm install --frozen-lockfile`
five times, once per service.

## Why

1. **Blast radius.** The market-data feed can be restarted to change provider without touching the
   API that settles trades. Conversely an API deploy does not drop live price subscriptions.
2. **Runtime isolation.** fxincapws holds stateful upstream WebSockets; fxincapapi runs polling
   workers; the marketing site is static. Different memory profiles and restart characteristics.
3. **Independent dependency graphs.** fxincaptrade is on React 18, fxincap on React 19. A shared
   workspace would force a resolution decision neither app needs.
4. **One repository, one deploy.** A single `git reset --hard` + build + PM2 restart keeps all five
   in a known-consistent state — important when the SPA's API contract and the API ship together.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Five separate repositories | Five webhooks, five deploy chains, and no atomic way to ship a frontend/API contract change together |
| A true pnpm workspace at the root | Would force a single React and TypeScript resolution across apps that legitimately differ |
| A single monolithic Express app | Loses runtime isolation; a market-data reconnect storm would affect trade settlement |
| Containers / orchestration | Disproportionate for one droplet; PM2 already provides restart, memory limits and log capture |

## Consequences

**Positive**
- Independent restart and failure isolation per service.
- fxincapws can hot-swap its market-data provider with no restart at all.
- The provider abstraction has an obvious home — see [ADR-0002](./0002-market-data-provider.md).

**Negative**
- Duplicated code across service boundaries: `database.ts` exists in three near-identical variants,
  and a second, non-functional trading engine lives in fxincaptrade.
- **Ambiguous ownership.** Both fxincapapi and fxincaptrade expose `/api/trades`, `/api/positions`
  and `/api/orders`. Only fxincapapi's work. This is the single most confusing property of the
  codebase for a newcomer — see [ARCHITECTURE.md](../ARCHITECTURE.md) §3.
- Five `pnpm install` runs make deploys slow.
- No shared type package: the API response shapes are re-declared by hand in each client.
- Port collisions prevent staging and production from sharing a host.

## Follow-ups

- Decide the fate of `fxincaptrade/server/routes/*` — either delete them (which requires proving the
  built SPA host does not need them) or clearly mark them dead.
- Consider a shared `@fxincap/types` package for API contracts.
