# Ticket v0.1.0-11 — sample Lorcana simulation

This public fixture is a fictional game configuration. It contains **14 named Lorcana sets**, with **100 fictional packs per set** and **1,400 fictional packs total**. Demo quantities do not reflect warehouse stock.

| Set                   | Sample packs | Provisional machine |
| --------------------- | -----------: | ------------------- |
| The First Chapter     |          100 | Epic                |
| Rise of the Floodborn |          100 | Common              |
| Into the Inklands     |          100 | Common              |
| Ursula's Return       |          100 | Common              |
| Shimmering Skies      |          100 | Common              |
| Azurite Sea           |          100 | Common              |
| Archazia's Island     |          100 | Common              |
| Reign of Jafar        |          100 | Common              |
| Fabled                |          100 | Epic                |
| Winterspell           |          100 | Rare                |
| Whispers in the Well  |          100 | Rare                |
| Wilds Unknown         |          100 | Rare                |
| Attack of the Vine!   |          100 | Rare                |
| Hyperia City          |          100 | Rare                |
| Total                 |        1,400 |                     |

## Simulation rules

- Each pull awards **one sealed booster pack** from the selected machine. No individual card is opened or awarded.
- Common, Rare, and Epic are illustrative machine groupings: seven, five, and two named sets respectively. They are not market-price or printed-card rarity classifications.
- Prices remain 10 / 25 / 60 play credits. Item values and the 80% credit resale rate are illustrative; the owner has not supplied actual prices.
- Draws select from remaining packs. Set probability is its remaining packs divided by the machine's remaining packs. Exhausted sets cannot be awarded or charged for.
- Kept packs and shipping-preview requests remain reserved in that browser's simulation. Reselling returns a pack to its original demo pool once. This return rule is provisional and does not settle the live resale contract.
- Reset restores the fictional sample quantities and 250 credits. Stock is local to each browser; it is not shared warehouse availability.
- The `gacha-demo-sample-v3` browser key starts a fresh sample-stock simulation. The old `gacha-demo-v1` sample session remains stored separately and is not erased.
- The public fixture contains sealed packs only.

## Naming and private reference

The canonical set names support the public simulation only and do not imply confirmed physical availability. Private reference material is retained in the ignored `.local/private-inventory/` directory and is not imported by application source or reproduced in public documentation.
