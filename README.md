# Gacha Arcade — v0.1.9

A local, simulated Lorcana collectible arcade using the owner's original pixel art. Built with Next.js, TypeScript, and React; fonts and artwork are served locally.

## Run

```powershell
npm install --cache .npm-cache
npm run dev
```

Open http://127.0.0.1:3000. The server listens on loopback only. Admin login requires the server-only variables documented in `.env.example`; no wallet or payment credentials are used.

## Current release: v0.1.9

The visible release label is sourced from the `version` field in `package.json`; the npm lockfile and UI must stay synchronized with it. Every completed update increments the patch version once, records a matching version commit, creates an annotated immutable Git tag, publishes a matching GitHub release, pushes the commit and tag to the configured repository's default branch, and verifies the deployed Vercel version. Previous tags and releases remain available for rollback by redeploying a tag or reverting as a new version; never force-push or rewrite tags. Use a minor version only for a larger milestone explicitly requested by the owner. The numbered implementation history remains in `docs/v0.1.0-beta.md`.

Current iteration: **v0.1.9 — Ghost catalog and compact editor**. The next routine update will be **v0.1.10**; the next larger milestone will be **v0.2.0**.

The public `/dev` route is an annotated working arcade for review. It is explicitly simulated, marked `noindex`, and contains no admin data or credentials, private stock counts, or real payments. Its browser-local demo wallet and collection follow the main simulation. UI-region labels A01–A24 update across machine, pull, result, and collection states; the label toggle is available below the hero. The extra demo/subheader and introductory copy were removed; the demo note and reset control live in the top header. Scene sizing is responsive, and the character’s tallest idle pose is sized to two-thirds of the machine’s visible artwork height after accounting for transparent sprite margins; its natural idle bob is unchanged.

## Simulation experience (tickets v0.1.0-11 and v0.1.0-21)

The simulation uses the fictional Ghost catalog and draws reward units from the configured SKU ledger. The legacy 14-set sample fixture remains documented for ticket 11 compatibility. Draws reserve one reward unit; demo resale returns it, while keeping and shipping previews leave it reserved. Stock and credits are local to each browser. See `docs/inventory-seed.md` for the fixture, catalog, and simulation rules.

The Ghost editor uses a compact inline list and form. Its official set numbering is #01–#14; Whispers in the Well is #10 and Winterspell is #11. The catalog contains 60 fictional English reward SKUs, each seeded at 100 fictional units (6,000 units total): each of the 14 sets has 1-pack, 2-pack, 3-pack, and box entries, plus D23 Collection 2026 limited foil English, sample PSA 9, sample PSA 10, and mystery entries. The shared SKU ledger may serve multiple machine IDs and tiers. One bundle or box is one reward unit; the simulation never converts physical packs into cards or other units.

Draws use the catalog. Price and value edits are browser-local and synchronize across tabs; old awards retain the price and value snapshots recorded when awarded. Cardmarket English URLs and EUR prices are manual references with a checked date, independent of CR; there is no live feed, and access may return 403. Prices default to unset. The `/en` interface alone does not prove the product is English; admin confirmation is required.

The arcade is a single-screen hero: the machine scene and pull controls share the available viewport height, with sample prize details embedded in the machine panel. Portrait phones use a compact control bar. Long tables use bounded scrolling, and mobile screens may scroll when needed to keep controls readable.

The admin dashboard keeps metrics, machine, stock, and shipping summaries visible at a glance with bounded scrolling for long tables. Player result, wallet, how-to, stock, reset, and redeem panels stay embedded in the screen. Collection confirmations use an inline card with persistent status.

The complete interface now uses VT323 for readable pixel text, Press Start 2P for game headings, original crisp 16×16 SVG icons, hard-edged frames and buttons, and a slate-blue/cyan/purple/gold/mint palette matched to the supplied artwork. Visual tokens and the shared skin live in `app/pixel-theme.css`; structural layouts live in `app/globals.css`.

