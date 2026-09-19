import { stockCatalog } from "./catalog.ts";
import type { MachineId, Prize } from "./demo.ts";

/** Independent fictional USD scenario. Catalog CR/EUR values are never converted. */
export type EngineItem = {
  id: string;
  name: string;
  kind: Prize["kind"];
  setId: string | null;
  imagePath?: string | null;
  initialStock: number;
  costCents: number;
  marketCents: number;
  /** Relative weight per available reward unit; zero excludes a row. */
  weight: number;
};

export type EngineConfig = {
  machineId: MachineId;
  users: number;
  pullsPerUser: number;
  pullPriceCents: number;
  sellbackRate: number;
  sellProbability: number;
  keepProbability: number;
  shipProbability: number;
  feeCents: number;
  seed: number;
  secondsPerPull: number;
};

export type EngineItemState = EngineItem & {
  available: number;
  reservedKeep: number;
  queued: number;
  pulls: number;
  sellbacks: number;
};
export type EnginePlayer = {
  id: number;
  pulls: number;
  spentCents: number;
  payoutCents: number;
  retainedValueCents: number;
};
export type EngineEvent = {
  pull: number;
  userId: number;
  itemId: string;
  itemName: string;
  action: "sell" | "keep" | "ship";
  payoutCents: number;
  marketCents: number;
};
export type EngineHistoryPoint = {
  pull: number;
  revenueCents: number;
  payoutCents: number;
  netPnlCents: number;
  available: number;
  reserved: number;
};
export type EngineStopReason = "pull-cap" | "stock-empty" | "no-drawable-stock";
export type EngineState = {
  config: EngineConfig;
  items: EngineItemState[];
  players: EnginePlayer[];
  totalPulls: number;
  revenueCents: number;
  payoutCents: number;
  reservedCostCents: number;
  feesCents: number;
  retainedValueCents: number;
  initialInvestmentCents: number;
  peakCashflowCents: number;
  maxCashDrawdownCents: number;
  firstItemDepletedAtPull: number | null;
  totalDepletedAtPull: number | null;
  stopReason: EngineStopReason | null;
  events: EngineEvent[];
  history: EngineHistoryPoint[];
  rngState: number;
};

export type EngineSummary = {
  totalPulls: number;
  pullCap: number;
  revenueCents: number;
  payoutCents: number;
  reservedCostCents: number;
  feesCents: number;
  netPnlCents: number;
  cashflowCents: number;
  initialInvestmentCents: number;
  cashAfterUpfrontCents: number;
  maxCashDrawdownCents: number;
  initialStock: number;
  available: number;
  reservedKeep: number;
  queued: number;
  reserved: number;
  availablePercent: number;
  reservedPercent: number;
  sellbacks: number;
  playersPlayed: number;
  playersActive: number;
  playersCompleted: number;
  playersStopped: number;
  playersWaiting: number;
  playersWinning: number;
  playersLosing: number;
  playersEven: number;
  playerNetCents: number;
  retainedValueCents: number;
  simulatedSeconds: number;
  firstItemDepletedAtPull: number | null;
  totalDepletedAtPull: number | null;
  stopReason: EngineStopReason | null;
};

export const ENGINE_MAX_PULLS = 1_000_000;
export const ENGINE_MAX_CHUNK = 10_000;

export function createDefaultEngineConfig(machineId: MachineId = "common"): EngineConfig {
  return {
    machineId, users: 100, pullsPerUser: 500,
    pullPriceCents: { common: 1000, rare: 2500, epic: 6000 }[machineId],
    sellbackRate: 0.85, sellProbability: 0.6, keepProbability: 0.3,
    shipProbability: 0.1, feeCents: 0, seed: 26026, secondsPerPull: 5,
  };
}

/** Explicit fictional prices, independent of catalog credit values or market EUR. */
export function createDefaultEngineItems(machineId: MachineId): EngineItem[] {
  return stockCatalog.filter((item) =>
    item.machineIds.includes(machineId) && (!item.availability || item.availability === "active"),
  ).map((item) => {
    const packs = item.packCount ?? 1;
    const [marketCents, costCents, weight] = item.kind === "pack"
      ? [600 * packs, 300 * packs, { 1: 80, 2: 10, 3: 4 }[packs]]
      : item.kind === "box" ? [12000, 7500, 0.25]
      : item.kind === "collection" ? [10000, 6000, 0.1]
      : item.kind === "graded" ? (item.grade === "PSA 10" ? [12000, 6500, 0.1] : [6000, 3000, 0.1])
      : [2000, 1000, 2];
    return {
      id: item.id, name: item.name, kind: item.kind, setId: item.setId,
      imagePath: item.imagePath, initialStock: 100, marketCents, costCents, weight,
    };
  });
}

function integer(value: number, min: number, max: number, name: string) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
}
function finite(value: number, min: number, max: number, name: string) {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(`${name} must be between ${min} and ${max}.`);
}

