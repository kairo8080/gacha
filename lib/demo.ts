import {
  machines,
  stockCatalog,
  legacyStockCatalog,
  type StockPrize,
} from "./catalog.ts";
import {
  copyStockPrize,
  isMachineId,
  isPrizeSnapshot,
  isStockPrize,
} from "./ghost-stock.ts";
import {
  getLiveMachineOdds,
  calculateMachineOdds,
  isMachineOddsConfig,
  copyMachineOddsConfig,
  type MachineOddsConfig,
} from "./odds.ts";
export type { MachineOddsConfig } from "./odds.ts";

/**
 * Local-only state for the arcade demo. Credits, prizes, resale, and shipping
 * are illustrative UI mechanics; this module never performs commerce.
 */
export type MachineId = "common" | "rare" | "epic";

export type Prize = {
  id: string;
  name: string;
  detail: string;
  kind: "pack" | "box" | "collection" | "graded" | "mystery";
  packCount?: 1 | 2 | 3;
  value: number;
  grade?: "PSA 9" | "PSA 10";
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
  prizes: StockPrize[];
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
  stockCatalog?: StockPrize[];
  oddsSettings?: Partial<Record<MachineId, MachineOddsConfig>>;
};

export const initialState: DemoState = { balance: 250, items: [], pulls: 0 };

/** Illustrative in-app credit rate only; it is not a resale offer. */
export const resaleRate = 0.8;
// Keep the old sample-prize session intact; stock simulation starts separately.
export const LEGACY_STORAGE_KEY = "gacha-demo-v1";
export const PREVIOUS_STORAGE_KEY = "gacha-demo-sample-v3";
export const PREVIOUS_V4_STORAGE_KEY = "gacha-demo-sample-v4";
export const STORAGE_KEY = "gacha-demo-sample-v5";
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

/** Kept and shipping-preview reward units are reserved; resales return one unit. */
export function remainingStock(state: DemoState, prizeId: string): number {
  const prize = getStockCatalog(state).find((entry) => entry.id === prizeId);
  if (!prize) return 0;
  const reserved = state.items.filter(
    (item) => item.prize.id === prizeId && item.status !== "sold",
  ).length;
  return Math.max(0, prize.startingQuantity - reserved);
}

export function machineStock(state: DemoState, machineId: MachineId): number {
  return (machineById(machineId, state)?.prizes ?? []).reduce(
    (total, prize) => total + remainingStock(state, prize.id),
    0,
  );
}

