# Ticket v0.1.0-21 — fictional Ghost catalog

The public fixture contains **60 English reward entries**, each seeded with **100 fictional reward units** (6,000 unique units). These counts and credit values do not represent warehouse stock or market prices.

## Numbered sets

| #   | Set                   | Single-pack machine |
| --- | --------------------- | ------------------- |
| 01  | The First Chapter     | Epic                |
| 02  | Rise of the Floodborn | Common              |
| 03  | Into the Inklands     | Common              |
| 04  | Ursula's Return       | Common              |
| 05  | Shimmering Skies      | Common              |
| 06  | Azurite Sea           | Common              |
| 07  | Archazia's Island     | Common              |
| 08  | Reign of Jafar        | Common              |
| 09  | Fabled                | Epic                |
| 10  | Whispers in the Well  | Rare                |
| 11  | Winterspell           | Rare                |
| 12  | Wilds Unknown         | Rare                |
| 13  | Attack of the Vine!   | Rare                |
| 14  | Hyperia City          | Rare                |

Each set also has separate 2-pack and 3-pack bundles assigned to Common/Rare, plus a sealed booster box assigned to all three machines. The four additional sample rewards are D23 Collection 2026 limited foil English (Common/Epic), PSA 9, PSA 10, and mystery (all three machines). All assignments are editable and illustrative, with no profitability or market-value claim.

## Shared simulation stock

- Each pull awards one reward unit. One bundle, sealed box, or graded card counts once. The simulation does not open boxes or convert them to loose packs.
- One product ID may appear in multiple machines, sharing one stock/reservation ledger. Machine totals overlap; summing them would double-count shared products.
- In stock-odds mode, probability equals a product's remaining reward units divided by the selected machine's remaining reward units. Tuned mode uses the reviewed Odds Lab plan, recalculated for the current stock. Empty products cannot be awarded or charged for. Odds shown in the UI are rounded.
- Held, redeemed, queued, and shipping rewards remain reserved. Selling a held reward returns one unit once and credits 80% of its original demo value.
- Pulls cost 10 / 25 / 60 CR. Demo values are fictional; EUR references do not convert into credits.
- Admins can add prizes and edit names, types, sets, quantities, values, and any combination of machines. No machine assignment pauses a product. Quantities cannot be reduced below current reservations.
- Old awards keep their original name, type, and value after catalog edits. Browser storage v5 migrates v4 history and v3 shipping previews without losing their reservations.
- Session reset restores 250 CR and clears pulls/history/reservations while preserving the configured admin catalog.

## Cardmarket and persistence

The inline admin editor stores an optional Cardmarket product URL, VK market value in EUR, and update date. EK is the internal purchase cost in EUR. Both amounts are for one complete reward unit, including a whole bundle when applicable, and start unset. Manual VK does not require a URL; recording a Cardmarket-backed quote requires confirmation that the admin checked **English listings**. Cardmarket's `/en/` interface is not proof of an English product edition. There is no live price feed or automatic price refresh.

All edits and statistics are local to the current browser origin and synchronize across its tabs. They are not shared server configuration or authenticated commercial inventory. Localhost and the deployed Vercel site have separate sessions.

Exact warehouse counts remain in ignored `.local/private-inventory/` files and are never imported into public fixtures. No real stock, payments, or fulfillment are represented by this catalog.

## Ticket v0.1.0-22 — desktop stock table

The full-width table exposes item type, amount per reward, total units, reservations, remaining units, and separate Common/Rare/Epic/Event assignments. Filters and sort controls act on this shared catalog. Edits expand within the table; no permanent side panel or popup is used.

The event flag is independent of the three public machines. An event-only item stays outside their draw pools until assigned to a public machine. Paused and retired items are also excluded; zero remaining stock prevents a draw automatically. Refilling or reactivating an item preserves previous reservations and historical award values. Retiring a listing retains its history.

Product photos use reviewed files in `public/products/`. Bundles share their pack image; missing images display a placeholder. See `docs/product-images.md` for filenames and `docs/product-image-sources.md` for source attribution. These additions preserve older v5 sessions without a storage reset.

## Ticket v0.1.0-23 — costs, card view and odds planning

Each machine has an optional EUR planning price, target edge (initially 15%), expense per pull and enabled flag. These EUR inputs do not change or convert the arcade's illustrative 10/25/60 credit charges. The public fixture contains no assumed EK or VK values.

The calculator starts with remaining-unit stock weights and applies an exponential tilt based on `max(EK, VK)` per reward. It finds the smallest tilt in that conservative family whose expected liability is at most `price × (1 − targetEdge) − expense`. The resulting plan therefore constrains both expected purchase cost and market payout. Expected profit is `price − expense − E[EK]`; the displayed market-based house edge is `(price − expense − E[VK]) / price`; market RTP is `E[VK] / price`. This is a forecast over many pulls, not a guarantee on an individual pull, and excludes expenses not entered.

Applying a valid plan enables those odds in the simulation. Every eligible reward retains a representable chance, and the same function supplies sampling, admin percentages and player percentages. Missing EK/VK, depleted cheap stock, an impossible target or an unrepresentable probability pauses tuned draws rather than silently reverting to unprotected odds. These checks repeat before each pull; there is no player-specific adjustment. Stock-odds mode remains available explicitly and does not claim a house edge. Event assignments are not a fourth machine.

Costs, manual prices and odds settings remain local to the browser origin. Reset preserves configured settings. Historical award values and resale credits remain unchanged by repricing. Card and list views share filters, ordering, stock and inline editing.

Cooperating browser tabs serialize session commits with Web Locks and compare their persisted base before writing. A stale save is rejected and the newer session is restored with an inline notice; it cannot silently replace newer prices, odds or awards. Browsers without Web Locks show a best-effort synchronization notice. This remains a local simulation, not a multi-user inventory backend.
