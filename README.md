# Gacha Arcade — v0.1.0 beta

A local, simulated Lorcana collectible arcade using the owner's original pixel art. Built with Next.js, TypeScript, and React; fonts and artwork are served locally.

## Run

```powershell
npm install --cache .npm-cache
npm run dev
```

Open http://127.0.0.1:3000. The server listens on loopback only. No environment variables or service credentials are required for this iteration.

## Current iteration: v0.1.0-09

The complete interface now uses VT323 for readable pixel text, Press Start 2P for game headings, original crisp 16×16 SVG icons, hard-edged frames and buttons, and a slate-blue/cyan/purple/gold/mint palette matched to the supplied artwork. Visual tokens and the shared skin live in `app/pixel-theme.css`; structural layouts live in `app/globals.css`.

- Common / Rare / Epic machines with the supplied sprite artwork.
- Animated claw sequence, skip reveal, optional synthesized sound, reduced-motion support.
- 250 starting demo credits; sample pulls cost 10 / 25 / 60 credits.
- Keep prizes, resell for 80% of sample value in play credits, or preview shipping.
- Browser-local inventory/history, reset control, and mobile layout.

All values, odds, and transactions are simulations. No wallet connection, real payments, payout, address collection, physical stock reservation, or shipment occurs. Browser state is not a trustworthy record for live commerce and is not synchronized between tabs or devices.

`pixelart/` contains untouched original artwork. `public/pixelart/` contains copies used by the app. Machines use 62×92 cells from 4×6 sheets; claw sequences use 114×110 cells from 5×18 sheets. The supplied Rare machine artwork itself reads LEVEL 3 and Epic reads LEVEL 2; the UI follows the source filenames until the owner confirms the intended mapping.

## Checks

```powershell
npm run typecheck
npm test
npm run build
```

The production homepage is prerendered. Browser smoke path: select each machine → pull → keep or resell → inventory → preview shipping → history → reload. Check mobile sizing, keyboard access, and the insufficient-credit/reset state.

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