/** Map one integer ticket to one remaining reward unit, regardless of pack count. */
export function drawPrizeIndex(
  state: DemoState,
  machineId: MachineId,
  ticket: number,
): number {
  const machine = machineById(machineId, state);
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
  | { type: "save-stock"; prize: StockPrize }
  | { type: "save-odds"; machineId: MachineId; config: MachineOddsConfig }
  | { type: "reset" };

export function getStockCatalog(state: DemoState): StockPrize[] {
  return state.stockCatalog ?? stockCatalog;
}

export function getMachines(state: DemoState): Machine[] {
  return machines.map((machine) => ({
    ...machine,
    prizes: getStockCatalog(state).filter(
      (prize) =>
        (prize.availability ?? "active") === "active" &&
        prize.machineIds.includes(machine.id),
    ),
  }));
}

const machineById = (id: MachineId, state: DemoState) =>
  getMachines(state).find((machine) => machine.id === id);

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  if (action.type === "reset") {
    if (!state.stockCatalog && !state.oddsSettings) return initialState;
    return {
      ...initialState,
      ...(state.stockCatalog ? { stockCatalog: state.stockCatalog } : {}),
      ...(state.oddsSettings ? { oddsSettings: state.oddsSettings } : {}),
    };
  }

  if (action.type === "save-odds") {
    if (!isMachineId(action.machineId) || !isMachineOddsConfig(action.config))
      return state;
    if (
      action.config.enabled &&
      calculateMachineOdds(state, action.machineId, action.config).status !==
        "ready"
    )
      return state;
    return {
      ...state,
      oddsSettings: {
        ...state.oddsSettings,
        [action.machineId]: copyMachineOddsConfig(action.config),
      },
    };
  }

  if (action.type === "save-stock") {
    if (!isStockPrize(action.prize)) return state;
    const reserved = state.items.filter(
      (item) => item.prize.id === action.prize.id && item.status !== "sold",
    ).length;
    if (action.prize.startingQuantity < reserved) return state;
    const current = getStockCatalog(state);
    if (
      current.length >= 5000 &&
      !current.some((row) => row.id === action.prize.id)
    )
      return state;
    const prize = copyStockPrize(action.prize);
    return {
      ...state,
      stockCatalog: current.some((row) => row.id === prize.id)
        ? current.map((row) => (row.id === prize.id ? prize : row))
        : [...current, prize],
    };
  }

  if (action.type === "pull") {
    const machine = machineById(action.machineId, state);
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
    const selectedPrize = machine.prizes[action.prizeIndex];
    if (state.oddsSettings?.[machine.id]?.enabled) {
      const odds = getLiveMachineOdds(state, machine.id);
      if (
        odds.status !== "ready" ||
        !odds.rows.some(
          (row) => row.prizeId === selectedPrize.id && row.probability > 0,
        )
      )
        return state;
    }
    if (
      (selectedPrize.availability ?? "active") !== "active" ||
      !selectedPrize.machineIds.includes(machine.id) ||
      remainingStock(state, selectedPrize.id) === 0
    ) {
      return state;
    }
    const item: InventoryItem = {
      id: action.itemId,
      prize: copyStockPrize(selectedPrize),
      machineId: machine.id,
      status: "held",
      createdAt: action.createdAt,
    };
    return {
      ...state,
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

    let oddsSettings: DemoState["oddsSettings"];
    if (candidate.oddsSettings !== undefined) {
      if (
        !candidate.oddsSettings ||
        typeof candidate.oddsSettings !== "object" ||
        Array.isArray(candidate.oddsSettings)
      )
        return initialState;
      oddsSettings = {};
      for (const [id, config] of Object.entries(candidate.oddsSettings)) {
        if (!isMachineId(id) || !isMachineOddsConfig(config))
          return initialState;
        oddsSettings[id] = copyMachineOddsConfig(config);
      }
    }

    let catalog: StockPrize[] | undefined;
    if (candidate.stockCatalog !== undefined) {
      if (
        !Array.isArray(candidate.stockCatalog) ||
        candidate.stockCatalog.length > 5000 ||
        !candidate.stockCatalog.every(isStockPrize)
      )
        return initialState;
      catalog = candidate.stockCatalog.map(copyStockPrize);
      const catalogIds = new Set(catalog.map((prize) => prize.id));
      if (
        catalogIds.size !== catalog.length ||
        stockCatalog.some((prize) => !catalogIds.has(prize.id))
      )
        return initialState;
    }

    let migratedLegacy = false;
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
      let prize: Prize;
      if (catalog) {
        if (
          !isPrizeSnapshot(rawPrize) ||
          ("language" in rawPrize && !isStockPrize(rawPrize)) ||
          !catalog.some((row) => row.id === rawPrize.id)
        )
          return initialState;
        prize = {
          id: rawPrize.id,
          name: rawPrize.name,
          detail: rawPrize.detail,
          kind: rawPrize.kind,
          value: rawPrize.value,
          ...(rawPrize.packCount === undefined
            ? {}
            : { packCount: rawPrize.packCount }),
          ...(rawPrize.grade === undefined ? {} : { grade: rawPrize.grade }),
        };
        // Preserve full historical metadata when the award contains a valid catalog snapshot.
        if (isStockPrize(rawPrize)) prize = copyStockPrize(rawPrize);
      } else {
        const current = stockCatalog.find(
          (row) =>
            row.id === rawPrize.id &&
            row.machineIds.includes(item.machineId as MachineId),
        );
        const legacy = legacyStockCatalog.find(
          (row) => row.id === rawPrize.id && row.machineId === item.machineId,
        );
        if (current && isStockPrize(rawPrize) && samePrize(rawPrize, current))
          prize = copyStockPrize(rawPrize);
        else if (legacy && samePrize(rawPrize, legacy)) {
          prize = {
            id: legacy.id,
            name: legacy.name,
            detail: legacy.detail,
            kind: legacy.kind,
            value: legacy.value,
            packCount: 1,
          };
          migratedLegacy = true;
        } else return initialState;
      }
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
    for (const prize of catalog ?? stockCatalog) {
      const reserved = items.filter(
        (item) => item.prize.id === prize.id && item.status !== "sold",
      ).length;
      if (reserved > prize.startingQuantity) return initialState;
    }
    return {
      balance: candidate.balance,
      pulls: candidate.pulls,
      items,
      ...(oddsSettings === undefined ? {} : { oddsSettings }),
      ...(catalog || migratedLegacy
        ? { stockCatalog: catalog ?? stockCatalog.map(copyStockPrize) }
        : {}),
    };
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
    saved.machineId === prize.machineId &&
    saved.packCount === prize.packCount &&
    (!("machineIds" in prize) ||
      JSON.stringify(saved.machineIds) === JSON.stringify(prize.machineIds)) &&
    (!("language" in prize) ||
      (saved.language === prize.language &&
        saved.setId === (prize as StockPrize).setId &&
        saved.cardmarketUrl === (prize as StockPrize).cardmarketUrl &&
        saved.marketPriceEur === (prize as StockPrize).marketPriceEur &&
        (saved.buyCostEur ?? null) ===
          ((prize as StockPrize).buyCostEur ?? null) &&
        saved.marketCheckedAt === (prize as StockPrize).marketCheckedAt &&
        (saved.specialEvent ?? false) ===
          ((prize as StockPrize).specialEvent ?? false) &&
        (saved.availability ?? "active") ===
          ((prize as StockPrize).availability ?? "active") &&
        (saved.imagePath ?? null) ===
          ((prize as StockPrize).imagePath ?? null)))
  );
}
