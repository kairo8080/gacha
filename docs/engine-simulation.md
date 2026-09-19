# Engine Lab — v0.1.14

Route: `/engine`. Access uses the existing admin session and login. This is a browser simulation; it does not create real users, collect money, reserve warehouse stock or send shipments. Scenarios and results remain in memory until exported as JSON.

## Scenario

- Select Common, Rare or Epic. The item identities and membership come from the public sample catalog, with 100 fictional reward units per item by default. Exact private stock is never read.
- Common starts at $10 per pull; Rare at $25 and Epic at $60. All values on this page are USD simulation inputs. Existing CR or EUR values are not converted or imported.
- Default behavior: 60% immediate sellback, 30% keep, 10% queue. These probabilities must add to 100%. Each simulated decision is independent of item value or past outcomes.
- Sellback pays 85% of the awarded item's configured market value, rounded to cents, and returns the same reward unit immediately. Keep and queue each reserve one unit permanently for this run. A bundle is one reward unit.
- Every user draws round-robin up to the configured pulls-per-user cap, with funding assumed for each purchase. Users do not change their behavior, recycle payouts into a finite budget, or sell previously held items later.
- At 1× the aggregate rate is users / seconds-per-pull. The displayed simulated time counts the rounds needed for those users to make their pulls. Other speeds only change playback; the seeded outcome sequence remains the same.

## Draws and stock

Each available unit has its item's configured weight. An item's current chance is `available units × weight / sum of all available weighted units`. This is a scenario model, separate from the arcade Odds Lab's house-edge solver. It does not guarantee profit. Low-value items can deplete earlier and leave a loss-making pool.

The stock invariant is `starting units = available + kept + queued`. Sold-back units are available again and never increase starting stock. Zero-stock and zero-weight items cannot win. Zero-weight units can remain in stock when a run stops because no drawable item remains.

The run stops on complete depletion, no drawable stock, or the total user pull cap. The maximum is 10,000 users and one million planned pulls. A 100% sellback scenario cannot deplete through retention and stops at its pull cap. First-item depletion and complete-pool depletion are separate counters.

## Money and outcomes

- Revenue: completed pulls × pull price.
- Payouts: cash paid on immediate sellbacks. This is not user profit.
- Reserved COGS: original configured buy cost of kept and queued units. A recycled unit is not expensed again on each sellback.
- House net P/L: revenue − sellback payouts − reserved COGS − per-pull fees.
- Operating cashflow: revenue − payouts − fees. Cash after upfront stock purchase also subtracts the entire initial stock cost. Unreserved stock retains its modeled cost value.
- Retained market: configured market value of kept and queued rewards.
- User net value: payouts + retained market − spend. A winner has positive net value; this includes estimated item value, not just realized cash profit.
- Value RTP: (payouts + retained market) / revenue. House ROI divides house P/L by initial stock cost.
- Maximum cash drawdown measures the largest fall from a previous operating-cashflow peak.

Taxes, fulfillment costs, storage, market-price changes, payout liquidity limits, shipping charges and later resale are excluded. Shipping requests remain queued throughout the run, consistent with the pre-launch 60-day shipping restriction. No dispatch clock runs here.

## Repeatability and limits

The seeded PRNG uses 53-bit draw tickets. Unrepresentably extreme weight ranges are rejected. Currency and stock arithmetic use bounded integer cents and units. Chunking preserves the input state and produces the same outcomes at every speed. The UI yields between full-run chunks so a run can be paused.

Results retain per-user and per-item totals, the last 100 draw events, and at most 200 P/L samples. The JSON export includes the scenario, seed, aggregate summary and retained run state. It is a bounded report, not a full event ledger. Reset keeps the scenario inputs and clears its run; changing the machine loads that machine's fictional default pool.
