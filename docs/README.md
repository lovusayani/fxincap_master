# FXIncap Documentation

Start at the root [README.md](../README.md) for the platform overview.

## By task

**"I'm continuing work from another PC"**
→ [DEVELOPMENT_HANDOVER.md](./DEVELOPMENT_HANDOVER.md) — current branch, what is done,
what is next, and the local `.env` you need. Start here.

**"I'm new here"**
1. [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md) — what the platform is, what it deliberately does not do
2. [ARCHITECTURE.md](./ARCHITECTURE.md) — five services and who owns what
3. [REPOSITORY_STRUCTURE.md](./REPOSITORY_STRUCTURE.md) — where things live
4. [DEVELOPMENT.md](./DEVELOPMENT.md) — get it running locally
5. [WORKFLOW.md](./WORKFLOW.md) — **read before your first change**: the
   local → test → PR → auto-deploy loop, and what a deploy actually does
6. [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) — two-PC branch conventions

**"I'm changing the market-data provider"**
1. [MARKET_DATA_ARCHITECTURE.md](./MARKET_DATA_ARCHITECTURE.md) — the pipeline and the exact
   integration point (§8)
2. [ADR/0002-market-data-provider.md](./ADR/0002-market-data-provider.md) — why it works this way
3. [WEBSOCKET.md](./WEBSOCKET.md) — the protocol consumers depend on

**"I'm touching trading or money"**
1. [TRADING_ENGINE.md](./TRADING_ENGINE.md) — order/trade lifecycle, margin, SL/TP
2. [PNL_ENGINE.md](./PNL_ENGINE.md) — P&L formulas and account state
3. [DATABASE.md](./DATABASE.md) — tables and migration reality

**"I'm deploying"**
1. [DEPLOYMENT.md](./DEPLOYMENT.md) — the webhook chain, PM2, rollback
2. [ENVIRONMENT.md](./ENVIRONMENT.md) — every variable
3. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — when it goes wrong

**"I'm reviewing security"**
1. [SECURITY.md](./SECURITY.md) — read §7 first
2. [AUTHENTICATION.md](./AUTHENTICATION.md) — the authorization gap
3. [GIT_HISTORY_AUDIT.md](./GIT_HISTORY_AUDIT.md)

## Full index

| Document | Contents |
| --- | --- |
| [DEVELOPMENT_HANDOVER.md](./DEVELOPMENT_HANDOVER.md) | **Current state**: branch, completed work, next task, local setup |
| [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md) | Responsibilities, data ownership, boundaries, failure behaviour, glossary |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Service topology, ports, request lifecycles, ownership |
| [MARKET_DATA_ARCHITECTURE.md](./MARKET_DATA_ARCHITECTURE.md) | Provider adapters, normalized quote, failover, symbol mapping, **future provider integration** |
| [TRADING_ENGINE.md](./TRADING_ENGINE.md) | Contract sizes, margin, open/close, SL/TP, auto-close |
| [PNL_ENGINE.md](./PNL_ENGINE.md) | Realized and unrealized P&L, balance/equity/margin model |
| [API.md](./API.md) | Every REST endpoint, grouped, with auth requirements |
| [WEBSOCKET.md](./WEBSOCKET.md) | `/stream` protocol, message shapes, health payload |
| [DATABASE.md](./DATABASE.md) | Tables, table creation mechanisms, indexes, migrations |
| [AUTHENTICATION.md](./AUTHENTICATION.md) | User auth, admin auth, service tokens, the authorization gap |
| [ADMIN.md](./ADMIN.md) | Admin app, proxy layer, pages, Server Settings |
| [SECURITY.md](./SECURITY.md) | Full audit, prioritized |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | DigitalOcean, PM2, webhook, monitoring, rollback |
| [ENVIRONMENT.md](./ENVIRONMENT.md) | Every environment variable per service |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Local setup, running, conventions |
| [TESTING.md](./TESTING.md) | Current state (none), manual smoke tests, where to start |
| [BASELINE.md](./BASELINE.md) | Measured build/typecheck/lint/test results |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Symptom-driven runbook |
| [REPOSITORY_STRUCTURE.md](./REPOSITORY_STRUCTURE.md) | Directory map, conventions, `.gitignore` |
| [REPOSITORY_CLEANUP.md](./REPOSITORY_CLEANUP.md) | File-by-file audit with deletion evidence |
| [GIT_WORKFLOW.md](./GIT_WORKFLOW.md) | **Two-PC workflow**, branch model, collision avoidance, recovery |
| [GIT_HISTORY_AUDIT.md](./GIT_HISTORY_AUDIT.md) | Commit and branch assessment |
| [CHANGELOG.md](./CHANGELOG.md) | Change history |
| [version-control-guide.md](./version-control-guide.md) | Pre-existing git workflow guide |
| [ADR/0001-system-architecture.md](./ADR/0001-system-architecture.md) | Why five services |
| [ADR/0002-market-data-provider.md](./ADR/0002-market-data-provider.md) | Why database-backed provider abstraction |
| [ADR/0003-production-deployment.md](./ADR/0003-production-deployment.md) | Why PM2 + webhook |

## Conventions in these documents

- Every claim is traceable to a file. Statements that cannot be verified from the repository are
  marked **`TODO: verify on production server`**.
- Business rules that are ambiguous in code are marked **`TODO: verify business rule`**.
- ⚠ marks a defect, gap or risky default. Known defects are documented, **not fixed** — see
  [CHANGELOG.md](./CHANGELOG.md).
- No credential values appear anywhere; placeholders are `YOUR_...`.
