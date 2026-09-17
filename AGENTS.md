<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project workflow

- Work in small numbered tickets from `docs/v0.1.0-beta.md`. Give each change a clear result and check.
- Current scope is an entirely simulated local UI. Live wallets, funds, inventory, and fulfillment require a later explicit scope change.
- Preserve `pixelart/` originals. Serve copies from `public/pixelart/`; use sprite frames and crisp scaling.
- Use Luna/low for asset inventories and mechanical edits, Terra/medium for bounded routine implementation, and Astra/high for architecture or payment/inventory correctness. Specify model and effort when delegating. Give workers concise context and disjoint file ownership.
- Run `npm run typecheck`, relevant `npm test` checks, and `npm run build` for source changes; verify changed user flows in the browser. Avoid repeated checks without a new reason.
- Admin server credentials are needed only for the protected local/admin flow: use environment variables (`ADMIN_PASSWORD_SALT`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`) and never place actual passwords, hashes, or private counts in public source or documentation. No real wallet/payment credentials are used. Keep demo data clearly identified, and never imply it is real inventory or money.
- Release versioning: `package.json` is the version source; synchronize the npm lockfile and derive the visible UI version from that source. Each published update gets one default patch increment, a matching version commit, Git tag, and GitHub release. Use a minor version only for a larger milestone explicitly requested by the owner.
- Keep private stock counts out of public files. Public fixtures may show only fictional sample counts (the current app uses 14 named sets with 100 fictional packs each); preserve private local data in ignored `.local/` files.
