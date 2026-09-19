import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceEngine, advanceEngineTime, createDefaultEngineConfig, createDefaultEngineItems, createEngine,
  ENGINE_MAX_CHUNK, ENGINE_MAX_PULLS, summarizeEngine, type EngineConfig, type EngineItem, type EngineState,
} from "./engine.ts";
import { stockCatalog } from "./catalog.ts";

const config = (overrides: Partial<EngineConfig> = {}): EngineConfig => ({
  ...createDefaultEngineConfig(), users: 100, ...overrides,
});
const item = (overrides: Partial<EngineItem> = {}): EngineItem => ({
  id: "sample", name: "Fictional sample", kind: "pack", setId: null,
  initialStock: 100, costCents: 300, marketCents: 600, weight: 1, ...overrides,
});
function finish(state: EngineState, chunk = ENGINE_MAX_CHUNK) {
  let iterations = 0;
  while (!state.stopReason) {
    state = advanceEngine(state, chunk);
    assert.ok(++iterations < 1_100_000, "scheduler must make progress");
  }
  return state;
}

test("seeded session plans, draws and bounded logs replay across event chunks and clock advancement", () => {
  const start = createEngine(config({ users: 60, seed: 0, sellProbability: 1, keepProbability: 0, shipProbability: 0 }), [
    item({ initialStock: 300 }), item({ id: "other", weight: 3, initialStock: 300, marketCents: 2500 }),
  ]);
  const before = structuredClone(start);
  const single = finish(start, 1);
  assert.deepEqual(single, finish(start, 137));
  assert.deepEqual(single, finish(start));
  let timed = start;
  while (!timed.stopReason) timed = advanceEngineTime(timed, 0.37, 7);
  assert.deepEqual(single, timed);
  assert.deepEqual(start, before, "Advancing must not mutate caller state");
  assert.equal(single.events.length, 100);
  assert.ok(single.history.length <= 200);
  assert.equal(single.history[0].pull, 0);
  assert.equal(single.history.at(-1)!.pull, single.totalPulls);
  const other = createEngine({ ...start.config, seed: 1 }, start.items);
  assert.notDeepEqual(start.players, other.players);
  assert.notDeepEqual(single.events, finish(other).events);
});

test("synthetic mix contains 0, 1 and heavy sessions, staggered arrivals and varied cadence", () => {
  const state = createEngine(config({ users: 10000 }), [item()]);
  const planned = state.players.map(player => player.plannedPulls);
  assert.ok(planned.includes(0));
  assert.ok(planned.includes(1));
  assert.ok(planned.includes(200));
  assert.ok(planned.every(pulls => pulls >= 0 && pulls <= 200));
  assert.equal(planned.reduce((a, b) => a + b, 0), state.plannedPulls);
  assert.ok(state.plannedPulls <= ENGINE_MAX_PULLS);
  for (const [profile, expected] of [["browser", .2], ["casual", .4], ["regular", .3], ["enthusiast", .1]] as const) {
    const proportion = state.players.filter(player => player.profile === profile).length / state.players.length;
    assert.ok(Math.abs(proportion - expected) < 0.025, `${profile}: ${proportion}`);
  }
  assert.ok(new Set(state.players.map(player => player.arrivalSeconds)).size > 9900);
  assert.ok(new Set(state.players.map(player => player.cadenceSeconds)).size > 9900);
  assert.equal(state.players[0].arrivalSeconds, 0);
  assert.equal(summarizeEngine(state).playersArrived, 1);
});

test("clock counts arriving, online, completed and zero-pull visitors independently of draws", () => {
  const start = createEngine(config({ users: 1, seed: 7 }), [item()]);
  assert.equal(start.plannedPulls, 0);
  assert.equal(summarizeEngine(start).playersActive, 0);
  assert.equal(summarizeEngine(start).playersBrowsing, 1);
  assert.equal(summarizeEngine(start).visitorsOnline, 1);
  assert.equal(summarizeEngine(start).playersWaiting, 0);
  const end = finish(start);
  assert.equal(end.totalPulls, 0);
  assert.equal(end.stopReason, "pull-cap");
  assert.ok(end.simulatedSeconds > 0);
  assert.equal(summarizeEngine(end).playersBrowsed, 1);
  assert.equal(summarizeEngine(end).playersDeparted, 1);
  assert.equal(summarizeEngine(end).visitorsOnline, 0);
  const crowd = advanceEngineTime(createEngine(config({ users: 100, arrivalWindowSeconds: 500, sellProbability: 1, keepProbability: 0, shipProbability: 0 }), [item()]), 50);
  const summary = summarizeEngine(crowd);
  assert.equal(summary.playersArrived, crowd.players.filter(player => player.arrivalSeconds <= 50).length);
  assert.equal(summary.playersWaiting + summary.visitorsOnline + summary.playersDeparted, 100);
});

