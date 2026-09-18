import { getMachines, type DemoState, type MachineId } from "./demo.ts";
import type { StockPrize } from "./catalog.ts";

/** Local scenario inputs only. No EUR value is inferred from illustrative credits. */
export type MachineOddsConfig = {
  enabled: boolean;
  pullPriceEur: number | null;
  targetEdge: number;
  feeEur: number;
};

export const defaultMachineOddsConfig: MachineOddsConfig = {
  enabled: false,
  pullPriceEur: null,
  targetEdge: 0.15,
  feeEur: 0,
};

export type MachineOdds = {
  status: "ready" | "missing-values" | "infeasible" | "empty" | "unconfigured";
  reason: string;
  rows: { prizeId: string; probability: number; available: number }[];
  expectedCostEur: number | null;
  expectedMarketEur: number | null;
  expectedProfitEur: number | null;
  houseEdge: number | null;
  marketRtp: number | null;
  missingCount: number;
};

function euro(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100000
  );
}

export function isMachineOddsConfig(
  value: unknown,
): value is MachineOddsConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const config = value as Record<string, unknown>;
  return (
    typeof config.enabled === "boolean" &&
    (config.pullPriceEur === null ||
      (euro(config.pullPriceEur) && config.pullPriceEur > 0)) &&
    typeof config.targetEdge === "number" &&
    Number.isFinite(config.targetEdge) &&
    config.targetEdge > 0 &&
    config.targetEdge < 1 &&
    euro(config.feeEur)
  );
}

export function copyMachineOddsConfig(
  config: MachineOddsConfig,
): MachineOddsConfig {
  return {
    enabled: config.enabled,
    pullPriceEur: config.pullPriceEur,
    targetEdge: config.targetEdge,
    feeEur: config.feeEur,
  };
}

export function getMachineOddsConfig(
  state: DemoState,
  id: MachineId,
): MachineOddsConfig {
  return copyMachineOddsConfig(
    state.oddsSettings?.[id] ?? defaultMachineOddsConfig,
  );
}

function pool(state: DemoState, id: MachineId) {
  const prizes =
    getMachines(state).find((machine) => machine.id === id)?.prizes ?? [];
  const reservations = new Map<string, number>();
  for (const item of state.items) {
    if (item.status !== "sold")
      reservations.set(
        item.prize.id,
        (reservations.get(item.prize.id) ?? 0) + 1,
      );
  }
  const rows = prizes.map((prize) => ({
    prizeId: prize.id,
    probability: 0,
    available: Math.max(
      0,
      prize.startingQuantity - (reservations.get(prize.id) ?? 0),
    ),
  }));
  return { prizes, rows };
}

function missing(prize: StockPrize) {
  return !euro(prize.buyCostEur) || !euro(prize.marketPriceEur);
}

function result(
  rows: MachineOdds["rows"],
  status: MachineOdds["status"],
  reason: string,
  missingCount = 0,
): MachineOdds {
  return {
    status,
    reason,
    rows,
    missingCount,
    expectedCostEur: null,
    expectedMarketEur: null,
    expectedProfitEur: null,
    houseEdge: null,
    marketRtp: null,
  };
}

function metrics(
  odds: MachineOdds,
  prizes: StockPrize[],
  config: MachineOddsConfig,
): MachineOdds {
  const active = odds.rows
    .map((row, index) => ({ ...row, prize: prizes[index] }))
    .filter((row) => row.probability > 0);
  const expectedCostEur = active.every((row) => euro(row.prize.buyCostEur))
    ? active.reduce(
        (sum, row) => sum + row.probability * row.prize.buyCostEur!,
        0,
      )
    : null;
  const expectedMarketEur = active.every((row) =>
    euro(row.prize.marketPriceEur),
  )
    ? active.reduce(
        (sum, row) => sum + row.probability * row.prize.marketPriceEur!,
        0,
      )
    : null;
  const price = config.pullPriceEur;
  return {
    ...odds,
    expectedCostEur,
    expectedMarketEur,
    expectedProfitEur:
      price !== null && expectedCostEur !== null
        ? price - config.feeEur - expectedCostEur
        : null,
    houseEdge:
      price !== null && expectedMarketEur !== null
        ? (price - config.feeEur - expectedMarketEur) / price
        : null,
    marketRtp:
      price !== null && expectedMarketEur !== null
        ? expectedMarketEur / price
        : null,
  };
}

/**
 * Preview the least change from remaining-unit weights that meets BOTH expected
 * EK and VK constraints. Tilting max(EK,VK) is deliberately conservative.
 * Each draw recomputes this shared pool; no player information enters the model.
 */
