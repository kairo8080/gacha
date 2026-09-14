# Gacha Arcade — v0.1.2

A local, simulated Lorcana collectible arcade using the owner's original pixel art. Built with Next.js, TypeScript, and React; fonts and artwork are served locally.

## Run

```powershell
npm install --cache .npm-cache
npm run dev
```

Open http://127.0.0.1:3000. The server listens on loopback only. No environment variables or service credentials are required for this iteration.

## Current release: v0.1.2

The visible release label is sourced from the `version` field in `package.json`; the npm lockfile must stay synchronized with it. For each published update, increment the patch version once, make the matching version commit, create the matching Git tag, and publish the matching GitHub release. Use a minor version only for a larger milestone explicitly requested by the owner. The numbered implementation history remains in `docs/v0.1.0-beta.md`.

Current iteration: **v0.1.0-12 — Release versioning**. The next routine update will be **v0.1.3**; the next larger milestone will be **v0.2.0**.

## Simulation experience (ticket v0.1.0-11)

The simulation uses a public fixture of 14 Lorcana sets, with 100 fictional packs in every set (1,400 fictional packs total). View a machine’s remaining sample stock and per-set odds in the pool popup, or inspect all sample stock there. Pulls reserve one pack; demo resale returns it, while keeping and shipping previews leave it reserved. Stock and credits are local to each browser. See `docs/inventory-seed.md` for the public fixture and simulation rules.

The arcade is a single-screen hero: the machine scene and pull controls share the available viewport height, with sample prize details opened from the machine panel. Portrait phones use a compact control bar. Inventory and dialogs retain scrolling when their contents need more room; short landscape screens allow page scrolling to keep controls accessible.

The complete interface now uses VT323 for readable pixel text, Press Start 2P for game headings, original crisp 16×16 SVG icons, hard-edged frames and buttons, and a slate-blue/cyan/purple/gold/mint palette matched to the supplied artwork. Visual tokens and the shared skin live in `app/pixel-theme.css`; structural layouts live in `app/globals.css`.

- Common / Rare / Epic machines with the supplied sprite artwork.
- Animated claw sequence, skip reveal, optional synthesized sound, reduced-motion support.
- 250 starting demo credits; sample pulls cost 10 / 25 / 60 credits.
- Keep packs, resell for 80% of demo value in play credits, or preview shipping.
- Browser-local inventory/history, reset control, and mobile layout.

All values, odds, and transactions are simulations. The public fixture contains fictional sample stock only: demo quantities do not reflect warehouse stock. No wallet connection, real payments, payout, address collection, physical stock reservation, or shipment occurs. Browser state is not a trustworthy record for live commerce and is not synchronized between tabs or devices. This iteration starts a fresh sample-stock simulation and leaves the earlier demo session intact.

`pixelart/` contains untouched original artwork. `public/pixelart/` contains copies used by the app. Machines use 62×92 cells from 4×6 sheets; claw sequences use 114×110 cells from 5×18 sheets. The supplied Rare machine artwork itself reads LEVEL 3 and Epic reads LEVEL 2; the UI follows the source filenames until the owner confirms the intended mapping.

## Checks

```powershell
npm run typecheck
npm test
npm run build
```

The production homepage is prerendered. Browser smoke path: select each machine → preview prizes → pull → keep or resell → inventory → preview shipping → history → reload. Check viewport fit on desktop and portrait phones, keyboard access, and the insufficient-credit/reset state.

## Next iteration

Review the arcade layout, artwork scale, and reveal timing first. Actual prize lists, prices, resale policy, network/token, and shipping scope can be added later. See `docs/v0.1.0-beta.md` for confirmed scope and open decisions.

## Vercel setup

The intended GitHub repository is `https://github.com/kairo8080/gacha`. Push the application source to the repository root before importing/deploying it. The source needs `package.json`, the lockfile, `app/`, `components/`, `lib/`, `public/`, and the root configuration files. Do not commit `node_modules/`, `.next/`, `.npm-cache/`, `.local/`, or credentials.

- Application / Framework Preset: **Next.js**.
- Root Directory: **./** (repository root).
- Build Command: keep the preset default; `npm run build` also works.
- Output Directory: keep the Next.js preset default; do not set `out` or `dist`.
- Install Command: keep the default; the committed npm lockfile provides dependency resolution.
- Environment Variables: none for this simulation.
- A purchased domain is optional; Vercel provides generated `.vercel.app` addresses.

`vercel.json` declares the Next.js framework. All behavior remains simulated when deployed. Original editing/reference exports under `pixelart/` are optional for running the app; its required artwork is copied under `public/pixelart/`.