test("time advance budgets never skip queued events and replay when pending time is carried", () => {
  const start = createEngine(config({ users: 100, arrivalWindowSeconds: 0, sellProbability: 1, keepProbability: 0, shipProbability: 0 }), [item()]);
  const expected = advanceEngineTime(start, 100);
  let actual = advanceEngineTime(start, 100, 1);
  assert.ok(actual.simulatedSeconds < 100);
  while (!actual.stopReason && actual.simulatedSeconds < 100) actual = advanceEngineTime(actual, 100 - actual.simulatedSeconds, 3);
  assert.deepEqual(actual, expected);
});

test("stock is conserved on every draw and reservations never oversubscribe", () => {
  let state = createEngine(config(), [item({ initialStock: 11 }), item({ id: "b", initialStock: 2, weight: 7 })]);
  while (!state.stopReason) {
    state = advanceEngine(state, 1);
    for (const row of state.items) {
      assert.equal(row.initialStock, row.available + row.reservedKeep + row.queued);
      assert.ok(row.available >= 0);
      assert.equal(row.pulls, row.sellbacks + row.reservedKeep + row.queued);
    }
  }
  assert.equal(state.stopReason, "stock-empty");
  assert.equal(state.totalDepletedAtPull, state.totalPulls);
  assert.ok(state.firstItemDepletedAtPull! <= state.totalPulls);
  const result = summarizeEngine(state);
  assert.equal(result.reserved, 13);
  assert.equal(result.availablePercent + result.reservedPercent, 100);
  assert.equal(result.playersActive, 0);
});

test("sellback recycles units, pays rounded 85% market, and never consumes COGS", () => {
  const state = finish(createEngine(config({ users: 1, seed: 4, sellProbability: 1, keepProbability: 0, shipProbability: 0 }), [
    item({ initialStock: 1, marketCents: 601 }),
  ]));
  assert.equal(state.stopReason, "pull-cap");
  assert.ok(state.totalPulls > 30);
  assert.equal(state.totalPulls, state.plannedPulls);
  assert.equal(state.items[0].available, 1);
  assert.equal(state.items[0].sellbacks, state.totalPulls);
  assert.equal(state.payoutCents, Math.round(601 * 0.85) * state.totalPulls);
  assert.equal(state.reservedCostCents, 0);
  assert.equal(state.firstItemDepletedAtPull, null);
  assert.equal(state.totalDepletedAtPull, null);
});

test("zero-stock and explicitly zero-weight rows never win; inaccessible stock has a clear reason", () => {
  const state = finish(createEngine(config({ sellProbability: 0, keepProbability: 1, shipProbability: 0 }), [
    item({ id: "empty", initialStock: 0, weight: 1000 }),
    item({ id: "excluded", initialStock: 1000, weight: 0 }),
    item({ id: "available", initialStock: 1 }),
  ]));
  assert.equal(state.totalPulls, 1);
  assert.equal(state.events[0].itemId, "available");
  assert.equal(state.stopReason, "no-drawable-stock");
  assert.equal(state.totalDepletedAtPull, null);
  const empty = createEngine(config(), [item({ initialStock: 0 })]);
  assert.equal(empty.stopReason, "stock-empty");
  assert.equal(empty.totalDepletedAtPull, 0);
  assert.equal(advanceEngine(empty), empty);
  assert.equal(createEngine(config(), [item({ weight: 0 })]).stopReason, "no-drawable-stock");
});

test("shipping reserves and charges cost once, with correct PnL and cash after upfront", () => {
  const state = finish(createEngine(config({ users: 1, seed: 0, pullsPerUser: 2, sellProbability: 0, keepProbability: 0, shipProbability: 1, feeCents: 50 }), [item({ initialStock: 10 })]));
  const result = summarizeEngine(state);
  assert.equal(result.revenueCents, 2000);
  assert.equal(result.payoutCents, 0);
  assert.equal(result.reservedCostCents, 600);
  assert.equal(result.feesCents, 100);
  assert.equal(result.netPnlCents, 1300);
  assert.equal(result.cashflowCents, 1900);
  assert.equal(result.initialInvestmentCents, 3000);
  assert.equal(result.cashAfterUpfrontCents, -1100);
  assert.equal(result.queued, 2);
  assert.equal(result.retainedValueCents, 1200);
  assert.equal(result.playerNetCents, -800);
  assert.equal(result.playersLosing, 1);
});

test("every actual draw respects both market and worst action liability edges, recomputed after depletion", () => {
  let state = createEngine(config({ users: 100, feeCents: 30, sellbackRate: .85 }), [
    item({ initialStock: 40 }), item({ id: "big", initialStock: 5, marketCents: 12000, costCents: 15000, weight: 100 }),
  ]);
  let previousOdds = state.currentOdds;
  let changed = false;
  while (!state.stopReason) {
    state = advanceEngine(state, 1);
    if (JSON.stringify(previousOdds) !== JSON.stringify(state.currentOdds)) changed = true;
    previousOdds = state.currentOdds;
    const event = state.events.at(-1);
    if (event) {
      const budget = state.config.pullPriceCents * (1 - state.config.targetHouseEdge);
      assert.ok(event.expectedMarketCents + state.config.feeCents <= budget);
      assert.ok(event.expectedLiabilityCents + state.config.feeCents <= budget);
      assert.ok(event.expectedHouseEdge >= state.config.targetHouseEdge - 1e-14);
    }
    if (state.expectedHouseEdge !== null) {
      state.currentOdds.forEach((row, i) => { if (state.items[i].available > 0) assert.ok(row.probability > 0); });
    }
  }
  assert.ok(changed);
  assert.equal(state.stopReason, "edge-protected");
  assert.ok(state.items.find(row => row.id === "big")!.available > 0);
  assert.equal(state.expectedHouseEdge, null);
});

