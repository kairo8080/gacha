import assert from "node:assert/strict";
import test from "node:test";
import { stockCatalog, type StockPrize } from "./catalog.ts";
import { copyStockPrize, isStockPrize } from "./ghost-stock.ts";
import {
  demoReducer,
  getMachines,
  initialState,
  parseSavedState,
  remainingStock,
  type DemoState,
} from "./demo.ts";
import {
  calculateMachineOdds,
  defaultMachineOddsConfig,
  getLiveMachineOdds,
  getMachineOddsConfig,
  isMachineOddsConfig,
  samplePrizeIndex,
  type MachineOddsConfig,
} from "./odds.ts";

const date = "2026-09-18T00:00:00.000Z";
const config: MachineOddsConfig = {
  enabled: true,
  pullPriceEur: 10,
  targetEdge: 0.2,
  feeEur: 0.5,
};
const near = (actual: number, expected: number, epsilon = 1e-10) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);

function fixture(): DemoState {
  return {
    ...initialState,
    stockCatalog: stockCatalog.map((prize, index): StockPrize => ({
      ...copyStockPrize(prize),
      machineIds: index < 2 ? ["common", "rare"] : [],
      startingQuantity: index < 2 ? 10 : 0,
      buyCostEur: index === 0 ? 2 : 20,
      marketPriceEur: index === 0 ? 4 : 12,
      marketCheckedAt: date,
    })),
  };
}

function enable(state = fixture()) {
  return demoReducer(state, { type: "save-odds", machineId: "common", config });
}

function pull(
  state: DemoState,
  index: number,
  machineId: "common" | "rare" = "common",
) {
  return demoReducer(state, {
    type: "pull",
    machineId,
    itemId: `pull-${state.pulls}`,
    prizeIndex: index,
    createdAt: date,
  });
}

test("odds sum to 100%, retain every reward and satisfy both EK and VK targets", () => {
  const state = enable();
  const odds = calculateMachineOdds(state, "common");
  assert.equal(odds.status, "ready");
  near(
    odds.rows.reduce((sum, row) => sum + row.probability, 0),
    1,
  );
  assert.ok(odds.rows.every((row) => row.probability > 0));
  assert.ok(odds.rows[0].probability > 0.5);
  assert.ok(odds.expectedCostEur! <= 7.5);
  assert.ok(odds.expectedMarketEur! <= 7.5);
  assert.ok(
    odds.expectedProfitEur! / config.pullPriceEur! >= config.targetEdge,
  );
  assert.ok(odds.houseEdge! >= config.targetEdge);
  near(odds.expectedProfitEur!, 9.5 - odds.expectedCostEur!);
  near(odds.houseEdge!, (9.5 - odds.expectedMarketEur!) / 10);
  near(odds.marketRtp!, odds.expectedMarketEur! / 10);
  assert.deepEqual(getLiveMachineOdds(state, "common"), odds);
  // An expensive individual outcome remains possible and exceeds the pull price.
  assert.ok(odds.rows[1].probability > 0);
});

test("feasible stock baseline is preserved without unnecessary tilting", () => {
  const state = fixture();
  state.stockCatalog![0].startingQuantity = 30;
  const odds = calculateMachineOdds(state, "common", {
    ...config,
    pullPriceEur: 100,
  });
  near(odds.rows[0].probability, 0.75);
  near(odds.rows[1].probability, 0.25);
});

test("missing EK or VK blocks enabled tuning and stale enabling is rejected", () => {
  for (const patch of [
    { buyCostEur: null },
    { buyCostEur: undefined },
    { marketPriceEur: null },
  ]) {
    const state = fixture();
    Object.assign(state.stockCatalog![0], patch);
    const odds = calculateMachineOdds(state, "common", config);
    assert.equal(odds.status, "missing-values");
    assert.equal(odds.missingCount, 1);
    assert.ok(odds.rows.every((row) => row.probability === 0));
    assert.equal(enable(state), state);
    const previouslyEnabled = { ...state, oddsSettings: { common: config } };
    assert.equal(
      getLiveMachineOdds(previouslyEnabled, "common").status,
      "missing-values",
    );
    assert.equal(samplePrizeIndex(previouslyEnabled, "common", 0), -1);
    assert.equal(pull(previouslyEnabled, 0), previouslyEnabled);
  }
});

