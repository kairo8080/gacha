import assert from "node:assert/strict";
import test from "node:test";
import {
  demoReducer,
  initialState,
  machines,
  parseSavedState,
  parsePreviousSavedState,
  getShippingStage,
  resaleValue,
  stockCatalog,
  totalStartingStock,
  remainingStock,
  machineStock,
  drawPrizeIndex,
  getStockCatalog,
  getMachines,
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
  const queued = demoReducer(pulled(), { type: "queue", itemId: "item-1" });
  const shipped = demoReducer(queued, {
    type: "ship",
    itemId: "item-1",
    demoDay: 60,
  });
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
  assert.equal(stockCatalog.length, 60);
  assert.equal(totalStartingStock, 6000);
  for (const prize of stockCatalog) {
    assert.equal(prize.startingQuantity, 100);
    assert.equal(prize.language, "EN");
    assert.equal(prize.marketPriceEur, null);
    assert.equal(prize.cardmarketUrl, null);
    assert.equal(
      Object.keys(prize).some((key) =>
        /warehouse|private|realStock/i.test(key),
      ),
      false,
    );
  }
  assert.deepEqual(
    machines.map((machine) => machineStock(initialState, machine.id)),
    [5300, 5000, 2000],
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
      demoReducer(state, { type: "queue", itemId: "item-1" }),
      prizeId,
    ),
    99,
  );
});

test("redemption and queuing reserve a prize and permanently prevent resale", () => {
  const state = pulled();
  const redeemed = demoReducer(state, { type: "redeem", itemId: "item-1" });
  assert.equal(redeemed.items[0].status, "redeemed");
  assert.equal(redeemed.balance, state.balance);
  assert.equal(
    demoReducer(redeemed, { type: "redeem", itemId: "item-1" }),
    redeemed,
  );
  assert.equal(
    demoReducer(redeemed, { type: "sell", itemId: "item-1" }),
    redeemed,
  );
  const queued = demoReducer(redeemed, { type: "queue", itemId: "item-1" });
  assert.equal(queued.items[0].status, "queued");
  assert.equal(demoReducer(queued, { type: "sell", itemId: "item-1" }), queued);
  assert.equal(
    demoReducer(queued, { type: "queue", itemId: "item-1" }),
    queued,
  );
  assert.equal(remainingStock(queued, state.items[0].prize.id), 99);
  assert.deepEqual(
    demoReducer(state, { type: "queue", itemId: "item-1" }),
    queued,
  );
  const sold = demoReducer(state, { type: "sell", itemId: "item-1" });
  assert.equal(demoReducer(sold, { type: "redeem", itemId: "item-1" }), sold);
  assert.equal(demoReducer(sold, { type: "queue", itemId: "item-1" }), sold);
});

test("only queued requests ship, at validated demo day 60 or later", () => {
  const held = pulled();
  const redeemed = demoReducer(held, { type: "redeem", itemId: "item-1" });
  for (const state of [held, redeemed]) {
    assert.equal(
      demoReducer(state, { type: "ship", itemId: "item-1", demoDay: 60 }),
      state,
    );
  }
  const queued = demoReducer(held, { type: "queue", itemId: "item-1" });
  for (const demoDay of [-1, 0, 59, 59.9, 60.5, 3651, Infinity, NaN]) {
    assert.equal(
      demoReducer(queued, { type: "ship", itemId: "item-1", demoDay }),
      queued,
    );
  }
  assert.equal(getShippingStage(queued.items[0], 59), "queued");
  assert.equal(getShippingStage(queued.items[0], 60), "ready");
  for (const demoDay of [60, 61, 3650]) {
    const shipped = demoReducer(queued, {
      type: "ship",
      itemId: "item-1",
      demoDay,
    });
    assert.equal(shipped.items[0].status, "shipping");
    assert.equal(shipped.balance, held.balance);
    assert.equal(
      demoReducer(shipped, { type: "ship", itemId: "item-1", demoDay }),
      shipped,
    );
    assert.equal(
      demoReducer(shipped, { type: "queue", itemId: "item-1" }),
      shipped,
    );
  }
});

