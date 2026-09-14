import assert from "node:assert/strict";
import test from "node:test";
import {
  demoReducer,
  initialState,
  machines,
  parseSavedState,
  resaleValue,
  stockCatalog,
  totalStartingStock,
  remainingStock,
  machineStock,
  drawPrizeIndex,
  type DemoState,
} from "./demo.ts";

const pulled = () =>
  demoReducer(initialState, {
    type: "pull",
    machineId: "common",
    itemId: "item-1",
    prizeIndex: 0,
    createdAt: "2026-09-14T00:00:00.000Z",
  });

test("pull is rejected when demo credits are insufficient", () => {
  const state = { ...initialState, balance: 9 };
  assert.equal(
    demoReducer(state, {
      type: "pull",
      machineId: "common",
      itemId: "item-1",
      prizeIndex: 0,
      createdAt: "2026-09-14T00:00:00.000Z",
    }),
    state,
  );
});

test("duplicate pull item IDs are rejected", () => {
  const state = pulled();
  const result = demoReducer(state, {
    type: "pull",
    machineId: "rare",
    itemId: "item-1",
    prizeIndex: 0,
    createdAt: "2026-09-14T00:01:00.000Z",
  });
  assert.equal(result, state);
});

test("selling a held prize credits its illustrative resale value only once", () => {
  const state = pulled();
  const sold = demoReducer(state, { type: "sell", itemId: "item-1" });
  assert.equal(
    sold.balance,
    state.balance + resaleValue(machines[0].prizes[0]),
  );
  assert.equal(sold.items[0].status, "sold");
  assert.equal(demoReducer(sold, { type: "sell", itemId: "item-1" }), sold);
});

test("resale value keeps two decimal demo credits", () => {
  assert.equal(resaleValue(machines[0].prizes[0]), 6.4);
});

test("selling and shipping are mutually exclusive", () => {
  const shipped = demoReducer(pulled(), { type: "ship", itemId: "item-1" });
  assert.equal(shipped.items[0].status, "shipping");
  assert.equal(
    demoReducer(shipped, { type: "sell", itemId: "item-1" }),
    shipped,
  );
});

test("corrupt or tampered saved state returns the initial demo state", () => {
  assert.equal(parseSavedState("not json"), initialState);
  assert.equal(
    parseSavedState(
      JSON.stringify({
        balance: 250,
        pulls: 1,
        items: [
          {
            id: "item-1",
            machineId: "common",
            status: "held",
            createdAt: "2026-09-14T00:00:00.000Z",
            prize: { ...machines[0].prizes[0], value: 999999 },
          },
        ],
      }),
    ),
    initialState,
  );
});

test("public stock uses identical fictional quantities with no warehouse fields", () => {
  assert.equal(stockCatalog.length, 14);
  assert.equal(totalStartingStock, 1400);
  for (const prize of stockCatalog) {
    assert.equal(prize.startingQuantity, 100);
    assert.deepEqual(Object.keys(prize).sort(), [
      "detail",
      "id",
      "kind",
      "machineId",
      "name",
      "startingQuantity",
      "value",
    ]);
  }
  assert.deepEqual(
    machines.map((machine) => machineStock(initialState, machine.id)),
    [700, 500, 200],
  );
});

test("a pull reserves one pack, resale returns it once, and shipping keeps it reserved", () => {
  const prizeId = machines[0].prizes[0].id;
  const state = pulled();
  assert.equal(remainingStock(state, prizeId), 99);
  const sold = demoReducer(state, { type: "sell", itemId: "item-1" });
  assert.equal(remainingStock(sold, prizeId), 100);
  assert.equal(
    remainingStock(
      demoReducer(sold, { type: "sell", itemId: "item-1" }),
      prizeId,
    ),
    100,
  );
  assert.equal(
    remainingStock(
      demoReducer(state, { type: "ship", itemId: "item-1" }),
      prizeId,
    ),
    99,
  );
});

function exhaustFirstEpicSet(): DemoState {
  let state: DemoState = { ...initialState, balance: 10000 };
  for (let index = 0; index < 100; index++) {
    state = demoReducer(state, {
      type: "pull",
      machineId: "epic",
      itemId: `epic-${index}`,
      prizeIndex: 0,
      createdAt: "2026-09-14T00:00:00.000Z",
    });
  }
  return state;
}

test("stock exhaustion rejects an extra award without charging credits", () => {
  const state = exhaustFirstEpicSet();
  assert.equal(remainingStock(state, "the-first-chapter"), 0);
  assert.equal(
    demoReducer(state, {
      type: "pull",
      machineId: "epic",
      itemId: "one-too-many",
      prizeIndex: 0,
      createdAt: "2026-09-14T00:00:00.000Z",
    }),
    state,
  );
});

test("draw tickets follow remaining quantities, skip sold-out sets, and reject invalid tickets", () => {
  const state = pulled();
  assert.equal(drawPrizeIndex(state, "common", 98), 0);
  assert.equal(drawPrizeIndex(state, "common", 99), 1);
  assert.equal(drawPrizeIndex(state, "common", 698), 6);
  assert.equal(drawPrizeIndex(state, "common", 699), -1);
  assert.equal(drawPrizeIndex(state, "common", -1), -1);
  assert.equal(drawPrizeIndex(state, "common", 0.5), -1);
  assert.equal(drawPrizeIndex(exhaustFirstEpicSet(), "epic", 0), 1);
});

test("saved stock survives reload, oversubscribed sessions are rejected, reset restores seed", () => {
  const state = exhaustFirstEpicSet();
  const restored = parseSavedState(JSON.stringify(state));
  assert.equal(remainingStock(restored, "the-first-chapter"), 0);
  assert.equal(restored.items.length, 100);
  assert.equal(
    parseSavedState(
      JSON.stringify({
        ...state,
        pulls: 101,
        items: [...state.items, { ...state.items[0], id: "invalid-extra" }],
      }),
    ),
    initialState,
  );
  assert.equal(
    machineStock(demoReducer(state, { type: "reset" }), "epic"),
    200,
  );
});