export function calculateMachineOdds(
  state: DemoState,
  id: MachineId,
  config = getMachineOddsConfig(state, id),
): MachineOdds {
  const { prizes, rows } = pool(state, id);
  const eligible = rows
    .map((row, index) => ({ ...row, index, prize: prizes[index] }))
    .filter((row) => row.available > 0);
  if (eligible.length === 0)
    return result(rows, "empty", "No active reward units remain.");
  const missingCount = eligible.filter((row) => missing(row.prize)).length;
  if (!isMachineOddsConfig(config) || config.pullPriceEur === null)
    return result(
      rows,
      "unconfigured",
      "Set a positive EUR pull price, a target edge between 0% and 100%, and a non-negative fee.",
      missingCount,
    );
  if (missingCount > 0)
    return result(
      rows,
      "missing-values",
      "Enter EK and VK for every active reward with remaining stock.",
      missingCount,
    );

  const liabilities = eligible.map((row) =>
    Math.max(row.prize.buyCostEur!, row.prize.marketPriceEur!),
  );
  const minimum = Math.min(...liabilities);
  const maximum = Math.max(...liabilities);
  const budget = config.pullPriceEur * (1 - config.targetEdge) - config.feeEur;
  const total = eligible.reduce((sum, row) => sum + row.available, 0);
  let probabilities = eligible.map((row) => row.available / total);
  const expectation = (weights: number[]) =>
    weights.reduce(
      (sum, weight, index) => sum + weight * liabilities[index],
      0,
    );
  const fail = () =>
    result(
      rows,
      "infeasible",
      "Remaining stock cannot meet this edge while keeping every eligible reward possible. Adjust the price, fee, target, or pool.",
    );
  if (expectation(probabilities) > budget) {
    // The minimum-cost boundary would remove other eligible rewards entirely.
    if (budget <= minimum || maximum === minimum) return fail();
    const range = maximum - minimum;
    const costs = liabilities.map((cost) => (cost - minimum) / range);
    const logs = eligible.map((row) => Math.log(row.available));
    const weightsAt = (lambda: number) => {
      const logsAt = logs.map(
        (weight, index) => weight - lambda * costs[index],
      );
      const largest = Math.max(...logsAt);
      const weights = logsAt.map((weight) => Math.exp(weight - largest));
      const sum = weights.reduce((acc, weight) => acc + weight, 0);
      return weights.map((weight) => weight / sum);
    };
    // Small interior margin prevents a rounded expectation from crossing the constraint.
    const safeBudget =
      budget -
      Math.min(
        (budget - minimum) / 2,
        32 * Number.EPSILON * Math.max(1, config.pullPriceEur, config.feeEur),
      );
    let low = 0;
    let high = 1;
    for (
      let step = 0;
      step < 60 && expectation(weightsAt(high)) > safeBudget;
      step++
    )
      high *= 2;
    if (expectation(weightsAt(high)) > safeBudget) return fail();
    for (let step = 0; step < 100; step++) {
      const mid = (low + high) / 2;
      if (expectation(weightsAt(mid)) > safeBudget) low = mid;
      else high = mid;
    }
    probabilities = weightsAt(high);
  }
  // Sampling uses a 53-bit unit random. Reserve a full representable interval
  // for every reward, rather than displaying a positive but unreachable chance.
  if (
    probabilities.some(
      (probability) => !Number.isFinite(probability) || probability < 2 ** -52,
    ) ||
    expectation(probabilities) > budget
  )
    return fail();
  let cumulative = 0;
  for (const probability of probabilities) {
    const next = cumulative + probability;
    if (
      next <= cumulative ||
      cumulative >= 1 ||
      Math.ceil(cumulative * 2 ** 53) >= Math.min(next, 1) * 2 ** 53
    )
      return fail();
    cumulative = next;
  }
  eligible.forEach((row, index) => {
    rows[row.index].probability = probabilities[index];
  });
  return metrics(
    result(
      rows,
      "ready",
      "Current remaining-stock odds satisfy the configured expected-value target; individual pulls can lose money.",
    ),
    prizes,
    config,
  );
}

/** The exact distribution used by sampling and shown to players. */
export function getLiveMachineOdds(
  state: DemoState,
  id: MachineId,
): MachineOdds {
  const config = getMachineOddsConfig(state, id);
  if (config.enabled) return calculateMachineOdds(state, id, config);
  const { prizes, rows } = pool(state, id);
  const total = rows.reduce((sum, row) => sum + row.available, 0);
  if (total === 0)
    return result(rows, "empty", "No active reward units remain.");
  for (const row of rows) row.probability = row.available / total;
  return metrics(
    result(
      rows,
      "ready",
      "Odds follow remaining reward units; EUR tuning is disabled.",
      prizes.filter(
        (prize, index) => rows[index].available > 0 && missing(prize),
      ).length,
    ),
    prizes,
    config,
  );
}

/** Returns an index into getMachines(state)'s prize list, or -1 when blocked. */
export function samplePrizeIndex(
  state: DemoState,
  id: MachineId,
  unitRandom: number,
): number {
  if (!Number.isFinite(unitRandom) || unitRandom < 0 || unitRandom >= 1)
    return -1;
  const odds = getLiveMachineOdds(state, id);
  if (odds.status !== "ready") return -1;
  let cumulative = 0;
  let lastPositive = -1;
  for (const [index, row] of odds.rows.entries()) {
    if (row.probability <= 0) continue;
    lastPositive = index;
    cumulative += row.probability;
    if (unitRandom < cumulative) return index;
  }
  // Normalized sums can round just below one; this closes only that final gap.
  return lastPositive;
}
