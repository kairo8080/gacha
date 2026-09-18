"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
import { demoReducer, getStockCatalog, type DemoState } from "@/lib/demo";
import {
  calculateMachineOdds,
  getLiveMachineOdds,
  getMachineOddsConfig,
  type MachineOddsConfig,
} from "@/lib/odds";

const tiers = [
  { id: "common", name: "Common", color: "#40c7f4" },
  { id: "rare", name: "Rare", color: "#c073f5" },
  { id: "epic", name: "Epic", color: "#ffd34d" },
] as const;
type Props = {
  state: DemoState;
  setState: Dispatch<SetStateAction<DemoState>>;
  ready: boolean;
};
type Plan = { price: string; edge: string; fee: string; base: string };
const money = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en", {
        style: "currency",
        currency: "EUR",
      }).format(value);
const percent = (value: number | null) =>
  value === null
    ? "—"
    : value > 0 && value < 0.0001
      ? "<0.01%"
      : `${(value * 100).toFixed(2)}%`;
function planOf(config: MachineOddsConfig): Plan {
  return {
    price: config.pullPriceEur === null ? "" : String(config.pullPriceEur),
    edge: String(config.targetEdge * 100),
    fee: String(config.feeEur),
    base: JSON.stringify(config),
  };
}

function MachinePlan({
  state,
  setState,
  ready,
  tier,
}: Props & { tier: (typeof tiers)[number] }) {
  const saved = getMachineOddsConfig(state, tier.id);
  const [plan, setPlan] = useState(() => planOf(saved));
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<MachineOddsConfig | null>(null);
  const stale = JSON.stringify(saved) !== plan.base;
  const config: MachineOddsConfig = {
    enabled: saved.enabled,
    pullPriceEur: plan.price.trim() === "" ? null : Number(plan.price),
    targetEdge: Number(plan.edge) / 100,
    feeEur: Number(plan.fee),
  };
  const valid =
    (config.pullPriceEur === null ||
      (Number.isFinite(config.pullPriceEur) &&
        config.pullPriceEur > 0 &&
        config.pullPriceEur <= 100000)) &&
    plan.edge.trim() !== "" &&
    Number.isFinite(config.targetEdge) &&
    config.targetEdge >= 0.0001 &&
    config.targetEdge <= 0.9999 &&
    plan.fee.trim() !== "" &&
    Number.isFinite(config.feeEur) &&
    config.feeEur >= 0 &&
    config.feeEur <= 100000;
  const preview = calculateMachineOdds(state, tier.id, config);
  const live = getLiveMachineOdds(state, tier.id);
  const showPreview = valid && preview.status === "ready";
  const rows = showPreview ? preview.rows : live.rows;
  const catalog = new Map(
    getStockCatalog(state).map((prize) => [prize.id, prize]),
  );

  useEffect(() => {
    if (!pending) return;
    const latest = getMachineOddsConfig(state, tier.id);
    if (JSON.stringify(latest) === JSON.stringify(pending)) {
      setPlan(planOf(latest));
      setNotice(
        latest.enabled
          ? "APPLIED · Next pull uses these odds."
          : "SAVED · Stock odds are active.",
      );
    } else setNotice("Not saved. Stock or settings changed; review the plan.");
    setPending(null);
  }, [state, pending, tier.id]);

  function save(enabled: boolean) {
    if (
      !ready ||
      pending ||
      stale ||
      (!valid && (enabled || !saved.enabled)) ||
      (enabled && preview.status !== "ready")
    )
      return;
    const next = { ...(!enabled && saved.enabled ? saved : config), enabled };
    setNotice("");
    setPending(next);
    setState((current) =>
      JSON.stringify(getMachineOddsConfig(current, tier.id)) !== plan.base
        ? current
        : demoReducer(current, {
            type: "save-odds",
            machineId: tier.id,
            config: next,
          }),
    );
  }
  function change(key: "price" | "edge" | "fee", value: string) {
    setPlan((current) => ({ ...current, [key]: value }));
    setNotice("");
  }
  const mode = saved.enabled
    ? live.status === "ready"
      ? "TUNED ODDS"
      : "PAUSED"
    : "STOCK ODDS";

  return (
    <section
      className={`odds-machine ${tier.id}`}
      style={{ "--odds-color": tier.color } as CSSProperties}
      aria-label={`${tier.name} odds calculator`}
    >
      <header className="odds-machine-heading">
        <h3>{tier.name}</h3>
        <span className={mode === "PAUSED" ? "odds-paused" : ""}>{mode}</span>
      </header>
      <div className="odds-inputs">
        <label>
          PULL PRICE · EUR
          <input
            aria-label={`${tier.name} pull price EUR`}
            type="number"
            min="0.01"
            max="100000"
            step="0.01"
            placeholder="Set price"
            value={plan.price}
            onChange={(e) => change("price", e.target.value)}
          />
        </label>
        <label>
          TARGET EDGE · %
          <input
            aria-label={`${tier.name} target edge percent`}
            type="number"
            min="0.01"
            max="99.99"
            step="0.01"
            value={plan.edge}
            onChange={(e) => change("edge", e.target.value)}
          />
        </label>
        <label>
          FEES / PULL · EUR
          <input
            aria-label={`${tier.name} fee EUR`}
            type="number"
            min="0"
            max="100000"
            step="0.01"
            value={plan.fee}
            onChange={(e) => change("fee", e.target.value)}
          />
        </label>
      </div>
      <div className="odds-metrics" aria-label={`${tier.name} plan forecast`}>
        <div>
          <span>EXPECTED EK</span>
          <strong>{money(showPreview ? preview.expectedCostEur : null)}</strong>
        </div>
        <div>
          <span>EXPECTED VK</span>
          <strong>
            {money(showPreview ? preview.expectedMarketEur : null)}
          </strong>
        </div>
        <div>
          <span>PROFIT / PULL</span>
          <strong>
            {money(showPreview ? preview.expectedProfitEur : null)}
          </strong>
        </div>
        <div>
          <span>HOUSE EDGE</span>
          <strong>{percent(showPreview ? preview.houseEdge : null)}</strong>
        </div>
        <div>
          <span>MARKET RTP</span>
          <strong>{percent(showPreview ? preview.marketRtp : null)}</strong>
        </div>
        <div>
          <span>PRICING GAPS</span>
          <strong>{preview.missingCount}</strong>
        </div>
      </div>
      <p
        className={`odds-plan-status ${showPreview ? "ready" : "blocked"}`}
        role="status"
      >
        {!valid
          ? "Enter a positive price, 0–100% edge, and nonnegative fees."
          : showPreview
            ? "PLAN READY · Review and apply."
            : preview.reason}
      </p>
      {saved.enabled && live.status !== "ready" && (
        <p className="admin-error">Draws paused: {live.reason}</p>
      )}
      {stale && (
        <p className="admin-error">
          Settings changed.{" "}
          <button
            className="ghost-inline-button"
            onClick={() => {
              setPlan(planOf(saved));
              setNotice("");
            }}
          >
            Reload settings
          </button>
        </p>
      )}
      <div className="odds-actions">
        <button
          className="admin-primary"
          onClick={() => save(true)}
          disabled={!ready || !!pending || stale || !showPreview}
        >
          APPLY ODDS
        </button>
        <button
          className="admin-secondary"
          onClick={() => save(false)}
          disabled={!ready || !!pending || stale || (!saved.enabled && !valid)}
        >
          {saved.enabled ? "USE STOCK ODDS" : "SAVE PLAN"}
        </button>
      </div>
      {notice && (
        <p className="odds-notice" role="status">
          {notice}
        </p>
      )}
      <div className="odds-distribution-heading">
        <strong>{showPreview ? "PLAN PREVIEW" : "CURRENT ODDS"}</strong>
        <span>
          {rows.filter((row) => row.probability > 0).length} ITEMS ·{" "}
          {percent(rows.reduce((sum, row) => sum + row.probability, 0))}
        </span>
      </div>
      <div
        className="odds-distribution"
        tabIndex={0}
        aria-label={`${tier.name} prize probabilities`}
      >
        <table>
          <thead>
            <tr>
              <th>ITEM</th>
              <th>LEFT</th>
              <th>CHANCE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.prizeId}>
                <th scope="row">
                  {catalog.get(row.prizeId)?.name ?? row.prizeId}
                </th>
                <td>{row.available}</td>
                <td>{percent(row.probability)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p>No eligible items.</p>}
      </div>
    </section>
  );
}

export default function OddsCalculator(props: Props) {
  return (
    <section
      className="admin-panel odds-panel"
      aria-label="Machine odds planning"
    >
      <div className="admin-panel-title">
        <div>
          <h2>ODDS LAB</h2>
          <p>EK = BUY COST · VK = MARKET VALUE · EUR / REWARD</p>
        </div>
        <span className="ghost-en">SIMULATION</span>
      </div>
      <p className="odds-explanation">
        Set EK/VK in Ghost stock. The plan targets an average edge after entered
        fees; individual pulls can lose. EUR planning is separate from demo
        credits.
      </p>
      <div className="odds-machines">
        {tiers.map((tier) => (
          <MachinePlan {...props} tier={tier} key={tier.id} />
        ))}
      </div>
      <details className="odds-method">
        <summary>How chances are calculated</summary>
        <p>
          Start with each item’s share of remaining stock, then reduce the
          weight of higher-value rewards until the expected cost and market
          payout both meet the target. Every eligible item keeps a chance.
          Prices and remaining stock are checked before each tuned pull; missing
          prices or an impossible target pause that machine. Settings apply
          equally to all simulated players. Profit excludes costs you have not
          entered.
        </p>
      </details>
    </section>
  );
}
