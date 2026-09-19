"use client";

import { useState } from "react";
import ProductImage from "@/components/product-image";
import type { ProductImagePrize } from "@/lib/product-images";
import type { EngineItem, EngineState, EngineSummary } from "@/lib/engine";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const num = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
const pct = (value: number) => value > 0 && value < .00001 ? "<0.001%" : `${(value * 100).toFixed(value < .01 ? 3 : 1)}%`;
type EditItem = <K extends keyof EngineItem>(id: string, key: K, value: EngineItem[K]) => void;

export function Stock({ rows, odds, locked, item }: {
  rows: EngineState["items"]; odds: EngineState["currentOdds"]; locked: boolean; item: EditItem;
}) {
  const probabilities = new Map(odds.map(row => [row.itemId, row.probability]));
  return <section className="engine-panel engine-data">
    <div className="engine-panel-title"><h2>STOCK & PRICING</h2><span>{locked ? "RESET TO EDIT" : "FICTIONAL USD"}</span></div>
    <div className="engine-table-wrap"><table><thead><tr>
      {["ITEM", "AVAILABLE", "KEEP", "QUEUE", "PULLS", "RETURNS", "CHANCE", "START QTY", "EK USD", "VK USD", "WEIGHT"].map(label => <th key={label}>{label}</th>)}
    </tr></thead><tbody>{rows.map(row => <tr key={row.id}>
      <th><ProductImage prize={row as ProductImagePrize} size={34} /><span>{row.name}<small>{row.kind}</small></span></th>
      <td>{num(row.available)} / {num(row.initialStock)}<i className="engine-inline-stock"><b style={{ width: `${row.initialStock ? row.available / row.initialStock * 100 : 0}%` }} /></i></td>
      <td>{num(row.reservedKeep)}</td><td>{num(row.queued)}</td><td>{num(row.pulls)}</td><td>{num(row.sellbacks)}</td>
      <td>{probabilities.has(row.id) ? pct(probabilities.get(row.id)!) : "—"}</td>
      {(["initialStock", "costCents", "marketCents", "weight"] as const).map(key => {
        const isMoney = key === "costCents" || key === "marketCents";
        const label = { initialStock: "quantity", costCents: "cost USD", marketCents: "market USD", weight: "weight" }[key];
        return <td key={key}><input type="number" min="0" step={key === "initialStock" ? 1 : .01}
          aria-label={`${row.name} ${label}`} disabled={locked} value={row[key] / (isMoney ? 100 : 1)}
          onChange={event => item(row.id, key, isMoney ? Math.round(Number(event.target.value) * 100) : Number(event.target.value))} /></td>;
      })}
    </tr>)}</tbody></table></div>
    <p className="engine-table-note">Chance is the protected current distribution. Stock is shared across outcomes; sell-backs return the same unit.</p>
  </section>;
}

export function Players({ state }: { state: EngineState | null }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil((state?.players.length ?? 0) / 100));
  const current = Math.min(page, pages - 1);
  return <section className="engine-panel engine-data">
    <div className="engine-panel-title"><h2>VISITOR SESSIONS</h2><span>{num(state?.players.length ?? 0)} VISITORS</span></div>
    {state ? <><div className="engine-pagination">
      <button disabled={current === 0} onClick={() => setPage(current - 1)}>← PREVIOUS</button>
      <span>PAGE {current + 1} / {pages} · {state.players.filter(player => player.pulls === 0).length} with 0 pulls so far</span>
      <button disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>NEXT →</button>
    </div><div className="engine-table-wrap"><table><thead><tr>
      {["VISITOR", "PROFILE", "STATUS", "PLANNED", "PULLS", "SPEND", "PAYOUTS", "RETAINED", "NET VALUE"].map(label => <th key={label}>{label}</th>)}
    </tr></thead><tbody>{state.players.slice(current * 100, (current + 1) * 100).map(player => <tr key={player.id}>
      <th>P{player.id}</th><td>{player.profile}</td><td><span className={`engine-player-status ${player.status}`}>{player.status}</span></td>
      <td>{num(player.plannedPulls)}</td><td>{num(player.pulls)}</td><td>{money(player.spentCents)}</td><td>{money(player.payoutCents)}</td>
      <td>{money(player.retainedValueCents)}</td><td>{money(player.payoutCents + player.retainedValueCents - player.spentCents)}</td>
    </tr>)}</tbody></table></div></> : <p className="engine-empty">Start a run to inspect visitor sessions.</p>}
  </section>;
}

export function Stats({ state, summary }: { state: EngineState | null; summary: EngineSummary | null }) {
  const values: [string, string][] = summary ? [
    ["REVENUE", money(summary.revenueCents)], ["HOUSE P/L", money(summary.netPnlCents)],
    ["CASH PAYOUTS", money(summary.payoutCents)], ["RESERVED COST", money(summary.reservedCostCents)],
    ["FEES", money(summary.feesCents)], ["INITIAL STOCK COST", money(summary.initialInvestmentCents)],
    ["CASH AFTER UPFRONT", money(summary.cashAfterUpfrontCents)], ["MAX CASH DRAWDOWN", money(summary.maxCashDrawdownCents)],
    ["USER NET VALUE", money(summary.playerNetCents)], ["PLAYER WINNERS", num(summary.playersWinning)],
    ["SELL-BACKS", num(summary.sellbacks)], ["BROWSED, NO PULL", num(summary.playersBrowsed)],
    ["EXPECTED AWARD", summary.expectedMarketCents === null ? "—" : money(summary.expectedMarketCents)],
    ["EXPECTED LIABILITY", summary.expectedLiabilityCents === null ? "—" : money(summary.expectedLiabilityCents)],
    ["EXPECTED HOUSE EDGE", summary.expectedHouseEdge === null ? "BLOCKED" : pct(summary.expectedHouseEdge)],
    ["VALUE RTP", summary.revenueCents ? pct((summary.payoutCents + summary.retainedValueCents) / summary.revenueCents) : "—"],
    ["FIRST ITEM EMPTY", summary.firstItemDepletedAtPull === null ? "NOT EMPTY" : `PULL ${num(summary.firstItemDepletedAtPull)}`],
    ["ALL STOCK EMPTY", summary.totalDepletedAtPull === null ? "NOT EMPTY" : `PULL ${num(summary.totalDepletedAtPull)}`],
    ["SIMULATED TIME", `${num(summary.simulatedSeconds)}s`], ["RUN SEED", String(state!.config.seed)],
  ] : [];
  const history = state?.history ?? [];
  const scale = Math.max(1, ...history.map(point => Math.abs(point.netPnlCents)));
  const end = Math.max(1, state?.totalPulls ?? 0);
  const points = history.map(point => `${point.pull / end * 100},${50 - point.netPnlCents / scale * 45}`).join(" ");
  return <section className="engine-panel engine-stats">
    <div className="engine-panel-title"><h2>RUN STATISTICS</h2><span>{state?.stopReason === "pull-cap" ? "ALL VISITS COMPLETED" : state?.stopReason?.replaceAll("-", " ") ?? "CURRENT"}</span></div>
    {!summary ? <p className="engine-empty">Start a run to see its results.</p> : <>
      <div className="engine-results-grid">{values.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <div className="engine-pnl-chart"><strong>HOUSE P/L · BY PULL</strong><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="House profit and loss across completed pulls">
        <line x1="0" x2="100" y1="50" y2="50" /><polyline points={points} />
      </svg></div>
      <p className="engine-edge-note">Positive expected edge does not guarantee realized profit. User net includes retained market value. Shipping stays queued; fulfillment and taxes are excluded.</p>
    </>}
  </section>;
}
