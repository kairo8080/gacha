import { machines, stockCatalog } from "./catalog.ts";

/**
 * Local-only state for the arcade demo. Credits, prizes, resale, and shipping
 * are illustrative UI mechanics; this module never performs commerce.
 */
export type MachineId = "common" | "rare" | "epic";

export type Prize = {
  id: string;
  name: string;
  detail: string;
  kind: "pack" | "graded";
  value: number;
  grade?: string;
  startingQuantity?: number;
  machineId?: MachineId;
};

export type Machine = {
  id: MachineId;
  name: string;
  level: string;
  price: number;
  tagline: string;
  description: string;
  prizes: Prize[];
};

export { machines, stockCatalog, totalStartingStock } from "./catalog.ts";

export type InventoryItem = {
  id: string;
  prize: Prize;
  machineId: MachineId;
  status: "held" | "sold" | "redeemed" | "queued" | "shipping";
  createdAt: string;
};

export type DemoState = {
  balance: number;
  items: InventoryItem[];
  pulls: number;
};

export const initialState: DemoState = { balance: 250, items: [], pulls: 0 };

/** Illustrative in-app credit rate only; it is not a resale offer. */
export const resaleRate = 0.8;
// Keep the old sample-prize session intact; stock simulation starts separately.
export const LEGACY_STORAGE_KEY = "gacha-demo-v1";
export const PREVIOUS_STORAGE_KEY = "gacha-demo-sample-v3";
export const STORAGE_KEY = "gacha-demo-sample-v4";
export const SHIPPING_UNLOCK_DAY = 60;

export function isValidDemoDay(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 3650
  );
}

/** The demo clock is a scenario control, not a real launch date or delivery promise. */
export function getShippingStage(item: InventoryItem, demoDay: number) {
  return item.status === "queued" &&
    isValidDemoDay(demoDay) &&
    demoDay >= SHIPPING_UNLOCK_DAY
    ? ("ready" as const)
    : item.status;
}

/** Kept and shipping-preview packs are reserved; demo resales return to this pool. */
export function remainingStock(state: DemoState, prizeId: string): number {
  const prize = stockCatalog.find((entry) => entry.id === prizeId);
  if (!prize) return 0;
  const reserved = state.items.filter(
    (item) => item.prize.id === prizeId && item.status !== "sold",
  ).length;
  return Math.max(0, prize.startingQuantity - reserved);
}

export function machineStock(state: DemoState, machineId: MachineId): number {
  return (machineById(machineId)?.prizes ?? []).reduce(
    (total, prize) => total + remainingStock(state, prize.id),
    0,
  );
}

/** Map an integer ticket to a remaining pack, weighting each set by available stock. */
export function drawPrizeIndex(
  state: DemoState,
  machineId: MachineId,
  ticket: number,
): number {
  const machine = machineById(machineId);
  if (!machine || !Number.isInteger(ticket) || ticket < 0) return -1;
  let cursor = ticket;
  for (const [index, prize] of machine.prizes.entries()) {
    const available = remainingStock(state, prize.id);
    if (cursor < available) return index;
    cursor -= available;
  }
  return -1;
}

export function resaleValue(prize: Prize): number {
  return Math.round(prize.value * resaleRate * 100) / 100;
}

export type DemoAction =
  | {
      type: "pull";
      machineId: MachineId;
      itemId: string;
      prizeIndex: number;
      createdAt: string;
    }
  | { type: "sell"; itemId: string }
  | { type: "redeem"; itemId: string }
  | { type: "queue"; itemId: string }
  | { type: "ship"; itemId: string; demoDay: number }
  | { type: "reset" };

