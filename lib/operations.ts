import {
  machines,
  parsePreviousSavedState,
  parseSavedState,
  resaleValue,
  isValidDemoDay,
  type DemoState,
  type InventoryItem,
  type MachineId,
} from "./demo.ts";

export {
  getShippingStage,
  SHIPPING_UNLOCK_DAY,
  isValidDemoDay,
} from "./demo.ts";

export const OPERATIONS_STORAGE_KEY = "gacha-demo-operations-v1";
export type DemoOperations = { demoDay: number };
export const initialOperations: DemoOperations = { demoDay: 0 };

export function parseOperations(raw: string | null): DemoOperations {
  if (raw === null) return initialOperations;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      "demoDay" in value &&
      isValidDemoDay(value.demoDay)
    ) {
      return { demoDay: value.demoDay };
    }
  } catch {
    /* Invalid local data falls back to the starting demo day. */
  }
  return initialOperations;
}

/** Prefer v4 even when it is invalid, so obsolete previews cannot reappear. */
export function restoreDemoSession(
  currentRaw: string | null,
  previousRaw: string | null,
): DemoState {
  return currentRaw === null
    ? parsePreviousSavedState(previousRaw)
    : parseSavedState(currentRaw);
}

/** Metrics describe this browser's single fictional session only. */
export function getDemoMetrics(state: DemoState) {
  const pullsByMachine: Record<MachineId, number> = {
    common: 0,
    rare: 0,
    epic: 0,
  };
  let revenue = 0;
  let sellBacks = 0;
  let sellBackCredits = 0;
  let redemptions = 0;
  let shippingRequests = 0;
  let collectionValue = 0;
  let bestPull: InventoryItem | undefined;
  for (const item of state.items) {
    pullsByMachine[item.machineId] += 1;
    revenue += machines.find((machine) => machine.id === item.machineId)!.price;
    if (!bestPull || item.prize.value > bestPull.prize.value) bestPull = item;
    if (item.status === "sold") {
      sellBacks += 1;
      sellBackCredits += resaleValue(item.prize);
    }
    if (item.status === "held") collectionValue += item.prize.value;
    if (
      item.status === "redeemed" ||
      item.status === "queued" ||
      item.status === "shipping"
    )
      redemptions += 1;
    if (item.status === "queued" || item.status === "shipping")
      shippingRequests += 1;
  }
  return {
    totalPulls: state.items.length,
    pullsByMachine,
    usersPlayed: state.items.length ? 1 : 0,
    revenue: Math.round(revenue * 100) / 100,
    sellBacks,
    sellBackCredits: Math.round(sellBackCredits * 100) / 100,
    redemptions,
    shippingRequests,
    profit: null,
    collectionValue: Math.round(collectionValue * 100) / 100,
    bestPull,
  };
}
