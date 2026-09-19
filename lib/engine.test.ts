import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceEngine, createDefaultEngineConfig, createDefaultEngineItems, createEngine,
  ENGINE_MAX_CHUNK, summarizeEngine, type EngineConfig, type EngineItem, type EngineState,
} from "./engine.ts";
import { stockCatalog } from "./catalog.ts";

const config = (overrides: Partial<EngineConfig> = {}): EngineConfig => ({
  ...createDefaultEngineConfig(), users: 4, pullsPerUser: 20, ...overrides,
});
const item = (overrides: Partial<EngineItem> = {}): EngineItem => ({
  id: "sample", name: "Fictional sample", kind: "pack", setId: null,
  initialStock: 100, costCents: 300, marketCents: 600, weight: 1, ...overrides,
});
function finish(state: EngineState, chunk = ENGINE_MAX_CHUNK) {
  while (!state.stopReason) state = advanceEngine(state, chunk);
  return state;
}

test("seeded outcomes including bounded history and event log are independent of chunk size", () => {
  const start = createEngine(config({ users: 5, pullsPerUser: 200, seed: 0 }), [
    item({ initialStock: 300 }), item({ id: "other", weight: 3, initialStock: 300, marketCents: 2500 }),
  ]);
  const before = structuredClone(start);
  const single = finish(start, 1);
  assert.deepEqual(single, finish(start, 137));
  assert.deepEqual(single, finish(start));
  assert.deepEqual(start, before, "Advancing must not mutate caller state");
  assert.equal(single.events.length, 100);
  assert.ok(single.history.length <= 200);
  assert.equal(single.history[0].pull, 0);
  assert.equal(single.history.at(-1)!.pull, single.totalPulls);
  assert.notDeepEqual(single.events, finish(createEngine({ ...start.config, seed: 1 }, start.items)).events);
});

