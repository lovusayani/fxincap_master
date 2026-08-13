# Live Trade Platform Audit

Date: 2026-08-13

Target: https://trade.ncapfx.com/

This is a read-only audit of the live trade platform, source-code wiring, API routes, WebSocket
market-data path, and related admin settings.

## Live deployment

- The live trade site responds successfully.
- The live frontend bundle is outdated and still contains the old system-theme fallback.
- The latest dark-theme fix from the repository is not present in the deployed bundle.
- The frontend bundle uses `https://api.ncapfx.com` as its REST API host.
- Some `/api/*` requests made against `trade.ncapfx.com` return the trade SPA instead of the API.

## Frontend pages and wiring

| Page | Route | Main wiring |
| --- | --- | --- |
| Login | `/login` | Login API |
| Register | `/register` | Registration, verification, and resend APIs |
| Dashboard | `/` | Profile, demo/real balances, and transactions |
| Markets | `/markets` | Market stream, prices, orders, and open trades |
| Terminal | `/terminal` | Market stream, balance, orders, and open trades |
| Portfolio | `/portfolio` | Positions, orders, and close-position APIs |
| Positions | `/positions` | Open and close position APIs |
| History | `/history` | Trade-history API |
| Wallet | `/wallet` | Balance, deposit offers, and fund requests |
| Deposit | `/deposit` | Payment config, offers, promo validation, and fund request |
| Withdraw | `/withdraw` | Fund-request API |
| Profile | `/profile` | Read/update profile |
| Settings | `/settings` | Accounts, account types, and account activation |
| Support | `/support` | Support API |
| IB | `/ib` | IB status and application APIs |
| MAM/PAMM | `/mampamm` | Masters, applications, follow/unfollow, subscriptions, and trades |
| TradeMaster | `/trademaster` | Page exists; authenticated runtime testing remains required |
| Strategy | `/strategy` | Page exists; authenticated runtime testing remains required |
| MT5 | `/mt5` | Page exists; authenticated runtime testing remains required |
| Auto login | `/auto-login` | Token-based login redirect |

## API status

- `https://api.ncapfx.com/api/docs` responds successfully.
- The public prices endpoint responds successfully.
- The public style-settings endpoint responds successfully.
- The live style settings currently return `themeMode: "default"`, `topbarBgColor: "blue"`, and
  `shadcnTheme: "cyan"`.
- With the old frontend bundle, `themeMode: "default"` uses the browser/system theme and can
  therefore produce a light interface.

## WebSocket market-data wiring

The frontend defaults to:

```text
wss://trade.ncapfx.com:4040/stream
```

Port `4040` was not reachable externally during the audit. This means live WebSocket updates may
not work from a browser, leaving Markets and Terminal dependent on HTTP quote fallback.

Recommended production wiring is either:

- expose the WebSocket through TLS/nginx at a public URL such as `wss://ws.ncapfx.com/stream`; or
- provide a public `VITE_WS_STREAM_URL` during the trade frontend build.

## Data concern

The live API returned a suspiciously similar fallback value for `XAUUSD` and forex prices. The live
Infoway/provider configuration should be checked to confirm that symbol routing and quote data are
correct.

## Admin wiring

- The admin application reads and saves platform style settings.
- The trade frontend reads `/api/admin/style-settings`.
- Admin settings include theme mode, topbar color, Shadcn theme, logos, and platform name.
- `themeMode: "default"` remains supported and allows the old frontend to use the system preference.
- After the new frontend is deployed, set the admin theme explicitly to `dark` for a guaranteed dark
  platform.

## Validation performed

- Trade TypeScript check: passed.
- WebSocket tests: 27 passed.
- Trade test command: failed because no test files were found.
- API validation was blocked by pnpm's ignored `esbuild` build scripts.
- Authenticated page interaction was not performed because no authenticated browser session was
  available.

## Priority actions

1. Deploy the latest trade frontend bundle.
2. Set production `.deploy.env` to `DEPLOY_BRANCH=main`.
3. Confirm the GitHub webhook runs `deploy-prod.sh`.
4. Fix public WebSocket exposure for port `4040`.
5. Set the admin platform theme explicitly to `dark`.
6. Verify live XAUUSD/provider data.
7. Add or repair trade-page and API integration tests.
