# Gacha Arcade — v0.1.3

A local, simulated Lorcana collectible arcade using the owner's original pixel art. Built with Next.js, TypeScript, and React; fonts and artwork are served locally.

## Run

```powershell
npm install --cache .npm-cache
npm run dev
```

Open http://127.0.0.1:3000. The server listens on loopback only. Admin login requires the server-only variables documented in `.env.example`; no wallet or payment credentials are used.

## Current release: v0.1.3

The visible release label is sourced from the `version` field in `package.json`; the npm lockfile must stay synchronized with it. For each published update, increment the patch version once, make the matching version commit, create the matching Git tag, and publish the matching GitHub release. Use a minor version only for a larger milestone explicitly requested by the owner. The numbered implementation history remains in `docs/v0.1.0-beta.md`.

Current iteration: **v0.1.0-15 — Redemption and shipping state**. The next routine update will be **v0.1.4**; the next larger milestone will be **v0.2.0**.

## Simulation experience (ticket v0.1.0-11)

The simulation uses a public fixture of 14 Lorcana sets, with 100 fictional packs in every set (1,400 fictional packs total). View a machine’s remaining sample stock and per-set odds in the pool popup, or inspect all sample stock there. Pulls reserve one pack; demo resale returns it, while keeping and shipping previews leave it reserved. Stock and credits are local to each browser. See `docs/inventory-seed.md` for the public fixture and simulation rules.

The arcade is a single-screen hero: the machine scene and pull controls share the available viewport height, with sample prize details opened from the machine panel. Portrait phones use a compact control bar. Inventory and dialogs retain scrolling when their contents need more room; short landscape screens allow page scrolling to keep controls accessible.

The complete interface now uses VT323 for readable pixel text, Press Start 2P for game headings, original crisp 16×16 SVG icons, hard-edged frames and buttons, and a slate-blue/cyan/purple/gold/mint palette matched to the supplied artwork. Visual tokens and the shared skin live in `app/pixel-theme.css`; structural layouts live in `app/globals.css`.

- Common / Rare / Epic machines with the supplied sprite artwork.
- Animated claw sequence, skip reveal, optional synthesized sound, reduced-motion support.
- 250 starting demo credits; sample pulls cost 10 / 25 / 60 credits.
- Keep packs, resell for 80% of demo value in play credits, or preview shipping.
- Browser-local inventory/history, player collection filters/search/sort, reset control, and mobile layout. Local state is versioned and syncs between tabs; there is no shared server analytics.

An `/admin` view is protected by server-side password verification using `ADMIN_PASSWORD_SALT`, `ADMIN_PASSWORD_HASH` (64 scrypt bytes encoded as 128 hex characters), and `ADMIN_SESSION_SECRET`. Exact warehouse inventory is available only to an authenticated local development admin when `ADMIN_LOCAL_INVENTORY=1`; production keeps it disabled. Public stock remains fictional (“Ghost”) sample stock. Admin stats are same-browser demo values: online 0/1, browser players 0/1, total and per-machine pulls, revenue in CR, sellbacks, redemptions, and shipping requests. Profit displays “Costs not set” until costs are provided.

All values, odds, and transactions are simulations. No wallet connection, real payments, payout, address collection, physical stock reservation, or shipment occurs. Redemption state is simulated as held → redeemed → queued → shipping. Queuing is available immediately; only the simulated shipping action unlocks from day 60 onward. The admin demo clock previews this rule; the actual launch date is unset. Storage v4 preserves the previous v3 session and migrates old shipping previews into queued requests.

`pixelart/` contains untouched original artwork. `public/pixelart/` contains copies used by the app. Machines use 62×92 cells from 4×6 sheets; claw sequences use 114×110 cells from 5×18 sheets. The supplied Rare machine artwork itself reads LEVEL 3 and Epic reads LEVEL 2; the UI follows the source filenames until the owner confirms the intended mapping.

## Checks

```powershell
npm run typecheck
npm test
npm run build
```

The production homepage is prerendered. Browser smoke path: select each machine → preview prizes → pull → keep or resell → inventory → preview shipping → history → reload. Check viewport fit on desktop and portrait phones, keyboard access, and the insufficient-credit/reset state.

v0.1.3 verification: typecheck, 25 tests, and production build passed. Browser checks covered login/logout, stock views, collection history, redemption, queueing, the day-60 unlock, shipping status, tab synchronization, and phone layout. Production runtime checks confirmed unauthorized inventory returns 401 and authorized production access never returns the local warehouse file. Client bundles and deployment traces contain no admin secrets or private inventory files.

## Next iteration

Review the arcade layout, collection flow, and redemption state first. Actual prize lists, prices, resale policy, network/token, launch date, and shipping scope can be added later. See `docs/v0.1.0-beta.md` for the ticket history and open decisions.

## Vercel setup

The intended GitHub repository is `https://github.com/kairo8080/gacha`. Push the application source to the repository root before importing/deploying it. The source needs `package.json`, the lockfile, `app/`, `components/`, `lib/`, `public/`, and the root configuration files. Do not commit `node_modules/`, `.next/`, `.npm-cache/`, `.local/`, or credentials.

- Application / Framework Preset: **Next.js**.
- Root Directory: **./** (repository root).
- Build Command: keep the preset default; `npm run build` also works.
- Output Directory: keep the Next.js preset default; do not set `out` or `dist`.
- Install Command: keep the default; the committed npm lockfile provides dependency resolution.
- Environment Variables: configure the three admin session/password variables in Vercel to enable admin login; keep local physical inventory local and leave `ADMIN_LOCAL_INVENTORY=1` disabled in production.
- A purchased domain is optional; Vercel provides generated `.vercel.app` addresses.

`vercel.json` declares the Next.js framework. All behavior remains simulated when deployed. Original editing/reference exports under `pixelart/` are optional for running the app; its required artwork is copied under `public/pixelart/`.
