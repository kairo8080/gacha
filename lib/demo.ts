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

export const machines: Machine[] = [
  {
    id: "common",
    name: "Common",
    level: "Common",
    price: 10,
    tagline: "Easy pulls for a quick collection boost.",
    description: "A friendly demo machine with sample collectible prizes.",
    prizes: [
      {
        id: "common-lorcana-booster-pack",
        name: "Lorcana booster pack",
        detail: "Sample single booster prize",
        kind: "pack",
        value: 8,
      },
      {
        id: "common-two-pack-bundle",
        name: "Two-pack bundle",
        detail: "Sample pair of booster packs",
        kind: "pack",
        value: 10,
      },
      {
        id: "common-collector-pack",
        name: "Collector pack",
        detail: "Sample collector-focused pack",
        kind: "pack",
        value: 12,
      },
    ],
  },
  {
    id: "rare",
    name: "Rare",
    level: "Rare",
    price: 25,
    tagline: "Higher stakes, brighter showcase cards.",
    description: "A demo machine featuring sample collectible prizes.",
    prizes: [
      {
        id: "rare-premium-booster-bundle",
        name: "Premium booster bundle",
        detail: "Sample bundle of collectible boosters",
        kind: "pack",
        value: 28,
      },
      {
        id: "rare-graded-lorcana-card",
        name: "Graded Lorcana card",
        detail: "Sample graded-card prize",
        kind: "graded",
        value: 32,
      },
      {
        id: "rare-collector-bundle",
        name: "Collector bundle",
        detail: "Sample collector bundle",
        kind: "pack",
        value: 35,
      },
    ],
  },
  {
    id: "epic",
    name: "Epic",
    level: "Epic",
    price: 60,
    tagline: "A premium demo pull with collector-grade prizes.",
    description: "The top-tier demo machine for sample collectible prizes.",
    prizes: [
      {
        id: "epic-premium-graded-card",
        name: "Premium graded card",
        detail: "Sample premium graded-card prize",
        kind: "graded",
        value: 78,
      },
      {
        id: "epic-graded-collector-pair",
        name: "Graded collector pair",
        detail: "Sample pair of graded collectibles",
        kind: "graded",
        value: 82,
      },
      {
        id: "epic-showcase-collectible",
        name: "Showcase collectible",
        detail: "Sample showcase collectible",
        kind: "graded",
        value: 90,
      },
    ],
  },
];

export type InventoryItem = {
  id: string;
  prize: Prize;
  machineId: MachineId;
  status: "held" | "sold" | "shipping";
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
export const STORAGE_KEY = "gacha-demo-v1";

export function resaleValue(prize: Prize): number {
  return Math.round(prize.value * resaleRate * 100) / 100;
}

type DemoAction =
  | {
      type: "pull";
      machineId: MachineId;
      itemId: string;
      prizeIndex: number;
      createdAt: string;
    }
  | { type: "sell"; itemId: string }
  | { type: "ship"; itemId: string }
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
  if (!item || item.status !== "held") return state;

  if (action.type === "sell") {
    return {
      ...state,
      balance: state.balance + resaleValue(item.prize),
      items: state.items.map((candidate) =>
        candidate.id === item.id ? { ...candidate, status: "sold" } : candidate,
      ),
    };
  }

  if (action.type === "ship") {
    return {
      ...state,
      items: state.items.map((candidate) =>
        candidate.id === item.id
          ? { ...candidate, status: "shipping" }
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
    return { balance: candidate.balance, pulls: candidate.pulls, items };
  } catch {
    return initialState;
  }
}

function isMachineId(value: unknown): value is MachineId {
  return value === "common" || value === "rare" || value === "epic";
}

function isStatus(value: unknown): value is InventoryItem["status"] {
  return value === "held" || value === "sold" || value === "shipping";
}

function samePrize(saved: Record<string, unknown>, prize: Prize): boolean {
  return (
    saved.id === prize.id &&
    saved.name === prize.name &&
    saved.detail === prize.detail &&
    saved.kind === prize.kind &&
    saved.value === prize.value &&
    saved.grade === prize.grade
  );
}