export function validateEngineScenario(config: EngineConfig, items: readonly EngineItem[]): void {
  if (!["common", "rare", "epic"].includes(config.machineId)) throw new Error("Choose a valid machine.");
  integer(config.users, 1, 10_000, "Users");
  integer(config.pullsPerUser, 1, ENGINE_MAX_PULLS, "Pulls per user");
  integer(config.users * config.pullsPerUser, 1, ENGINE_MAX_PULLS, "Total planned pulls");
  integer(config.pullPriceCents, 1, 1_000_000, "Pull price in cents");
  integer(config.feeCents, 0, 1_000_000, "Fee in cents");
  integer(config.seed, 0, 0xffffffff, "Seed");
  finite(config.secondsPerPull, 0.001, 86400, "Seconds per pull");
  for (const key of ["sellbackRate", "sellProbability", "keepProbability", "shipProbability"] as const)
    finite(config[key], 0, 1, key);
  if (Math.abs(config.sellProbability + config.keepProbability + config.shipProbability - 1) > 1e-9)
    throw new Error("Sell, keep and shipping probabilities must sum to 100%.");
  integer(items.length, 1, 1000, "Item count");
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.id || !item.name || ids.has(item.id)) throw new Error("Items need unique IDs and names.");
    ids.add(item.id);
    integer(item.initialStock, 0, 1_000_000, `${item.name} starting stock`);
    integer(item.marketCents, 0, 1_000_000, `${item.name} market cents`);
    integer(item.costCents, 0, 1_000_000, `${item.name} cost cents`);
    finite(item.weight, 0, 1_000_000, `${item.name} weight`);
    if (item.weight !== 0 && item.weight < 1e-9) throw new Error("Positive weights must be at least 0.000000001.");
  }
  const totalWeight = items.reduce((sum, item) => sum + item.initialStock * item.weight, 0);
  // Keep every positive unit probability well above 53-bit ticket resolution.
  if (items.some((item) => item.initialStock > 0 && item.weight > 0 && item.weight / totalWeight < 1e-12))
    throw new Error("Weight range is too extreme: each available unit needs at least a one-in-a-trillion initial chance.");
}

export function createEngine(config: EngineConfig, items: readonly EngineItem[]): EngineState {
  validateEngineScenario(config, items);
  const initialStock = items.reduce((sum, item) => sum + item.initialStock, 0);
  return {
    config: { ...config },
    items: items.map((item) => ({ ...item, available: item.initialStock, reservedKeep: 0, queued: 0, pulls: 0, sellbacks: 0 })),
    players: Array.from({ length: config.users }, (_, i) => ({ id: i + 1, pulls: 0, spentCents: 0, payoutCents: 0, retainedValueCents: 0 })),
    totalPulls: 0, revenueCents: 0, payoutCents: 0, reservedCostCents: 0,
    feesCents: 0, retainedValueCents: 0, peakCashflowCents: 0, maxCashDrawdownCents: 0,
    initialInvestmentCents: items.reduce((sum, item) => sum + item.costCents * item.initialStock, 0),
    firstItemDepletedAtPull: null, totalDepletedAtPull: initialStock === 0 ? 0 : null,
    stopReason: initialStock === 0 ? "stock-empty" : items.some((item) => item.initialStock > 0 && item.weight > 0) ? null : "no-drawable-stock",
    events: [], history: [{ pull: 0, revenueCents: 0, payoutCents: 0, netPnlCents: 0, available: initialStock, reserved: 0 }],
    rngState: config.seed,
  };
}

/** Mulberry32 word stream, deterministic even for seed zero. */
function randomWord(state: EngineState): number {
  state.rngState = (state.rngState + 0x6d2b79f5) >>> 0;
  let value = state.rngState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return (value ^ (value >>> 14)) >>> 0;
}

/** Two words give a 53-bit fractional ticket instead of truncating small odds. */
function random(state: EngineState): number {
  return ((randomWord(state) >>> 5) * 67108864 + (randomWord(state) >>> 6)) / 9007199254740992;
}

function historyPoint(state: EngineState): EngineHistoryPoint {
  return {
    pull: state.totalPulls, revenueCents: state.revenueCents, payoutCents: state.payoutCents,
    netPnlCents: state.revenueCents - state.payoutCents - state.reservedCostCents - state.feesCents,
    available: state.items.reduce((sum, item) => sum + item.available, 0),
    reserved: state.items.reduce((sum, item) => sum + item.reservedKeep + item.queued, 0),
  };
}

