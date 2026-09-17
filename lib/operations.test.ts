import assert from "node:assert/strict";
import test from "node:test";
import { demoReducer, initialState, machines, resaleValue } from "./demo.ts";
import {
  getDemoMetrics,
  parseOperations,
  restoreDemoSession,
} from "./operations.ts";

test("demo clock defaults to day zero and only accepts bounded whole days", () => {
  for (const raw of [
    null,
    "broken",
    "null",
    "0",
    "{}",
    '{"demoDay":"60"}',
    '{"demoDay":-1}',
    '{"demoDay":60.5}',
    '{"demoDay":3651}',
  ]) {
    assert.deepEqual(parseOperations(raw), { demoDay: 0 });
  }
  for (const demoDay of [0, 59, 60, 3650])
    assert.deepEqual(parseOperations(JSON.stringify({ demoDay })), { demoDay });
});

function pull(id: string, state = initialState) {
  return demoReducer(state, {
    type: "pull",
    machineId: "common",
    itemId: id,
    prizeIndex: 0,
    createdAt: "2026-09-17T00:00:00Z",
  });
}

test("migration prefers canonical state and preserves old preview reservations", () => {
  const old = pull("preview");
  old.items[0] = { ...old.items[0], status: "shipping" };
  const previousRaw = JSON.stringify(old);
  const migrated = restoreDemoSession(null, previousRaw);
  assert.equal(migrated.items[0].status, "queued");
  assert.equal(JSON.parse(previousRaw).items[0].status, "shipping");
  assert.deepEqual(
    restoreDemoSession(JSON.stringify(migrated), previousRaw),
    migrated,
  );
  assert.deepEqual(
    restoreDemoSession(JSON.stringify(initialState), previousRaw),
    initialState,
  );
  assert.equal(restoreDemoSession("corrupt", previousRaw), initialState);
});

test("metrics count each pull, redemption, and shipping request exactly once", () => {
  let state = initialState;
  for (const id of ["held", "sold", "redeemed", "queued", "shipping"])
    state = pull(id, state);
  state = demoReducer(state, { type: "sell", itemId: "sold" });
  state = demoReducer(state, { type: "redeem", itemId: "redeemed" });
  state = demoReducer(state, { type: "queue", itemId: "queued" });
  state = demoReducer(state, { type: "queue", itemId: "shipping" });
  state = demoReducer(state, { type: "ship", itemId: "shipping", demoDay: 60 });
  const metrics = getDemoMetrics(state);
  assert.equal(metrics.totalPulls, 5);
  assert.deepEqual(metrics.pullsByMachine, { common: 5, rare: 0, epic: 0 });
  assert.equal(metrics.usersPlayed, 1);
  assert.equal(metrics.revenue, machines[0].price * 5);
  assert.equal(metrics.sellBacks, 1);
  assert.equal(metrics.sellBackCredits, resaleValue(machines[0].prizes[0]));
  assert.equal(metrics.redemptions, 3);
  assert.equal(metrics.shippingRequests, 2);
  assert.equal(metrics.collectionValue, machines[0].prizes[0].value);
  assert.equal(metrics.bestPull?.id, "held");
  assert.equal(metrics.profit, null);
  assert.equal(getDemoMetrics(initialState).usersPlayed, 0);
  assert.equal(getDemoMetrics(initialState).bestPull, undefined);
});
