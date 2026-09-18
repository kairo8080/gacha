import assert from "node:assert/strict";
import test from "node:test";
import { compareAndWriteSession } from "./session-commit.ts";

function storage(initial: string | null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
}

test("serialized same-tab predecessors allow consecutive queued updates", () => {
  const saved = storage("base");
  assert.deepEqual(compareAndWriteSession(saved, "demo", "base", "first"), {
    status: "committed",
  });
  assert.deepEqual(compareAndWriteSession(saved, "demo", "first", "second"), {
    status: "committed",
  });
  assert.equal(saved.getItem(), "second");
});

test("a competing tab's settings or award cannot be overwritten by a stale snapshot", () => {
  const saved = storage("base");
  compareAndWriteSession(saved, "demo", "base", "admin-new-odds");
  assert.deepEqual(
    compareAndWriteSession(saved, "demo", "base", "player-old-odds"),
    { status: "conflict", current: "admin-new-odds" },
  );
  assert.equal(saved.getItem(), "admin-new-odds");
  assert.equal(
    compareAndWriteSession(saved, "demo", "player-old-odds", "queued-award")
      .status,
    "conflict",
  );
});

test("missing state migrates once and deletion conflicts with an older pending write", () => {
  const saved = storage(null);
  assert.equal(
    compareAndWriteSession(saved, "demo", null, "migrated-v5").status,
    "committed",
  );
  assert.equal(
    compareAndWriteSession(saved, "demo", null, "other-migration").status,
    "conflict",
  );
  assert.deepEqual(
    compareAndWriteSession(storage(null), "demo", "old-v5", "pending"),
    { status: "conflict", current: null },
  );
});

test("failed reads/writes return unavailable without claiming persistence", () => {
  assert.equal(
    compareAndWriteSession(
      {
        getItem() {
          throw new Error("disabled");
        },
        setItem() {},
      },
      "demo",
      null,
      "next",
    ).status,
    "unavailable",
  );
  assert.equal(
    compareAndWriteSession(
      {
        getItem() {
          return "base";
        },
        setItem() {
          throw new Error("quota");
        },
      },
      "demo",
      "base",
      "next",
    ).status,
    "unavailable",
  );
  assert.equal(
    compareAndWriteSession(
      {
        getItem() {
          return "same";
        },
        setItem() {
          throw new Error("not needed");
        },
      },
      "demo",
      "same",
      "same",
    ).status,
    "committed",
  );
});