/** Pure bounded transition. Chunk size and playback speed never change outcomes. */
export function advanceEngine(previous: EngineState, maxPulls = 1000): EngineState {
  integer(maxPulls, 1, ENGINE_MAX_CHUNK, "Chunk size");
  if (previous.stopReason) return previous;
  const state: EngineState = {
    ...previous, items: previous.items.map((item) => ({ ...item })),
    players: previous.players.map((player) => ({ ...player })),
    events: [...previous.events], history: [...previous.history],
  };
  const config = state.config;
  const pullCap = config.users * config.pullsPerUser;
  const historyInterval = Math.max(1, Math.ceil(pullCap / 198));
  for (let step = 0; step < maxPulls && !state.stopReason; step++) {
    const weight = state.items.reduce((sum, item) => sum + item.available * item.weight, 0);
    if (weight <= 0) { state.stopReason = "no-drawable-stock"; break; }
    let ticket = random(state) * weight;
    let selected: EngineItemState | undefined;
    for (const item of state.items) {
      if (item.available <= 0 || item.weight <= 0) continue;
      selected = item; // Last positive row is a floating-point boundary fallback.
      ticket -= item.available * item.weight;
      if (ticket < 0) break;
    }
    const item = selected!;
    const player = state.players[state.totalPulls % config.users];
    const choice = random(state);
    const action = choice < config.sellProbability ? "sell" : choice < config.sellProbability + config.keepProbability ? "keep" : "ship";
    const payoutCents = action === "sell" ? Math.round(item.marketCents * config.sellbackRate) : 0;
    state.totalPulls++;
    item.pulls++;
    player.pulls++;
    player.spentCents += config.pullPriceCents;
    player.payoutCents += payoutCents;
    state.revenueCents += config.pullPriceCents;
    state.payoutCents += payoutCents;
    state.feesCents += config.feeCents;
    if (action === "sell") item.sellbacks++;
    else {
      item.available--;
      if (action === "keep") item.reservedKeep++;
      else item.queued++;
      state.reservedCostCents += item.costCents;
      state.retainedValueCents += item.marketCents;
      player.retainedValueCents += item.marketCents;
      if (item.available === 0 && state.firstItemDepletedAtPull === null) state.firstItemDepletedAtPull = state.totalPulls;
    }
    const cashflow = state.revenueCents - state.payoutCents - state.feesCents;
    state.peakCashflowCents = Math.max(state.peakCashflowCents, cashflow);
    state.maxCashDrawdownCents = Math.max(state.maxCashDrawdownCents, state.peakCashflowCents - cashflow);
    state.events.push({ pull: state.totalPulls, userId: player.id, itemId: item.id, itemName: item.name, action, payoutCents, marketCents: item.marketCents });
    if (state.events.length > 100) state.events.shift();
    if (state.items.every((row) => row.available === 0)) {
      state.totalDepletedAtPull = state.totalPulls;
      state.stopReason = "stock-empty";
    } else if (state.totalPulls >= pullCap) state.stopReason = "pull-cap";
    else if (!state.items.some((row) => row.available > 0 && row.weight > 0)) state.stopReason = "no-drawable-stock";
    if (state.totalPulls % historyInterval === 0 || state.stopReason) {
      state.history.push(historyPoint(state));
      if (state.history.length > 200) state.history.splice(1, 1);
    }
  }
  return state;
}

export function summarizeEngine(state: EngineState): EngineSummary {
  const initialStock = state.items.reduce((sum, item) => sum + item.initialStock, 0);
  const available = state.items.reduce((sum, item) => sum + item.available, 0);
  const reservedKeep = state.items.reduce((sum, item) => sum + item.reservedKeep, 0);
  const queued = state.items.reduce((sum, item) => sum + item.queued, 0);
  const played = state.players.filter((player) => player.pulls > 0);
  const completed = played.filter((player) => player.pulls >= state.config.pullsPerUser).length;
  const net = (player: EnginePlayer) => player.payoutCents + player.retainedValueCents - player.spentCents;
  const cashflowCents = state.revenueCents - state.payoutCents - state.feesCents;
  return {
    totalPulls: state.totalPulls, pullCap: state.config.users * state.config.pullsPerUser,
    revenueCents: state.revenueCents, payoutCents: state.payoutCents,
    reservedCostCents: state.reservedCostCents, feesCents: state.feesCents,
    netPnlCents: cashflowCents - state.reservedCostCents, cashflowCents,
    initialInvestmentCents: state.initialInvestmentCents,
    cashAfterUpfrontCents: cashflowCents - state.initialInvestmentCents,
    maxCashDrawdownCents: state.maxCashDrawdownCents,
    initialStock, available, reservedKeep, queued, reserved: reservedKeep + queued,
    availablePercent: initialStock > 0 ? available / initialStock * 100 : 0,
    reservedPercent: initialStock > 0 ? (reservedKeep + queued) / initialStock * 100 : 0,
    sellbacks: state.items.reduce((sum, item) => sum + item.sellbacks, 0),
    playersPlayed: played.length, playersCompleted: completed,
    playersActive: state.stopReason ? 0 : played.length - completed,
    playersStopped: state.stopReason ? played.length - completed : 0,
    playersWaiting: state.config.users - played.length,
    playersWinning: played.filter((player) => net(player) > 0).length,
    playersLosing: played.filter((player) => net(player) < 0).length,
    playersEven: played.filter((player) => net(player) === 0).length,
    playerNetCents: played.reduce((sum, player) => sum + net(player), 0),
    retainedValueCents: state.retainedValueCents,
    simulatedSeconds: Math.ceil(state.totalPulls / state.config.users) * state.config.secondsPerPull,
    firstItemDepletedAtPull: state.firstItemDepletedAtPull,
    totalDepletedAtPull: state.totalDepletedAtPull, stopReason: state.stopReason,
  };
}
