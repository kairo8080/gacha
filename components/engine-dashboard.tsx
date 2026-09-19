"use client";

import { useState } from "react";
import { Gamepad2, Package, RotateCcw } from "@/components/pixel-icons";
import ProductImage from "@/components/product-image";
import type { ProductImagePrize } from "@/lib/product-images";
import { APP_VERSION } from "@/lib/version";
import {
  summarizeEngine,
  type EngineConfig,
  type EngineItem,
  type EngineState,
} from "@/lib/engine";
import type { MachineId } from "@/lib/demo";

type Props = {
  config: EngineConfig;
  items: EngineItem[];
  run: EngineState | null;
  mode: "idle" | "running" | "paused" | "instant";
  speed: number;
  error: string;
  onConfigChange: (config: EngineConfig) => void;
  onItemsChange: (items: EngineItem[]) => void;
  onMachineChange: (id: MachineId) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onInstant: () => void;
  onSpeedChange: (speed: number) => void;
  onExport: () => void;
  onLogout: () => void;
};

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
const number = (value: number) => new Intl.NumberFormat("en-US").format(value);
const pct = (value: number) => {
  const percent = value * 100;
  if (percent > 0 && percent < 0.001) return "<0.001%";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: percent < 1 ? 3 : 1 }).format(percent)}%`;
};

function NumberField({ value, disabled, onChange, step = 1, min = 0, label }: { value: number; disabled: boolean; onChange: (value: number) => void; step?: number; min?: number; label?: string }) {
  return <input aria-label={label} type="number" value={Number.isFinite(value) ? value : 0} min={min} step={step} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />;
}

export default function EngineDashboard({ config, items, run, mode, speed, error, onConfigChange, onItemsChange, onMachineChange, onStart, onPause, onReset, onInstant, onSpeedChange, onExport, onLogout }: Props) {
  const [tab, setTab] = useState<"stock" | "players" | "activity">("stock");
  const locked = run !== null;
  const state = run;
  const currentItems = state?.items ?? items.map((item) => ({ ...item, available: item.initialStock, reservedKeep: 0, queued: 0, pulls: 0, sellbacks: 0 }));
  const summary = state ? summarizeEngine(state) : null;
  const initial = currentItems.reduce((sum, item) => sum + item.initialStock, 0);
  const available = currentItems.reduce((sum, item) => sum + item.available, 0);
  const reserved = currentItems.reduce((sum, item) => sum + item.reservedKeep + item.queued, 0);
  const weightedAvailable = currentItems.reduce((sum, item) => sum + item.available * item.weight, 0);
  const pulls = state?.totalPulls ?? 0;
  const revenue = state?.revenueCents ?? 0;
  const payouts = state?.payoutCents ?? 0;
  const fees = state?.feesCents ?? 0;
  const retained = state?.retainedValueCents ?? 0;
  const cogs = state?.reservedCostCents ?? 0;
  const houseNet = revenue - payouts - cogs - fees;
  const played = state?.players.filter((player) => player.pulls > 0).length ?? 0;
  const activeUsers = mode === "running" ? (summary?.playersActive ?? 0) : 0;
  const userSpend = state?.players.reduce((sum, player) => sum + player.spentCents, 0) ?? 0;
  const userNet = payouts + retained - userSpend;
  const lastEvents = state?.events.slice(-7).reverse() ?? [];
  const history = state?.history ?? [];
  const maxPulls = config.users * config.pullsPerUser;
  const chanceTotal = config.sellProbability + config.keepProbability + config.shipProbability;
  const updateConfig = <K extends keyof EngineConfig>(key: K, value: EngineConfig[K]) => onConfigChange({ ...config, [key]: value });
  const updateItem = <K extends keyof EngineItem>(id: string, key: K, value: EngineItem[K]) => onItemsChange(items.map((item) => item.id === id ? { ...item, [key]: value } : item));

  const chartValues = history.length ? history.map((entry) => entry.netPnlCents) : [0];
  const chartMax = Math.max(1, ...chartValues.map(Math.abs));
  const lastChartPull = Math.max(1, history.at(-1)?.pull ?? 0);
  const points = history.length ? history.map((entry) => `${(entry.pull / lastChartPull) * 100},${50 - (entry.netPnlCents / chartMax) * 42}`).join(" ") : "0,50 100,50";

  return <div className="engine-ui engine-shell">
    <header className="engine-header">
      <a className="engine-brand" href="/"><span className="engine-logo"><Gamepad2 size={25} /></span><span>GACHA <b>ENGINE</b></span><small>{APP_VERSION}</small></a>
      <nav aria-label="Site navigation"><a href="/admin">ADMIN</a><a href="/">ARCADE</a></nav>
      <button className="engine-text-button" onClick={onLogout}>LOG OUT</button>
    </header>
    <div className="engine-strip"><span>SIMULATION · FICTIONAL USD · SCENARIO WEIGHTS · NO LIVE INVENTORY OR PAYMENTS</span><span className={`engine-status ${mode}`}>{mode === "instant" ? "FULL RUNNING" : state?.stopReason ? "COMPLETE" : mode.toUpperCase()}</span></div>
    <main className="engine-main">
      <div className="engine-title"><div><p>CONTROLLED ECONOMY TEST</p><h1>GACHA ENGINE</h1></div><span>{locked ? "CONFIGURATION LOCKED FOR THIS RUN" : "SET INPUTS, THEN START"}</span></div>
      {error && <p className="engine-error" role="alert">{error}</p>}
      <section className="engine-controls engine-panel">
        <div className="engine-panel-title"><h2>RUN CONTROLS</h2><span>{number(pulls)} / {number(maxPulls)} PULLS</span></div>
        <div className="engine-control-row">
          <div className="engine-buttons">
            {mode === "running" || mode === "instant" ? <button className="engine-secondary" onClick={onPause}>{mode === "instant" ? "CANCEL FULL RUN" : "PAUSE"}</button> : <button className="engine-primary" onClick={onStart}>{mode === "paused" ? "RESUME" : state?.stopReason ? "RUN AGAIN" : "START"}</button>}
            <button className="engine-secondary" onClick={onReset}><RotateCcw size={16} /> RESET</button>
            <button className="engine-secondary" disabled={mode === "running" || mode === "instant"} onClick={onInstant}>FULL RUN</button>
            <button className="engine-secondary" disabled={!state} onClick={onExport}>EXPORT JSON</button>
          </div>
          <label className="engine-speed">TARGET SPEED <strong>{speed}×</strong><input aria-label="Target simulation speed" type="range" min="0" max="4" step="1" value={[1, 2, 10, 100, 1000].indexOf(speed)} onChange={(event) => onSpeedChange([1, 2, 10, 100, 1000][Number(event.target.value)])} /><small>1× = real-time baseline · device-limited</small></label>
        </div>
      </section>
      <section className="engine-kpis" aria-label="Engine results">
        <Metric label="REVENUE" value={money(revenue)} note="simulated user spend" tone="mint" />
        <Metric label="HOUSE NET P/L" value={money(houseNet)} note="revenue − payouts − reserved COGS − fees" tone={houseNet >= 0 ? "mint" : "red"} />
        <Metric label="PAYOUTS" value={money(payouts)} note="cash paid to users" />
        <Metric label="ACTIVE USERS" value={`${number(activeUsers)} / ${number(config.users)}`} note={`${number(played)} played · 0 while paused`} />
        <Metric label="STOCK LEFT" value={initial ? pct(available / initial) : "—"} note={`${number(available)} available · held and queue excluded`} tone="gold" />
        <Metric label="RESERVED" value={number(reserved)} note={`${number(summary?.reservedKeep ?? 0)} held · ${number(summary?.queued ?? 0)} queue`} />
      </section>
      <div className="engine-layout">
        <section className="engine-config engine-panel">
          <div className="engine-panel-title"><h2>INPUTS</h2><span>{locked ? "READ ONLY" : "EDITABLE"}</span></div>
          <div className="engine-machine-row"><span>MACHINE</span>{(["common", "rare", "epic"] as MachineId[]).map((machine) => <button key={machine} disabled={locked} className={config.machineId === machine ? "selected" : ""} onClick={() => onMachineChange(machine)}>{machine}</button>)}</div>
          <div className="engine-field-grid">
            <Field label="USERS"><NumberField value={config.users} disabled={locked} onChange={(value) => updateConfig("users", value)} /></Field>
            <Field label="PULLS / USER"><NumberField value={config.pullsPerUser} disabled={locked} onChange={(value) => updateConfig("pullsPerUser", value)} /></Field>
            <Field label="PRICE USD"><NumberField value={config.pullPriceCents / 100} disabled={locked} step={0.01} onChange={(value) => updateConfig("pullPriceCents", Math.round(value * 100))} /></Field>
            <Field label="PAYOUT RATE"><NumberField value={config.sellbackRate * 100} disabled={locked} step={1} onChange={(value) => updateConfig("sellbackRate", value / 100)} /><small>% of market</small></Field>
            <Field label="FEES USD"><NumberField value={config.feeCents / 100} disabled={locked} step={0.01} onChange={(value) => updateConfig("feeCents", Math.round(value * 100))} /></Field>
            <Field label="SEED"><NumberField value={config.seed} disabled={locked} onChange={(value) => updateConfig("seed", value)} /></Field>
            <Field label="SECONDS / PULL"><NumberField value={config.secondsPerPull} disabled={locked} step={0.1} onChange={(value) => updateConfig("secondsPerPull", value)} /></Field>
          </div>
          <div className="engine-actions"><h3>USER DECISIONS <small>{pct(chanceTotal)} total</small></h3><Field label="SELL"><NumberField value={config.sellProbability * 100} disabled={locked} onChange={(value) => updateConfig("sellProbability", value / 100)} /><small>%</small></Field><Field label="KEEP"><NumberField value={config.keepProbability * 100} disabled={locked} onChange={(value) => updateConfig("keepProbability", value / 100)} /><small>%</small></Field><Field label="SHIP"><NumberField value={config.shipProbability * 100} disabled={locked} onChange={(value) => updateConfig("shipProbability", value / 100)} /><small>%</small></Field></div>
          <p className="engine-hint">Actions must total 100%. Running or paused runs preserve their original inputs.</p>
        </section>
        <section className="engine-results engine-panel">
          <div className="engine-panel-title"><h2>LIVE ECONOMICS</h2><span>{state?.stopReason ? state.stopReason.replaceAll("-", " ") : mode === "idle" ? "WAITING" : "UPDATING"}</span></div>
          <div className="engine-results-grid"><Result label="INITIAL STOCK COST" value={money(state?.initialInvestmentCents ?? items.reduce((sum, item) => sum + item.initialStock * item.costCents, 0))} /><Result label="RESERVED COST" value={money(cogs)} /><Result label="FEES" value={money(fees)} /><Result label="USER NET VALUE" value={money(userNet)} /><Result label="CASH AFTER UPFRONT" value={money(summary?.cashAfterUpfrontCents ?? -items.reduce((sum, item) => sum + item.initialStock * item.costCents, 0))} /><Result label="MAX CASH DRAWDOWN" value={money(summary?.maxCashDrawdownCents ?? 0)} /><Result label="SIMULATED TIME" value={summary ? `${number(summary.simulatedSeconds)}s` : "—"} /><Result label="SELLBACKS" value={number(summary?.sellbacks ?? 0)} /><Result label="KEEP / SHIP" value={`${number(summary?.reservedKeep ?? 0)} / ${number(summary?.queued ?? 0)}`} /><Result label="WINNERS" value={number(summary?.playersWinning ?? 0)} /><Result label="RTP" value={revenue ? pct((payouts + retained) / revenue) : "—"} /><Result label="FIRST ITEM EMPTY" value={state?.firstItemDepletedAtPull !== null && state?.firstItemDepletedAtPull !== undefined ? `PULL ${number(state.firstItemDepletedAtPull)}` : "NOT DEPLETED"} /><Result label="TOTAL STOCK EMPTY" value={state?.totalDepletedAtPull !== null && state?.totalDepletedAtPull !== undefined ? `PULL ${number(state.totalDepletedAtPull)}` : "NOT DEPLETED"} /></div>
          <div className="engine-chart"><div><strong>HOUSE P/L TRACE</strong><span>{money(houseNet)}</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`House profit and loss trace, current house net ${money(houseNet)}`}><line x1="0" x2="100" y1="50" y2="50" /><polyline points={points} /></svg><small>Trace uses actual pull checkpoints. A payout is cash returned; user net value also includes retained items.</small></div>
        </section>
      </div>
      <section className="engine-panel engine-data">
        <div className="engine-tabs" role="tablist" aria-label="Engine details">{(["stock", "players", "activity"] as const).map((entry) => <button key={entry} role="tab" aria-selected={tab === entry} className={tab === entry ? "active" : ""} onClick={() => setTab(entry)}>{entry.toUpperCase()}{entry === "activity" && state ? ` · ${number(state.events.length)}` : ""}</button>)}</div>
        {tab === "stock" && <div className="engine-table-wrap"><table><thead><tr><th>ITEM</th><th>INITIAL</th><th>AVAILABLE</th><th>KEEP</th><th>QUEUE</th><th>PULLS</th><th>SELLBACKS</th><th>CHANCE</th><th>QTY</th><th>EK USD</th><th>VK USD</th><th>WEIGHT</th></tr></thead><tbody>{currentItems.map((item) => <tr key={item.id}><th><ProductImage prize={item as ProductImagePrize} size={34} /><span>{item.name}<small>{item.kind}</small></span></th><td>{number(item.initialStock)}</td><td><span className="engine-stock-count">{number(item.available)}<small>{item.initialStock ? ` ${pct(item.available / item.initialStock)}` : ""}</small><i aria-label={`${item.name} stock allocation`}><b style={{ width: `${item.initialStock ? item.available / item.initialStock * 100 : 0}%` }} /><b style={{ width: `${item.initialStock ? item.reservedKeep / item.initialStock * 100 : 0}%` }} /><b style={{ width: `${item.initialStock ? item.queued / item.initialStock * 100 : 0}%` }} /></i></span></td><td>{number(item.reservedKeep)}</td><td>{number(item.queued)}</td><td>{number(item.pulls)}</td><td>{number(item.sellbacks)}</td><td>{pct(weightedAvailable ? item.available * item.weight / weightedAvailable : 0)}</td><td><NumberField label={`${item.name} quantity`} value={item.initialStock} disabled={locked} onChange={(value) => updateItem(item.id, "initialStock", value)} /></td><td><NumberField label={`${item.name} cost USD`} value={item.costCents / 100} disabled={locked} step={0.01} onChange={(value) => updateItem(item.id, "costCents", Math.round(value * 100))} /></td><td><NumberField label={`${item.name} market USD`} value={item.marketCents / 100} disabled={locked} step={0.01} onChange={(value) => updateItem(item.id, "marketCents", Math.round(value * 100))} /></td><td><NumberField label={`${item.name} scenario weight`} value={item.weight} disabled={locked} step={0.01} onChange={(value) => updateItem(item.id, "weight", value)} /></td></tr>)}</tbody></table></div>}
        {tab === "players" && <div className="engine-table-wrap"><table><thead><tr><th>USER</th><th>PULLS</th><th>SPEND</th><th>PAYOUTS</th><th>RETAINED</th><th>NET VALUE</th></tr></thead><tbody>{state?.players.slice(0, 150).map((player) => <tr key={player.id}><th>{player.id}</th><td>{number(player.pulls)}</td><td>{money(player.spentCents)}</td><td>{money(player.payoutCents)}</td><td>{money(player.retainedValueCents)}</td><td>{money(player.payoutCents + player.retainedValueCents - player.spentCents)}</td></tr>)}</tbody></table>{state && <p className="engine-table-note">SHOWING {number(Math.min(150, state.players.length))} OF {number(state.players.length)} USERS</p>}{!state && <Empty icon="PLAYERS" text="Start a run to inspect simulated users." />}</div>}
        {tab === "activity" && <div className="engine-activity">{lastEvents.length ? lastEvents.map((event, index) => <div key={`${event.userId}-${event.itemId}-${index}`}><b>{event.action.toUpperCase()}</b><span>{event.userId} · {event.itemName}</span><small>{event.action === "sell" ? money(event.payoutCents) : money(event.marketCents)}</small></div>) : <Empty icon="ACTIVITY" text="Resolved pulls appear here." />}</div>}
      </section>
      <details className="engine-details"><summary>ASSUMPTIONS & MATH</summary><p>All numbers are fictional local simulation data. Scenario weights are independent of Odds Lab and odds change as available units × weight changes with depletion. House net = revenue − sellback payouts − cost of kept or shipped items − fees; it is not guaranteed positive. Available stock excludes items held for keep or shipping. Market value is a user-value estimate, not a payout or cash profit. At 1×, users take one pull per configured interval in round-robin simulation time. The shipping queue is only a 60-day-rule model; nothing ships. Runs stay in memory, so export before leaving.</p></details>
    </main>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="engine-field"><span>{label}</span><div>{children}</div></label>; }
function Metric({ label, value, note, tone = "" }: { label: string; value: string; note: string; tone?: string }) { return <article className={`engine-metric ${tone}`}><h2>{label}</h2><strong>{value}</strong><p>{note}</p></article>; }
function Result({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function Empty({ icon, text }: { icon: string; text: string }) { return <p className="engine-empty"><Package size={24} /><strong>{icon}</strong>{text}</p>; }
