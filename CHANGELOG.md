# Changelog

## v0.1.10 — 2026-09-18

- Expanded the desktop admin to the full viewport, moved navigation into the header, and replaced the permanent prize side panel with a sortable, filterable stock table and inline row editing.
- Added product photos, item type and amount, total/reserved/available quantities, and separate Common/Rare/Epic/Event assignment columns. Machine assignments share one stock ledger.
- Added paused/retired availability and automatic out-of-stock labels. Ineligible items cannot be drawn; historical rewards and their resale values remain intact. Event-only entries are reserved for a future event machine.
- Added seven verified English product images and a consistent filename guide for missing photos. Image paths are limited to local product assets.
- All catalog edits and stock tracking remain a browser-local simulation with fictional counts.
- Verified typecheck, all 38 tests, production build, desktop table bounds, sorting/filtering, inline typing and validation, saved Event assignments, stock exhaustion/refill, and paused-item exclusion from the player pool.

## v0.1.9 — 2026-09-18

- Added a compact inline Ghost Stock editor with numbered sets, search/type/machine filters, editable demo values and quantities, and shared stock across multiple machines.
- Common now supports 1/2/3-pack rewards, sealed booster boxes, D23 Collection 2026 English, sample PSA 9/10 cards, and mystery rewards. All 60 seeded prizes use fictional quantities.
- Added manually checked English-only Cardmarket EUR references, independent from demo credits; no live price feed is connected.
- Dynamic demo draws use saved browser-local catalog settings. Previous awards retain their original values; v5 migrates old sessions and reset preserves admin configuration.
- Verified typecheck, 33 tests, production build, desktop/phone UI, cross-tab updates, bundle reservations, historical resale values, and inline validation.

## v0.1.8 — 2026-09-17

- Documented the standing release and rollback workflow; no product UI behavior changed apart from the release version.
- Completed updates increment the patch once, synchronize `package.json`, lockfile, and UI, then receive a matching version commit, annotated immutable tag, GitHub release, push to the configured repository's default branch, and Vercel version verification. Previous tags and releases are retained for rollback by tag redeploy or revert as a new version; force-pushes and tag rewrites are prohibited.

## v0.1.7 — 2026-09-17

- Kept machines stationary when selected and limited the selected state to brightness highlighting, including hover and keyboard focus states; machine position, sizing, and character rules are unchanged.
- Verification passed: typecheck, all 25 tests, and production build. Browser checks confirmed Rare click and ArrowRight keyboard selection of Epic preserved identical machine top coordinates before and after selection; computed transforms were none, and hover, selected, and focus brightness states were active.

## v0.1.6 — 2026-09-17

- Sized the character responsively to two-thirds of the machine’s visible artwork height, accounting for transparent sprite margins across scene and inline-panel layouts; the natural idle bob is unchanged.
- Verification passed: typecheck, all 25 tests, and production build. Browser checks measured a 0.6666–0.6668 visible character-to-machine ratio at 1502×845, 1366×640, 900×800, 390×844, and 376×668; the character was fully visible with no page overflow. Inline stock panel at 1366×768 measured 0.66667 and `/dev` A16 was present.

## v0.1.5 — 2026-09-17

- Added the public `/dev` annotated working arcade review route with `noindex` metadata and simulated-only content, including browser-local demo wallet and collection state.
- Added UI-region labels A01–A24 that update across machine, pull, result, and collection states, with a label toggle and no modal inspector.
- Removed the extra demo/subheader and introductory copy; the demo note and reset control now live in the top header.
- Tuned responsive scene fitting and enlarged the character to 2.5× its prior displayed size; the full claw frame fits the short-phone scene.
- Checks passed: typecheck, all 25 tests, and production build. Browser verification covered 1366×768, 1366×640, 390×844, 390×668, and 341×607 with no page overflow, plus main reset cancellation, stock panel, and demo pull/keep.

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