- Common / Rare / Epic machines with the supplied sprite artwork.
- Animated claw sequence, skip reveal, optional synthesized sound, reduced-motion support.
- 250 starting demo credits; sample pulls cost 10 / 25 / 60 credits.
- Keep packs, resell for 80% of demo value in play credits, or preview shipping.
- Browser-local inventory/history, player collection filters/search/sort, reset control, and mobile layout. Local state is versioned and syncs between tabs; there is no shared server analytics.

An `/admin` view is protected by server-side password verification using `ADMIN_PASSWORD_SALT`, `ADMIN_PASSWORD_HASH` (64 scrypt bytes encoded as 128 hex characters), and `ADMIN_SESSION_SECRET`. Exact warehouse inventory is available only to an authenticated local development admin when `ADMIN_LOCAL_INVENTORY=1`; production keeps it disabled. Public stock remains fictional (“Ghost”) sample stock. Admin stats are same-browser demo values: online 0/1, browser players 0/1, total and per-machine pulls, revenue in CR, sellbacks, redemptions, and shipping requests. Profit displays “Costs not set” until costs are provided.

All values, odds, and transactions are simulations. No wallet connection, real payments, payout, address collection, physical stock reservation, or shipment occurs. Redemption state is simulated as held → redeemed → queued → shipping. Queuing is available immediately; only the simulated shipping action unlocks from day 60 onward. The admin demo clock previews this rule; the actual launch date is unset. Storage v5 preserves v4 and v3 history. Reset clears the session and replenishes configured fictional stock while preserving the admin catalog. Keep exact private counts in ignored `.local/` files; no real stock or payments are represented.

`pixelart/` contains untouched original artwork. `public/pixelart/` contains copies used by the app. Machines use 62×92 cells from 4×6 sheets; claw sequences use 114×110 cells from 5×18 sheets. The supplied Rare machine artwork itself reads LEVEL 3 and Epic reads LEVEL 2; the UI follows the source filenames until the owner confirms the intended mapping.

## Checks

```powershell
npm run typecheck
npm test
npm run build
```

The production homepage is prerendered. Browser smoke path: select each machine → preview prizes → pull → keep or resell → inventory → preview shipping → history → reload. Check viewport fit on desktop and portrait phones, keyboard access, and the insufficient-credit/reset state.

v0.1.3 verification: typecheck, 25 tests, and production build passed. Browser checks covered login/logout, stock views, collection history, redemption, queueing, the day-60 unlock, shipping status, tab synchronization, and phone layout. Production runtime checks confirmed unauthorized inventory returns 401 and authorized production access never returns the local warehouse file. Client bundles and deployment traces contain no admin secrets or private inventory files.
v0.1.4 verification: typecheck, all 25 tests, and production build passed. Browser checks covered inline stock/help/wallet/reset panels, prize reveal, keep/resell, card-local redemption and queue confirmations, cancellation focus, and tab synchronization. The admin overview fits 1280×720 and 1366×768; detail tables scroll inside the screen. Arcade and prize actions fit 390×844 and 376×668 phone viewports. Mobile admin and long collections retain natural scrolling for readable controls. The production build was also checked in-browser.

v0.1.5 verification: typecheck, all 25 tests, and production build passed. Browser checks confirmed no page overflow at 1280×720, 1366×768, 1366×640, 390×844, 390×668, and 341×607; controls had no internal overflow, the character measures 230px desktop and 155px narrow versus 92px and 62px previously, and the full claw frame fits the short-phone scene. The public `/dev` inspector has no modal, updates A01–A24 labels across interaction states, and remains noindex. Main-flow checks covered reset cancellation, stock panel, demo pull/keep, removal of old header sections, and no browser errors. The legend is intentionally below the hero on `/dev`; the homepage remains one-screen.

v0.1.6 verification: typecheck, all 25 tests, and production build passed. Browser checks measured a 0.6666–0.6668 visible character-to-machine ratio at 1502×845, 1366×640, 900×800, 390×844, and 376×668; the character was fully visible with no page overflow. Inline stock panel verification at 1366×768 measured 0.66667 and confirmed `/dev` A16.
v0.1.7 verification: typecheck, all 25 tests, and production build passed. Browser checks confirmed Rare click and ArrowRight keyboard selection of Epic preserved identical machine top coordinates before and after selection; computed transforms were none, and hover, selected, and focus brightness states were active.

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
