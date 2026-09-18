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
- Probability equals a product's remaining reward units divided by the selected machine's remaining reward units. Empty products cannot be awarded or charged for. Odds shown in the UI are rounded.
- Held, redeemed, queued, and shipping rewards remain reserved. Selling a held reward returns one unit once and credits 80% of its original demo value.
- Pulls cost 10 / 25 / 60 CR. Demo values are fictional; EUR references do not convert into credits.
- Admins can add prizes and edit names, types, sets, quantities, values, and any combination of machines. No machine assignment pauses a product. Quantities cannot be reduced below current reservations.
- Old awards keep their original name, type, and value after catalog edits. Browser storage v5 migrates v4 history and v3 shipping previews without losing their reservations.
- Session reset restores 250 CR and clears pulls/history/reservations while preserving the configured admin catalog.

## Cardmarket and persistence

The inline admin editor stores an optional Cardmarket product URL, manually checked EUR reference, and check date. EUR prices start unset. Recording a new price requires confirmation that the admin checked **English listings**. Cardmarket's `/en/` interface is not proof of an English product edition. There is no live price feed or automatic price refresh.

All edits and statistics are local to the current browser origin and synchronize across its tabs. They are not shared server configuration or authenticated commercial inventory. Localhost and the deployed Vercel site have separate sessions.

Exact warehouse counts remain in ignored `.local/private-inventory/` files and are never imported into public fixtures. No real stock, payments, or fulfillment are represented by this catalog.