test("every awarded unit is either available, kept or shipping-reserved without oversubscription", () => {
  let state = createEngine(config({ users: 10, pullsPerUser: 100 }), [
    item({ initialStock: 11 }), item({ id: "b", initialStock: 2, weight: 7 }),
  ]);
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

test("sellback recycles the same unit, pays rounded 85% market, and never consumes COGS", () => {
  const state = finish(createEngine(config({ users: 1, pullsPerUser: 500, sellProbability: 1, keepProbability: 0, shipProbability: 0 }), [
    item({ initialStock: 1, marketCents: 601 }),
  ]));
  assert.equal(state.stopReason, "pull-cap");
  assert.equal(state.items[0].available, 1);
  assert.equal(state.items[0].sellbacks, 500);
  assert.equal(state.payoutCents, Math.round(601 * 0.85) * 500);
  assert.equal(state.reservedCostCents, 0);
  assert.equal(state.firstItemDepletedAtPull, null);
  assert.equal(state.totalDepletedAtPull, null);
});

test("zero stock and zero weight cannot win; inaccessible remaining stock has an explicit terminal reason", () => {
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

test("shipping reserves stock and charges cost exactly once; PnL differs from cash after upfront investment", () => {
  const state = finish(createEngine(config({ users: 1, pullsPerUser: 2, sellProbability: 0, keepProbability: 0, shipProbability: 1, feeCents: 50 }), [item({ initialStock: 10 })]));
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
  assert.equal(result.reservedKeep, 0);
  assert.equal(result.retainedValueCents, 1200);
  assert.equal(result.playerNetCents, -800);
  assert.equal(result.playersWinning, 0);
  assert.equal(result.playersLosing, 1);
});

test("large prizes can yield negative house PnL and measurable cash drawdown", () => {
  const state = finish(createEngine(config({ users: 1, pullsPerUser: 3, sellProbability: 1, keepProbability: 0, shipProbability: 0, feeCents: 50 }), [item({ marketCents: 2000 })]));
  const result = summarizeEngine(state);
  assert.equal(result.payoutCents, 5100);
  assert.equal(result.netPnlCents, -2250);
  assert.equal(result.maxCashDrawdownCents, 2250);
  assert.equal(result.playersWinning, 1);
  assert.equal(result.playerNetCents, 2100, "Player net excludes operator fees");
});

test("players draw round-robin and concurrent timing counts rounds, with explicit completed/stopped states", () => {
  const start = createEngine(config({ users: 3, pullsPerUser: 2, secondsPerPull: 5, sellProbability: 1, keepProbability: 0, shipProbability: 0 }), [item()]);
  const running = advanceEngine(start, 4);
  assert.deepEqual(running.events.map((event) => event.userId), [1, 2, 3, 1]);
  assert.deepEqual(running.players.map((player) => player.pulls), [2, 1, 1]);
  const summary = summarizeEngine(running);
  assert.equal(summary.playersPlayed, 3);
  assert.equal(summary.playersCompleted, 1);
  assert.equal(summary.playersActive, 2);
  assert.equal(summary.simulatedSeconds, 10);
  assert.equal(summarizeEngine(finish(running)).playersCompleted, 3);
  const stopped = finish(createEngine(config({ users: 3, pullsPerUser: 2, sellProbability: 0, keepProbability: 1, shipProbability: 0 }), [item({ initialStock: 1 })]));
  assert.equal(summarizeEngine(stopped).playersStopped, 1);
  assert.equal(summarizeEngine(stopped).playersWaiting, 2);
});

test("draw weight multiplies available reward units", () => {
  const state = finish(createEngine(config({ users: 1, pullsPerUser: 10000, sellProbability: 1, keepProbability: 0, shipProbability: 0 }), [
    item({ id: "one", initialStock: 1 }), item({ id: "nine", initialStock: 9 }),
  ]));
  assert.ok(state.items[0].pulls > 800 && state.items[0].pulls < 1200);
  assert.equal(state.items[0].pulls + state.items[1].pulls, 10000);
});

test("scenario validation rejects nonfinite, fractional cents, impossible totals and duplicate rows", () => {
  for (const patch of [
    { users: 0 }, { users: 10001 }, { users: 10000, pullsPerUser: 101 },
    { pullPriceCents: 0 }, { pullPriceCents: 1000.5 }, { feeCents: -1 },
    { seed: -1 }, { seed: 1.5 }, { secondsPerPull: Infinity },
    { sellProbability: NaN }, { sellbackRate: 1.01 }, { shipProbability: 0.9 },
  ]) assert.throws(() => createEngine(config(patch), [item()]));
  for (const patch of [
    { initialStock: -1 }, { initialStock: 0.5 }, { weight: -1 }, { weight: Infinity },
    { marketCents: 12.5 }, { costCents: NaN }, { costCents: 1_000_001 },
  ]) assert.throws(() => createEngine(config(), [item(patch)]));
  assert.throws(() => createEngine(config(), [item(), item()]));
  assert.throws(() => createEngine(config(), [
    item({ id: "tiny", weight: 1e-9 }), item({ id: "large", weight: 1e6 }),
  ]), /Weight range is too extreme/);
  assert.throws(() => createEngine(config(), []));
  assert.throws(() => advanceEngine(createEngine(config(), [item()]), ENGINE_MAX_CHUNK + 1));
});

test("default USD fixtures use catalog identities and membership, never catalog credits or EUR", () => {
  for (const machineId of ["common", "rare", "epic"] as const) {
    const rows = createDefaultEngineItems(machineId);
    assert.equal(rows.length, stockCatalog.filter((row) => row.machineIds.includes(machineId) && (!row.availability || row.availability === "active")).length);
    assert.ok(rows.every((row) => row.initialStock === 100));
    const start = summarizeEngine(createEngine(createDefaultEngineConfig(machineId), rows));
    assert.equal(start.availablePercent, 100);
    assert.equal(start.reservedPercent, 0);
  }
  const common = createDefaultEngineItems("common");
  const packs = common.filter((row) => row.kind === "pack" && !row.id.endsWith("-packs"));
  assert.ok(packs.length > 1);
  assert.ok(packs.every((row) => row.marketCents === 600 && row.costCents === 300 && row.weight === 80));
  assert.equal(createDefaultEngineConfig().pullPriceCents, 1000);
});