test("all current lifecycle states round-trip and old shipping previews migrate to queued", () => {
  for (const status of [
    "held",
    "sold",
    "redeemed",
    "queued",
    "shipping",
  ] as const) {
    const state = pulled();
    state.items[0] = { ...state.items[0], status };
    assert.deepEqual(parseSavedState(JSON.stringify(state)), state);
    const migrated = parsePreviousSavedState(JSON.stringify(state));
    assert.equal(
      migrated.items[0].status,
      status === "shipping" ? "queued" : status,
    );
  }
  const state = pulled();
  assert.equal(
    parseSavedState(
      JSON.stringify({
        ...state,
        pulls: 2,
        items: [...state.items, ...state.items],
      }),
    ),
    initialState,
  );
  assert.equal(
    parseSavedState(
      JSON.stringify({
        ...state,
        items: [{ ...state.items[0], status: "delivered" }],
      }),
    ),
    initialState,
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
  assert.equal(
    drawPrizeIndex(state, "common", machineStock(state, "common") - 1),
    getMachines(state)[0].prizes.length - 1,
  );
  assert.equal(
    drawPrizeIndex(state, "common", machineStock(state, "common")),
    -1,
  );
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
    2000,
  );
});

const awardedAt = "2026-09-18T00:00:00.000Z";

function pullSku(
  state: DemoState,
  id: string,
  machineId: "common" | "rare" | "epic",
  itemId: string,
) {
  return demoReducer(state, {
    type: "pull",
    machineId,
    itemId,
    createdAt: awardedAt,
    prizeIndex: getMachines(state)
      .find((machine) => machine.id === machineId)!
      .prizes.findIndex((prize) => prize.id === id),
  });
}

test("one shared SKU reserves the same reward unit across different machine tiers", () => {
  const seed = stockCatalog.find((prize) => prize.kind === "box")!;
  let state = demoReducer(initialState, {
    type: "save-stock",
    prize: { ...seed, startingQuantity: 2 },
  });
  state = pullSku(state, seed.id, "common", "common-box");
  assert.equal(remainingStock(state, seed.id), 1);
  state = pullSku(state, seed.id, "rare", "rare-box");
  assert.equal(remainingStock(state, seed.id), 0);
  assert.equal(pullSku(state, seed.id, "epic", "epic-box"), state);
  const sold = demoReducer(state, { type: "sell", itemId: "common-box" });
  assert.equal(remainingStock(sold, seed.id), 1);
  assert.equal(pullSku(sold, seed.id, "epic", "epic-box").items.length, 3);
});

test("two and three pack bundles each consume one reward unit and one draw ticket", () => {
  for (const packCount of [2, 3]) {
    const seed = stockCatalog.find((prize) => prize.packCount === packCount)!;
    let state = demoReducer(initialState, {
      type: "save-stock",
      prize: { ...seed, startingQuantity: 2 },
    });
    const before = machineStock(state, "common");
    state = pullSku(state, seed.id, "common", `bundle-${packCount}`);
    assert.equal(remainingStock(state, seed.id), 1);
    assert.equal(machineStock(state, "common"), before - 1);
    assert.equal(state.items[0].prize.packCount, packCount);
  }
});

test("catalog edits persist without changing historical award values or membership", () => {
  const original = pulled();
  const seed = getStockCatalog(original).find(
    (prize) => prize.id === original.items[0].prize.id,
  )!;
  const edited = demoReducer(original, {
    type: "save-stock",
    prize: {
      ...seed,
      name: "Edited reward",
      detail: "Edited EN sample",
      value: 44,
      machineIds: [],
      startingQuantity: 1,
      cardmarketUrl:
        "https://www.cardmarket.com/en/Lorcana/Products/Boosters/Rise-of-the-Floodborn-Booster",
      marketPriceEur: 4.25,
      marketCheckedAt: awardedAt,
    },
  });
  assert.notEqual(edited, original);
  assert.equal(edited.items[0].prize.value, 8);
  const restored = parseSavedState(JSON.stringify(edited));
  assert.deepEqual(restored, edited);
  assert.equal(
    getMachines(restored)[0].prizes.some((prize) => prize.id === seed.id),
    false,
  );
  assert.equal(
    getStockCatalog(restored).find((prize) => prize.id === seed.id)!
      .marketPriceEur,
    4.25,
  );
  const sold = demoReducer(restored, { type: "sell", itemId: "item-1" });
  assert.equal(sold.balance, restored.balance + 6.4);
  assert.equal(remainingStock(sold, seed.id), 1);
});

test("new catalog rows are validated, restored and draw from their configured machine", () => {
  const seed = stockCatalog.find((prize) => prize.kind === "mystery")!;
  const created = demoReducer(initialState, {
    type: "save-stock",
    prize: { ...seed, id: "custom-mystery", machineIds: ["rare"] },
  });
  assert.equal(getStockCatalog(created).length, stockCatalog.length + 1);
  const restored = parseSavedState(JSON.stringify(created));
  assert.deepEqual(restored, created);
  assert.equal(
    getMachines(restored)[0].prizes.some(
      (prize) => prize.id === "custom-mystery",
    ),
    false,
  );
  assert.equal(
    pullSku(restored, "custom-mystery", "rare", "custom-award").items[0].prize
      .id,
    "custom-mystery",
  );
});

