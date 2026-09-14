import assert from "node:assert/strict";
import test from "node:test";
import {
  demoReducer,
  initialState,
  machines,
  parseSavedState,
  resaleValue,
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