const machineById = (id: MachineId) =>
  machines.find((machine) => machine.id === id);

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  if (action.type === "reset") return initialState;

  if (action.type === "pull") {
    const machine = machineById(action.machineId);
    if (
      !machine ||
      !Number.isInteger(action.prizeIndex) ||
      action.prizeIndex < 0 ||
      action.prizeIndex >= machine.prizes.length ||
      !isItemId(action.itemId) ||
      state.items.some((item) => item.id === action.itemId) ||
      state.balance < machine.price ||
      !isValidDate(action.createdAt)
    ) {
      return state;
    }
    if (remainingStock(state, machine.prizes[action.prizeIndex].id) === 0) {
      return state;
    }
    const item: InventoryItem = {
      id: action.itemId,
      prize: machine.prizes[action.prizeIndex],
      machineId: machine.id,
      status: "held",
      createdAt: action.createdAt,
    };
    return {
      balance: state.balance - machine.price,
      items: [...state.items, item],
      pulls: state.pulls + 1,
    };
  }

  const item = state.items.find((candidate) => candidate.id === action.itemId);
  if (!item) return state;

  if (action.type === "sell") {
    if (item.status !== "held") return state;
    return {
      ...state,
      balance: state.balance + resaleValue(item.prize),
      items: state.items.map((candidate) =>
        candidate.id === item.id ? { ...candidate, status: "sold" } : candidate,
      ),
    };
  }

  let nextStatus: InventoryItem["status"] | undefined;
  if (action.type === "redeem" && item.status === "held")
    nextStatus = "redeemed";
  if (
    action.type === "queue" &&
    (item.status === "held" || item.status === "redeemed")
  )
    nextStatus = "queued";
  if (
    action.type === "ship" &&
    item.status === "queued" &&
    isValidDemoDay(action.demoDay) &&
    action.demoDay >= SHIPPING_UNLOCK_DAY
  )
    nextStatus = "shipping";
  if (nextStatus) {
    return {
      ...state,
      items: state.items.map((candidate) =>
        candidate.id === item.id
          ? { ...candidate, status: nextStatus }
          : candidate,
      ),
    };
  }

  return state;
}

function isItemId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function catalogPrize(
  machineId: MachineId,
  prizeId: unknown,
): Prize | undefined {
  return machineById(machineId)?.prizes.find((prize) => prize.id === prizeId);
}

/** Safely reads the direct JSON state saved under STORAGE_KEY from localStorage. */
export function parseSavedState(raw: string | null): DemoState {
  if (raw === null) return initialState;
  try {
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return initialState;
    const candidate = saved as Record<string, unknown>;
    if (
      !Number.isFinite(candidate.balance) ||
      typeof candidate.balance !== "number" ||
      candidate.balance < 0 ||
      !Number.isInteger(candidate.pulls) ||
      typeof candidate.pulls !== "number" ||
      candidate.pulls < 0 ||
      !Array.isArray(candidate.items)
    ) {
      return initialState;
    }

    const ids = new Set<string>();
    const items: InventoryItem[] = [];
    for (const rawItem of candidate.items) {
      if (!rawItem || typeof rawItem !== "object") return initialState;
      const item = rawItem as Record<string, unknown>;
      if (
        !isItemId(item.id) ||
        ids.has(item.id) ||
        !isMachineId(item.machineId) ||
        !isStatus(item.status) ||
        !isValidDate(item.createdAt) ||
        !item.prize ||
        typeof item.prize !== "object"
      )
        return initialState;
      const rawPrize = item.prize as Record<string, unknown>;
      const prize = catalogPrize(item.machineId, rawPrize.id);
      if (!prize || !samePrize(rawPrize, prize)) return initialState;
      ids.add(item.id);
      items.push({
        id: item.id,
        machineId: item.machineId,
        status: item.status,
        createdAt: item.createdAt,
        prize,
      });
    }
    if (candidate.pulls !== items.length) return initialState;
    for (const prize of stockCatalog) {
      const reserved = items.filter(
        (item) => item.prize.id === prize.id && item.status !== "sold",
      ).length;
      if (reserved > prize.startingQuantity) return initialState;
    }
    return { balance: candidate.balance, pulls: candidate.pulls, items };
  } catch {
    return initialState;
  }
}

/** v3 shipping was only a preview; retain its request without marking it fulfilled. */
export function parsePreviousSavedState(raw: string | null): DemoState {
  const state = parseSavedState(raw);
  if (state === initialState) return state;
  return {
    ...state,
    items: state.items.map((item) =>
      item.status === "shipping" ? { ...item, status: "queued" } : item,
    ),
  };
}

function isMachineId(value: unknown): value is MachineId {
  return value === "common" || value === "rare" || value === "epic";
}

function isStatus(value: unknown): value is InventoryItem["status"] {
  return (
    value === "held" ||
    value === "sold" ||
    value === "redeemed" ||
    value === "queued" ||
    value === "shipping"
  );
}

function samePrize(saved: Record<string, unknown>, prize: Prize): boolean {
  return (
    saved.id === prize.id &&
    saved.name === prize.name &&
    saved.detail === prize.detail &&
    saved.kind === prize.kind &&
    saved.value === prize.value &&
    saved.grade === prize.grade &&
    saved.startingQuantity === prize.startingQuantity &&
    saved.machineId === prize.machineId
  );
}