test("invalid catalog edits and stock below reservations are rejected atomically", () => {
  const state = pulled();
  const seed = getStockCatalog(state).find(
    (prize) => prize.id === state.items[0].prize.id,
  )!;
  const invalid = [
    { language: "FR" },
    { id: "../unsafe" },
    { packCount: 4 },
    { grade: "PSA 8" },
    { kind: ["mystery"], packCount: undefined },
    { kind: "graded", packCount: undefined, grade: ["PSA 9"] },
    { kind: "graded", packCount: undefined, grade: "PSA 8" },
    { startingQuantity: 0 },
    { startingQuantity: 1.5 },
    { startingQuantity: -1 },
    { value: Infinity },
    { value: -1 },
    { value: 100001 },
    { machineIds: ["common", "common"] },
    { machineIds: ["invalid"] },
    { setId: "unknown-set" },
    { cardmarketUrl: "https://evil.test/en/Lorcana/Products/Boosters/Sample" },
    { cardmarketUrl: "javascript:alert(1)" },
    {
      cardmarketUrl:
        "https://user:pass@www.cardmarket.com/en/Lorcana/Products/Boosters/Sample",
    },
    {
      cardmarketUrl:
        "https://www.cardmarket.com/en/Lorcana/Products/Boosters/Sample#script",
    },
    {
      cardmarketUrl:
        "https://www.cardmarket.com/fr/Lorcana/Products/Boosters/Sample",
    },
    { marketPriceEur: 4 },
    { marketCheckedAt: awardedAt },
    {
      marketPriceEur: 4,
      cardmarketUrl:
        "https://www.cardmarket.com/en/Lorcana/Products/Boosters/Sample",
      marketCheckedAt: "2026-02-30T00:00:00Z",
    },
  ];
  for (const patch of invalid) {
    assert.equal(
      demoReducer(state, {
        type: "save-stock",
        prize: { ...seed, ...patch } as typeof seed,
      }),
      state,
      JSON.stringify(patch),
    );
  }
  const referenced = demoReducer(state, {
    type: "save-stock",
    prize: {
      ...seed,
      cardmarketUrl:
        "https://www.cardmarket.com/en/Lorcana/Products/Boosters/Sample",
    },
  });
  assert.notEqual(referenced, state);
});

test("saved mutable catalogs reject malformed rows and historical snapshot corruption", () => {
  const state = demoReducer(pulled(), {
    type: "save-stock",
    prize: { ...stockCatalog[0], value: 95 },
  });
  for (const saved of [
    { ...state, stockCatalog: state.stockCatalog!.slice(1) },
    {
      ...state,
      stockCatalog: [...state.stockCatalog!, state.stockCatalog![0]],
    },
    {
      ...state,
      items: [
        {
          ...state.items[0],
          prize: { ...state.items[0].prize, value: 999999 },
        },
      ],
    },
    {
      ...state,
      items: [
        {
          ...state.items[0],
          prize: { ...state.items[0].prize, language: "FR" },
        },
      ],
    },
  ])
    assert.equal(parseSavedState(JSON.stringify(saved)), initialState);
});

test("session reset clears wallet and reservations while retaining admin catalog configuration", () => {
  const seed = stockCatalog.find((prize) => prize.kind === "mystery")!;
  let state = demoReducer(initialState, {
    type: "save-stock",
    prize: {
      ...seed,
      name: "Configured mystery",
      value: 31,
      startingQuantity: 7,
      machineIds: ["rare"],
    },
  });
  state = demoReducer(state, {
    type: "save-stock",
    prize: {
      ...seed,
      id: "admin-added-reward",
      name: "Admin added reward",
      startingQuantity: 4,
      machineIds: [],
    },
  });
  state = pullSku(state, seed.id, "rare", "before-reset");
  assert.equal(remainingStock(state, seed.id), 6);
  const reset = demoReducer(state, { type: "reset" });
  assert.equal(reset.balance, 250);
  assert.equal(reset.pulls, 0);
  assert.deepEqual(reset.items, []);
  assert.deepEqual(getStockCatalog(reset), getStockCatalog(state));
  assert.equal(remainingStock(reset, seed.id), 7);
  assert.equal(
    getMachines(reset)[0].prizes.some((prize) => prize.id === seed.id),
    false,
  );
  assert.equal(
    getStockCatalog(reset).find((prize) => prize.id === "admin-added-reward")!
      .startingQuantity,
    4,
  );
  assert.deepEqual(parseSavedState(JSON.stringify(reset)), reset);
  assert.equal(
    pullSku(reset, seed.id, "rare", "after-reset").items[0].prize.value,
    31,
  );
});