test("unconfigured, empty and infeasible boundary scenarios fail closed", () => {
  const state = fixture();
  assert.equal(calculateMachineOdds(state, "common").status, "unconfigured");
  assert.equal(calculateMachineOdds(state, "epic", config).status, "empty");
  for (const pullPriceEur of [4, 5]) {
    const boundary = { ...config, pullPriceEur, feeEur: 0 };
    const odds = calculateMachineOdds(state, "common", boundary);
    assert.equal(odds.status, "infeasible");
    assert.ok(odds.rows.every((row) => row.probability === 0));
  }
  assert.equal(
    calculateMachineOdds(state, "common", { ...config, feeEur: 9 }).status,
    "infeasible",
  );
});

test("invalid numbers and configurations cannot enter state or the solver", () => {
  const state = fixture();
  for (const patch of [
    { pullPriceEur: 0 },
    { pullPriceEur: -1 },
    { pullPriceEur: NaN },
    { pullPriceEur: Infinity },
    { pullPriceEur: 100001 },
    { targetEdge: 0 },
    { targetEdge: 1 },
    { targetEdge: -1 },
    { targetEdge: Infinity },
    { feeEur: -1 },
    { feeEur: NaN },
    { feeEur: 100001 },
    { enabled: "yes" },
  ]) {
    const invalid = { ...config, ...patch } as MachineOddsConfig;
    assert.equal(isMachineOddsConfig(invalid), false);
    assert.equal(
      demoReducer(state, {
        type: "save-odds",
        machineId: "common",
        config: invalid,
      }),
      state,
    );
    assert.equal(
      calculateMachineOdds(state, "common", invalid).status,
      "unconfigured",
    );
  }
  for (const value of [-1, Infinity, NaN, 100001, "4"]) {
    assert.equal(
      isStockPrize({ ...state.stockCatalog![0], buyCostEur: value }),
      false,
    );
    assert.equal(
      isStockPrize({ ...state.stockCatalog![0], marketPriceEur: value }),
      false,
    );
  }
  assert.equal(
    isStockPrize({
      ...state.stockCatalog![0],
      buyCostEur: 0,
      marketPriceEur: 0,
    }),
    true,
  );
});

test("depletion is recomputed every draw and becomes blocked when cheap stock ends", () => {
  const seed = fixture();
  seed.stockCatalog![0].startingQuantity = 1;
  const state = enable(seed);
  assert.equal(getLiveMachineOdds(state, "common").status, "ready");
  const next = pull(state, 0);
  assert.equal(next.pulls, 1);
  assert.equal(remainingStock(next, stockCatalog[0].id), 0);
  assert.equal(getLiveMachineOdds(next, "common").status, "infeasible");
  assert.equal(samplePrizeIndex(next, "common", 0.5), -1);
  assert.equal(pull(next, 1), next);
  const disabled = demoReducer(next, {
    type: "save-odds",
    machineId: "common",
    config: { ...config, enabled: false },
  });
  assert.equal(samplePrizeIndex(disabled, "common", 0), 1);
  assert.equal(pull(disabled, 0), disabled);
});

test("shared stock reservations in another machine update odds, resale restores units", () => {
  const state = enable();
  const before = getLiveMachineOdds(state, "common");
  const awarded = pull(state, 0, "rare");
  assert.equal(
    getLiveMachineOdds(awarded, "common").rows[0].available,
    before.rows[0].available - 1,
  );
  const sold = demoReducer(awarded, {
    type: "sell",
    itemId: awarded.items[0].id,
  });
  assert.deepEqual(getLiveMachineOdds(sold, "common"), before);
});

test("inactive, unassigned and depleted rewards are excluded without requiring prices", () => {
  const state = fixture();
  state.stockCatalog![0].availability = "paused";
  assert.equal(
    calculateMachineOdds(state, "common", { ...config, pullPriceEur: 100 }).rows
      .length,
    1,
  );
  state.stockCatalog![0].availability = "retired";
  assert.equal(getLiveMachineOdds(state, "common").rows.length, 1);
  state.stockCatalog![0].availability = "active";
  state.stockCatalog![0].startingQuantity = 0;
  state.stockCatalog![0].buyCostEur = null;
  const odds = calculateMachineOdds(state, "common", {
    ...config,
    pullPriceEur: 100,
  });
  assert.equal(odds.status, "ready");
  assert.equal(odds.rows[0].probability, 0);
  assert.equal(odds.rows[1].probability, 1);
});

