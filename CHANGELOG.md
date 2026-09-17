# Changelog

## v0.1.4 — 2026-09-17

- Compact admin metrics, machine, stock, and shipping overviews with bounded scrolling for long tables.
- Embedded player result, wallet, how-to, stock, reset, and redeem panels, plus inline persistent collection confirmation status.
- Kept desktop views compact where possible while allowing mobile scrolling for readable controls.

## v0.1.3 — 2026-09-17

- Added protected `/admin` access with server-only password/session environment variables and same-browser demo stats.
- Added player collection search, filters, sorting, and best historical pull presentation.
- Added v4 local-storage migration and tab synchronization, plus simulated held → redeemed → queued → shipping state with day-60 admin demo-clock gating.
- Kept exact warehouse inventory local to authenticated development admin sessions; public “Ghost” stock remains fictional and production inventory access is disabled.

## v0.1.2 — 2026-09-14

- Added a visible top-left release version label for desktop and mobile layouts.
- Defined the release workflow: `package.json` is the version source, the lockfile stays synchronized, and each published patch uses a matching commit, Git tag, and GitHub release.
- Synchronized the edition label, footer, and page metadata with the package version.