test("infeasible and numerically unreachable prizes stop before any unfavorable draw", () => {
  for (const rows of [
    [item({ marketCents: 1000 })],
    [item({ costCents: 900, marketCents: 0 })],
    [item({ marketCents: 850 }), item({ id: "high", marketCents: 1000 })],
  ]) {
    const state = finish(createEngine(config(), rows));
    assert.equal(state.stopReason, "edge-protected");
    assert.equal(state.totalPulls, 0);
  }
  const state = createEngine(config({ targetHouseEdge: .3999999999999 }), [item(), item({ id: "unreachable", marketCents: 1_000_000 })]);
  assert.equal(state.stopReason, "edge-protected");
});

test("positive expected edge still permits negative individual house outcomes and player winners", () => {
  const state = finish(createEngine(config({ users: 300, sellProbability: 1, keepProbability: 0, shipProbability: 0, feeCents: 50 }), [
    item(), item({ id: "prize", marketCents: 10000, costCents: 3000, weight: 20 }),
  ]));
  assert.ok(state.items[1].pulls > 0);
  assert.ok(state.maxCashDrawdownCents > 0);
  assert.ok(summarizeEngine(state).playersWinning > 0);
  assert.ok(state.events.some(event => event.payoutCents > state.config.pullPriceCents));
});

test("unconstrained odds retain available-unit relative weights", () => {
  const start = createEngine(config(), [item({ id: "one", initialStock: 1 }), item({ id: "nine", initialStock: 9 })]);
  assert.ok(Math.abs(start.currentOdds[0].probability - .1) < 1e-15);
  assert.ok(Math.abs(start.currentOdds[1].probability - .9) < 1e-15);
});

test("validation rejects invalid session settings, nonpositive edges, nonfinite values and fractional money", () => {
  for (const patch of [
    { users: 0 }, { users: 10001 }, { pullsPerUser: 201 }, { pullsPerUser: 0 },
    { targetHouseEdge: 0 }, { targetHouseEdge: -0.1 }, { targetHouseEdge: 1 }, { targetHouseEdge: NaN },
    { arrivalWindowSeconds: -1 }, { pullPriceCents: 0 }, { pullPriceCents: 1000.5 }, { feeCents: -1 },
    { seed: -1 }, { seed: 1.5 }, { secondsPerPull: Infinity },
    { sellProbability: NaN }, { sellbackRate: 1.01 }, { shipProbability: 0.9 },
  ]) assert.throws(() => createEngine(config(patch), [item()]));
  for (const patch of [
    { initialStock: -1 }, { initialStock: 0.5 }, { weight: -1 }, { weight: Infinity },
    { marketCents: 12.5 }, { costCents: NaN }, { costCents: 1_000_001 },
  ]) assert.throws(() => createEngine(config(), [item(patch)]));
  assert.throws(() => createEngine(config(), [item(), item()]));
  assert.throws(() => createEngine(config(), [item({ id: "tiny", weight: 1e-9 }), item({ id: "large", weight: 1e6 })]), /Weight range is too extreme/);
  assert.throws(() => createEngine(config(), []));
  assert.throws(() => advanceEngine(createEngine(config(), [item()]), ENGINE_MAX_CHUNK + 1));
  assert.throws(() => advanceEngineTime(createEngine(config(), [item()]), -1));
});

test("default fixtures preserve catalog identities, fictional counts and independent USD values", () => {
  for (const machineId of ["common", "rare", "epic"] as const) {
    const rows = createDefaultEngineItems(machineId);
    assert.equal(rows.length, stockCatalog.filter(row => row.machineIds.includes(machineId) && (!row.availability || row.availability === "active")).length);
    assert.ok(rows.every(row => row.initialStock === 100));
    const start = summarizeEngine(createEngine(createDefaultEngineConfig(machineId), rows));
    assert.equal(start.availablePercent, 100);
    assert.equal(start.reservedPercent, 0);
    assert.ok(start.expectedHouseEdge! > 0);
  }
  const packs = createDefaultEngineItems("common").filter(row => row.kind === "pack" && !row.id.endsWith("-packs"));
  assert.ok(packs.length > 1);
  assert.ok(packs.every(row => row.marketCents === 600 && row.costCents === 300 && row.weight === 80));
  assert.equal(createDefaultEngineConfig().pullPriceCents, 1000);
  assert.equal(createDefaultEngineConfig().targetHouseEdge, .15);
  assert.equal(createDefaultEngineConfig().pullsPerUser, 200);
});