test("sampling intervals exactly match displayed rows and machine prize indexes", () => {
  for (const state of [fixture(), enable()]) {
    const odds = getLiveMachineOdds(state, "common");
    const prizes = getMachines(state)[0].prizes;
    let start = 0;
    for (const [index, row] of odds.rows.entries()) {
      assert.equal(row.prizeId, prizes[index].id);
      assert.equal(
        samplePrizeIndex(state, "common", start + row.probability / 2),
        index,
      );
      start += row.probability;
    }
    assert.equal(samplePrizeIndex(state, "common", 0), 0);
    assert.equal(samplePrizeIndex(state, "common", 1 - Number.EPSILON), 1);
    for (const unit of [-1, 1, NaN, Infinity])
      assert.equal(samplePrizeIndex(state, "common", unit), -1);
  }
});

test("configuration survives reload and reset; invalid saved maps are rejected", () => {
  const state = pull(enable(), 0);
  assert.deepEqual(parseSavedState(JSON.stringify(state)), state);
  const reset = demoReducer(state, { type: "reset" });
  assert.equal(reset.pulls, 0);
  assert.deepEqual(reset.oddsSettings, state.oddsSettings);
  assert.deepEqual(reset.stockCatalog, state.stockCatalog);
  for (const oddsSettings of [
    null,
    [],
    { invalid: config },
    { common: {} },
    { common: { ...config, feeEur: -1 } },
  ]) {
    assert.equal(
      parseSavedState(JSON.stringify({ ...state, oddsSettings })),
      initialState,
    );
  }
  const configuredOnly = demoReducer(initialState, {
    type: "save-odds",
    machineId: "rare",
    config: defaultMachineOddsConfig,
  });
  assert.deepEqual(
    demoReducer(configuredOnly, { type: "reset" }).oddsSettings,
    configuredOnly.oddsSettings,
  );
});

test("old v5 metadata absence stays intact and default mode remains stock weighted", () => {
  const historical = pull(initialState, 0);
  assert.deepEqual(parseSavedState(JSON.stringify(historical)), historical);
  assert.equal("oddsSettings" in historical, false);
  assert.equal("buyCostEur" in historical.items[0].prize, false);
  assert.deepEqual(
    getMachineOddsConfig(historical, "common"),
    defaultMachineOddsConfig,
  );
  const odds = getLiveMachineOdds(historical, "common");
  assert.equal(odds.status, "ready");
  near(odds.rows[0].probability, 99 / 5299);
  assert.equal(odds.expectedCostEur, null);
  assert.equal(odds.expectedMarketEur, null);
});

test("manual EK and VK persist without a URL, and price edits preserve historical awards", () => {
  const state = pull(enable(), 0);
  const seed = state.stockCatalog![0];
  assert.equal(seed.cardmarketUrl, null);
  assert.equal(isStockPrize(seed), true);
  const next = demoReducer(state, {
    type: "save-stock",
    prize: { ...seed, buyCostEur: 6, marketPriceEur: 7 },
  });
  assert.equal((next.items[0].prize as StockPrize).buyCostEur, 2);
  assert.equal((next.items[0].prize as StockPrize).marketPriceEur, 4);
  assert.deepEqual(parseSavedState(JSON.stringify(next)), next);
  assert.equal(next.stockCatalog![0].buyCostEur, 6);
  assert.equal(next.stockCatalog![0].marketPriceEur, 7);
  assert.equal(isStockPrize({ ...seed, marketCheckedAt: null }), false);
});

test("numerically extreme input never produces NaN or silently zeroed eligible odds", () => {
  const state = fixture();
  state.stockCatalog![0].buyCostEur = 0;
  state.stockCatalog![0].marketPriceEur = 0;
  state.stockCatalog![1].buyCostEur = 100000;
  state.stockCatalog![1].marketPriceEur = 100000;
  for (const pullPriceEur of [0.000001, 1, 100000]) {
    const odds = calculateMachineOdds(state, "common", {
      ...config,
      pullPriceEur,
      feeEur: 0,
    });
    assert.equal(odds.status, "ready");
    assert.ok(
      odds.rows.every(
        (row) => Number.isFinite(row.probability) && row.probability > 0,
      ),
    );
    near(
      odds.rows.reduce((sum, row) => sum + row.probability, 0),
      1,
    );
    assert.ok(odds.houseEdge! >= config.targetEdge);
  }
  const unrepresentable = { ...config, pullPriceEur: 1e-20, feeEur: 0 };
  const odds = calculateMachineOdds(state, "common", unrepresentable);
  assert.equal(odds.status, "infeasible");
  assert.ok(odds.rows.every((row) => row.probability === 0));
  state.oddsSettings = { common: unrepresentable };
  assert.equal(samplePrizeIndex(state, "common", 0), -1);
});
