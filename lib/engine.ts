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
  arrivalWindowSeconds: number;
  targetHouseEdge: number;
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
  profile: "browser" | "casual" | "regular" | "enthusiast";
  plannedPulls: number;
  arrivalSeconds: number;
  departureSeconds: number | null;
  cadenceSeconds: number;
  status: "waiting" | "active" | "departed" | "stopped";
  pulls: number;
  spentCents: number;
  payoutCents: number;
  retainedValueCents: number;
};
export type EngineEvent = {
  simulatedSeconds: number;
  expectedHouseEdge: number;
  expectedMarketCents: number;
  expectedLiabilityCents: number;
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
export type EngineStopReason = "pull-cap" | "stock-empty" | "no-drawable-stock" | "edge-protected";
export type EngineOdds = {
  currentOdds: { itemId: string; probability: number }[];
  expectedMarketCents: number | null;
  expectedLiabilityCents: number | null;
  expectedHouseEdge: number | null;
};
type ScheduledEvent = { time: number; userId: number; kind: "arrival" | "pull" | "departure" };
export type EngineState = EngineOdds & {
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
  simulatedSeconds: number;
  plannedPulls: number;
  schedule: ScheduledEvent[];
};

export type EngineSummary = EngineOdds & {
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
  playersArrived: number;
  playersDeparted: number;
  playersBrowsed: number;
  playersBrowsing: number;
  visitorsOnline: number;
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
    machineId, users: 100, pullsPerUser: 200,
    pullPriceCents: { common: 1000, rare: 2500, epic: 6000 }[machineId],
    sellbackRate: 0.85, sellProbability: 0.6, keepProbability: 0.3,
    shipProbability: 0.1, feeCents: 0, seed: 26026, secondsPerPull: 5,
    arrivalWindowSeconds: 300, targetHouseEdge: 0.15,
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
  integer(config.pullsPerUser, 1, 200, "Maximum pulls per session");
  integer(config.pullPriceCents, 1, 1_000_000, "Pull price in cents");
  integer(config.feeCents, 0, 1_000_000, "Fee in cents");
  integer(config.seed, 0, 0xffffffff, "Seed");
  finite(config.secondsPerPull, 0.001, 86400, "Seconds per pull");
  finite(config.arrivalWindowSeconds, 0, 86400, "Arrival window");
  finite(config.targetHouseEdge, Number.EPSILON, 1 - Number.EPSILON, "Target house edge");
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

/** Shared remaining-stock distribution. No player state enters this calculation.
 * Mix unit weights toward the cheapest conservative liability until both targets
 * hold. Every configured positive-weight prize must retain a reachable interval.
 */
function calculateOdds(config: EngineConfig, items: EngineItemState[]): EngineOdds {
  const rows = items.map(item => ({ itemId: item.id, probability: 0 }));
  const empty: EngineOdds = { currentOdds: rows, expectedMarketCents: null, expectedLiabilityCents: null, expectedHouseEdge: null };
  const eligible = items.map((item, index) => ({ item, index })).filter(({ item }) => item.available > 0 && item.weight > 0);
  if (!eligible.length) return empty;
  const totalWeight = eligible.reduce((sum, { item }) => sum + item.available * item.weight, 0);
  const liabilities = eligible.map(({ item }) => Math.max(item.costCents, Math.round(item.marketCents * config.sellbackRate)));
  const conservative = eligible.map(({ item }, i) => Math.max(item.marketCents, liabilities[i]));
  const minimum = Math.min(...conservative);
  const budget = config.pullPriceCents * (1 - config.targetHouseEdge) - config.feeCents;
  const base = eligible.map(({ item }) => item.available * item.weight / totalWeight);
  const baseExpectation = base.reduce((sum, probability, i) => sum + probability * conservative[i], 0);
  let probabilities = base;
  if (baseExpectation > budget) {
    if (minimum >= budget) return empty;
    const safeBudget = budget - Math.min((budget - minimum) / 2, 128 * Number.EPSILON * Math.max(1, config.pullPriceCents, config.feeCents));
    const alpha = (safeBudget - minimum) / (baseExpectation - minimum);
    const minimumMass = base.reduce((sum, probability, i) => sum + (conservative[i] === minimum ? probability : 0), 0);
    probabilities = base.map((probability, i) => alpha * probability + (conservative[i] === minimum ? (1 - alpha) * probability / minimumMass : 0));
  }
  // Convert to the exact 53-bit sampling intervals, so expectations describe
  // actual draws, including final cumulative floating-point rounding.
  const resolution = 2 ** 53;
  let cumulative = 0;
  let previousBoundary = 0;
  for (let i = 0; i < probabilities.length; i++) {
    cumulative += probabilities[i];
    const boundary = i === probabilities.length - 1 ? resolution : Math.min(resolution, Math.ceil(cumulative * resolution));
    probabilities[i] = (boundary - previousBoundary) / resolution;
    if (probabilities[i] < 2 ** -52) return empty;
    previousBoundary = boundary;
  }
  const expectedMarketCents = probabilities.reduce((sum, probability, i) => sum + probability * eligible[i].item.marketCents, 0);
  const expectedLiabilityCents = probabilities.reduce((sum, probability, i) => sum + probability * liabilities[i], 0);
  if (Math.max(expectedMarketCents, expectedLiabilityCents) > budget) return empty;
  eligible.forEach(({ index }, i) => { rows[index].probability = probabilities[i]; });
  return { currentOdds: rows, expectedMarketCents, expectedLiabilityCents,
    expectedHouseEdge: (config.pullPriceCents - config.feeCents - Math.max(expectedMarketCents, expectedLiabilityCents)) / config.pullPriceCents };
}

/** Mulberry32 word stream, deterministic even for seed zero. */
function randomWord(state: { rngState: number }): number {
  state.rngState = (state.rngState + 0x6d2b79f5) >>> 0;
  let value = state.rngState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return (value ^ (value >>> 14)) >>> 0;
}
function random(state: { rngState: number }): number {
  return ((randomWord(state) >>> 5) * 67108864 + (randomWord(state) >>> 6)) / 9007199254740992;
}
function before(a: ScheduledEvent, b: ScheduledEvent): boolean {
  return a.time < b.time || (a.time === b.time && a.userId < b.userId);
}
function enqueue(heap: ScheduledEvent[], event: ScheduledEvent) {
  heap.push(event);
  let index = heap.length - 1;
  while (index > 0) {
    const parent = (index - 1) >> 1;
    if (!before(heap[index], heap[parent])) break;
    [heap[parent], heap[index]] = [heap[index], heap[parent]];
    index = parent;
  }
}
function dequeue(heap: ScheduledEvent[]): ScheduledEvent {
  const event = heap[0];
  const last = heap.pop()!;
  if (heap.length) {
    heap[0] = last;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      if (left >= heap.length) break;
      const right = left + 1;
      const child = right < heap.length && before(heap[right], heap[left]) ? right : left;
      if (!before(heap[child], heap[index])) break;
      [heap[index], heap[child]] = [heap[child], heap[index]];
      index = child;
    }
  }
  return event;
}

export function createEngine(config: EngineConfig, items: readonly EngineItem[]): EngineState {
  validateEngineScenario(config, items);
  const initialStock = items.reduce((sum, item) => sum + item.initialStock, 0);
  const rng = { rngState: config.seed };
  let plannedPulls = 0;
  const players: EnginePlayer[] = Array.from({ length: config.users }, (_, i) => {
    const choice = random(rng);
    const profile = choice < 0.2 ? "browser" : choice < 0.6 ? "casual" : choice < 0.9 ? "regular" : "enthusiast";
    const [minimum, maximum] = profile === "browser" ? [0, 0] : profile === "casual" ? [1, 5] : profile === "regular" ? [6, 30] : [31, 200];
    const pulls = Math.min(config.pullsPerUser, minimum + Math.floor(random(rng) * (maximum - minimum + 1)), ENGINE_MAX_PULLS - plannedPulls);
    plannedPulls += pulls;
    const arrivalSeconds = i === 0 ? 0 : random(rng) * config.arrivalWindowSeconds;
    return { id: i + 1, profile, plannedPulls: pulls, arrivalSeconds, departureSeconds: null,
      cadenceSeconds: config.secondsPerPull * (0.5 + random(rng) * 1.5),
      status: "waiting", pulls: 0, spentCents: 0, payoutCents: 0, retainedValueCents: 0 };
  });
  const itemStates = items.map(item => ({ ...item, available: item.initialStock, reservedKeep: 0, queued: 0, pulls: 0, sellbacks: 0 }));
  const odds = calculateOdds(config, itemStates);
  const schedule: ScheduledEvent[] = [];
  players.forEach(player => enqueue(schedule, { time: player.arrivalSeconds, userId: player.id, kind: "arrival" }));
  const state: EngineState = {
    ...odds, config: { ...config }, items: itemStates, players, schedule, plannedPulls, simulatedSeconds: 0,
    totalPulls: 0, revenueCents: 0, payoutCents: 0, reservedCostCents: 0,
    feesCents: 0, retainedValueCents: 0, peakCashflowCents: 0, maxCashDrawdownCents: 0,
    initialInvestmentCents: items.reduce((sum, item) => sum + item.costCents * item.initialStock, 0),
    firstItemDepletedAtPull: null, totalDepletedAtPull: initialStock === 0 ? 0 : null,
    stopReason: null,
    events: [], history: [{ pull: 0, revenueCents: 0, payoutCents: 0, netPnlCents: 0, available: initialStock, reserved: 0 }],
    rngState: rng.rngState,
  };
  // Process time-zero arrivals so status is accurate even before playback starts.
  processUntil(state, 0, config.users);
  if (initialStock === 0) stop(state, "stock-empty");
  else if (!itemStates.some(item => item.available > 0 && item.weight > 0)) stop(state, "no-drawable-stock");
  else if (odds.expectedHouseEdge === null) stop(state, "edge-protected");
  return state;
}

function historyPoint(state: EngineState): EngineHistoryPoint {
  return {
    pull: state.totalPulls, revenueCents: state.revenueCents, payoutCents: state.payoutCents,
    netPnlCents: state.revenueCents - state.payoutCents - state.reservedCostCents - state.feesCents,
    available: state.items.reduce((sum, item) => sum + item.available, 0),
    reserved: state.items.reduce((sum, item) => sum + item.reservedKeep + item.queued, 0),
  };
}
function recordHistory(state: EngineState) {
  if (state.history.at(-1)!.pull !== state.totalPulls) state.history.push(historyPoint(state));
  if (state.history.length > 200) state.history.splice(1, 1);
}
function stop(state: EngineState, reason: EngineStopReason) {
  state.stopReason = reason;
  state.players.forEach(player => {
    if (player.status === "active") {
      player.status = player.pulls >= player.plannedPulls ? "departed" : "stopped";
      player.departureSeconds = state.simulatedSeconds;
    }
  });
  recordHistory(state);
}
function pull(state: EngineState, player: EnginePlayer) {
  // This snapshot is valid until stock changes; a sellback leaves odds unchanged.
  if (state.expectedHouseEdge === null) { stop(state, "edge-protected"); return; }
  const config = state.config;
  const ticket = random(state);
  let cumulative = 0;
  let index = -1;
  for (let i = 0; i < state.currentOdds.length; i++) {
    const probability = state.currentOdds[i].probability;
    if (probability <= 0) continue;
    index = i;
    cumulative += probability;
    if (ticket < cumulative) break;
  }
  const item = state.items[index];
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
  state.events.push({ pull: state.totalPulls, userId: player.id, itemId: item.id, itemName: item.name, action, payoutCents, marketCents: item.marketCents,
    simulatedSeconds: state.simulatedSeconds, expectedHouseEdge: state.expectedHouseEdge,
    expectedMarketCents: state.expectedMarketCents!, expectedLiabilityCents: state.expectedLiabilityCents! });
  if (state.events.length > 100) state.events.shift();
  if (action === "sell") item.sellbacks++;
  else {
    item.available--;
    if (action === "keep") item.reservedKeep++;
    else item.queued++;
    state.reservedCostCents += item.costCents;
    state.retainedValueCents += item.marketCents;
    player.retainedValueCents += item.marketCents;
    if (item.available === 0 && state.firstItemDepletedAtPull === null) state.firstItemDepletedAtPull = state.totalPulls;
    Object.assign(state, calculateOdds(config, state.items));
  }
  const cashflow = state.revenueCents - state.payoutCents - state.feesCents;
  state.peakCashflowCents = Math.max(state.peakCashflowCents, cashflow);
  state.maxCashDrawdownCents = Math.max(state.maxCashDrawdownCents, state.peakCashflowCents - cashflow);
  if (state.items.every(row => row.available === 0)) {
    state.totalDepletedAtPull = state.totalPulls;
    stop(state, "stock-empty");
  } else if (!state.items.some(row => row.available > 0 && row.weight > 0)) stop(state, "no-drawable-stock");
  else if (state.expectedHouseEdge === null) stop(state, "edge-protected");
  if (state.totalPulls % Math.max(1, Math.ceil(state.plannedPulls / 198)) === 0) recordHistory(state);
}

/** At most one event per visitor is queued. Heap order and RNG consumption are
 * independent of UI frame timing and chunk boundaries. */
function processUntil(state: EngineState, target: number, maxEvents: number) {
  let processed = 0;
  while (!state.stopReason && state.schedule.length && state.schedule[0].time <= target && processed < maxEvents) {
    const event = dequeue(state.schedule);
    state.simulatedSeconds = event.time;
    const player = state.players[event.userId - 1];
    processed++;
    if (event.kind === "arrival") {
      player.status = "active";
      enqueue(state.schedule, { time: event.time + player.cadenceSeconds * (0.5 + random(state)), userId: player.id, kind: player.plannedPulls ? "pull" : "departure" });
    } else if (event.kind === "departure") {
      player.status = "departed";
      player.departureSeconds = event.time;
    } else {
      pull(state, player);
      if (!state.stopReason) enqueue(state.schedule, { time: event.time + player.cadenceSeconds * (0.5 + random(state)), userId: player.id, kind: player.pulls < player.plannedPulls ? "pull" : "departure" });
    }
  }
  if (!state.stopReason && state.schedule.length === 0) stop(state, "pull-cap");
  // Never advance past unprocessed work when a UI frame exhausts its budget.
  if (!state.stopReason && Number.isFinite(target) && (!state.schedule.length || state.schedule[0].time > target)) state.simulatedSeconds = target;
}
function transition(previous: EngineState, target: number, maxEvents: number): EngineState {
  integer(maxEvents, 1, ENGINE_MAX_CHUNK, "Chunk size");
  if (previous.stopReason) return previous;
  const state: EngineState = { ...previous,
    items: previous.items.map(item => ({ ...item })), players: previous.players.map(player => ({ ...player })),
    schedule: [...previous.schedule], events: [...previous.events], history: [...previous.history] };
  processUntil(state, target, maxEvents);
  return state;
}
/** Pure bounded full-run transition; budget counts arrivals, draws and departures. */
export function advanceEngine(previous: EngineState, maxEvents = 1000): EngineState {
  return transition(previous, Infinity, maxEvents);
}
/** Advance virtual time by seconds. Budget exhaustion leaves the clock at the
 * final processed event; callers can carry the unconsumed time to their next frame. */
export function advanceEngineTime(previous: EngineState, elapsedSeconds: number, maxEvents = ENGINE_MAX_CHUNK): EngineState {
  finite(elapsedSeconds, 0, Number.MAX_SAFE_INTEGER - previous.simulatedSeconds, "Elapsed seconds");
  return transition(previous, previous.simulatedSeconds + elapsedSeconds, maxEvents);
}

export function summarizeEngine(state: EngineState): EngineSummary {
  const initialStock = state.items.reduce((sum, item) => sum + item.initialStock, 0);
  const available = state.items.reduce((sum, item) => sum + item.available, 0);
  const reservedKeep = state.items.reduce((sum, item) => sum + item.reservedKeep, 0);
  const queued = state.items.reduce((sum, item) => sum + item.queued, 0);
  const played = state.players.filter(player => player.pulls > 0);
  const net = (player: EnginePlayer) => player.payoutCents + player.retainedValueCents - player.spentCents;
  const cashflowCents = state.revenueCents - state.payoutCents - state.feesCents;
  return {
    currentOdds: state.currentOdds, expectedHouseEdge: state.expectedHouseEdge,
    expectedMarketCents: state.expectedMarketCents, expectedLiabilityCents: state.expectedLiabilityCents,
    totalPulls: state.totalPulls, pullCap: state.plannedPulls,
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
    playersPlayed: played.length,
    playersCompleted: state.players.filter(player => player.status === "departed").length,
    playersActive: state.players.filter(player => player.status === "active" && player.plannedPulls > 0 && player.pulls < player.plannedPulls).length,
    visitorsOnline: state.players.filter(player => player.status === "active").length,
    playersBrowsing: state.players.filter(player => player.status === "active" && player.plannedPulls === 0).length,
    playersStopped: state.players.filter(player => player.status === "stopped").length,
    playersWaiting: state.players.filter(player => player.status === "waiting").length,
    playersArrived: state.players.filter(player => player.status !== "waiting").length,
    playersDeparted: state.players.filter(player => player.status === "departed" || player.status === "stopped").length,
    playersBrowsed: state.players.filter(player => player.status === "departed" && player.pulls === 0).length,
    playersWinning: played.filter(player => net(player) > 0).length,
    playersLosing: played.filter(player => net(player) < 0).length,
    playersEven: played.filter(player => net(player) === 0).length,
    playerNetCents: played.reduce((sum, player) => sum + net(player), 0),
    retainedValueCents: state.retainedValueCents,
    simulatedSeconds: state.simulatedSeconds,
    firstItemDepletedAtPull: state.firstItemDepletedAtPull,
    totalDepletedAtPull: state.totalDepletedAtPull, stopReason: state.stopReason,
  };
}
