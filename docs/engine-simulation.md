# Engine Lab — v0.1.15

Route: `/engine`. Access uses the existing admin session and login. This is an isolated browser simulation: it does not create real users, collect money, reserve warehouse stock or send shipments. Scenarios and results stay in memory until exported as JSON.

## Runs and visitors

Each new run uses a fresh crypto-random seed unless repeatable replay is enabled. Repeat seeds make the run reproducible at 1×, 2×, 10×, 100× and 1000×, including full-run playback. The seed controls draw, arrival and cadence randomness.

Visitors are synthetic controls: 20% browser/no-pull, 40% casual (1–5 planned pulls), 30% regular (6–30), and 10% enthusiast (31–200). Arrivals are randomized within the 300-second default window, and each visitor’s pull cadence is randomized around the configured seconds-per-pull value. The default per-visitor maximum is 200 pulls. These proportions and timings are useful for exercising the live UI; they are not a claim of empirically realistic traffic.

Users are funded for each purchase and do not recycle payouts into a finite budget. Each draw sells back, keeps or queues independently using the configured behavior split. Sellback pays 85% of the configured market value, rounded to cents, and returns the same reward unit immediately. Keep and shipping reserve one unit for the run. A bundle or box is one reward unit.

## Draws, stock and edge protection

The default target house edge is 15%. Every draw uses checked odds for the current pool; stock changes trigger a recalculation. Zero-stock and zero-weight rows are excluded. The protected distribution must give every remaining configured eligible item a representable nonzero chance while satisfying both a positive expected market margin and a positive expected liability margin after fees. If that is impossible, the run stops with `edge-protected` rather than drawing from an unprotected distribution.

This is an expected-value guard, not a promise that every run is profitable. It does not personalize odds by player. Each available unit is weighted within the protected distribution, and stock can still move toward an unfavorable realized outcome.

The stock invariant is `starting units = available + kept + queued`; sold-back units return to available and never increase starting stock. The run stops on complete depletion, no drawable stock, edge protection failure, or completion of all scheduled visits. Planned pulls are capped at one million in total. The engine has a bounded overall workload and retains only summarized event history.

## Money and outcomes

- Revenue is completed pulls × pull price.
- Payouts are cash paid on immediate sellbacks; this is not user profit.
- Reserved COGS is the configured cost of kept and queued units.
- House net P/L is revenue − sellback payouts − reserved COGS − per-pull fees.
- Operating cashflow is revenue − payouts − fees; initial stock cost is tracked separately.
- Retained market is the configured market value of kept and queued rewards.
- User net value is payouts + retained market − spend.
- Value RTP is (payouts + retained market) / revenue.

All USD prices and outcomes are fictional. They are browser-memory values independent of arcade credits, EUR planning values and private inventory. No fulfillment, storage, tax, market-price change, shipping charge or later resale is modeled.

## Live view and results

The live view shows the machine, visitor flow and stock at current playback speed, with four primary KPIs. Setup, Stock, Players and Stats use separate inline tabs so the live view stays readable. Playback supports 1× through 1000×, pause/resume, export and full-run results. Full-run mode produces the same result as completing playback with the same seed.

Exports contain the scenario, seed, aggregate summary, per-user and per-item totals, bounded recent draw events and a bounded P/L history. They are reports, not a full event ledger. Reset keeps scenario inputs and clears the run; changing the machine loads that machine’s fictional default pool.
