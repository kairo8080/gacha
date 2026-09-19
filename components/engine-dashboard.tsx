"use client";

import { useMemo, useState } from "react";
import { Stock, Players, Stats } from "@/components/engine-details";
import { Gamepad2, Package, RotateCcw } from "@/components/pixel-icons";
import ProductImage from "@/components/product-image";
import type { ProductImagePrize } from "@/lib/product-images";
import { APP_VERSION } from "@/lib/version";
import { createEngine, summarizeEngine, type EngineConfig, type EngineItem, type EngineState } from "@/lib/engine";
import type { MachineId } from "@/lib/demo";

type Props={config:EngineConfig;items:EngineItem[];run:EngineState|null;mode:"idle"|"running"|"paused"|"instant";speed:number;error:string;replay:boolean;onConfigChange:(v:EngineConfig)=>void;onItemsChange:(v:EngineItem[])=>void;onMachineChange:(v:MachineId)=>void;onStart:()=>void;onPause:()=>void;onReset:()=>void;onInstant:()=>void;onSpeedChange:(v:number)=>void;onReplayChange:(v:boolean)=>void;onExport:()=>void;onLogout:()=>void};
const money=(v:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(v/100);
const num=(v:number)=>new Intl.NumberFormat("en-US").format(v);
const pct=(v:number|null|undefined)=>v==null?"—":v>0&&v<0.00001?"<0.001%":`${(v*100).toFixed(Math.abs(v*100)<1?3:1)}%`;
function Input({value,disabled,onChange,step=1,label}:{value:number;disabled:boolean;onChange:(v:number)=>void;step?:number;label:string}){return <input aria-label={label} type="number" value={Number.isFinite(value)?value:0} step={step} disabled={disabled} onChange={e=>onChange(Number(e.target.value))}/>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="engine-field">
<span>{label}</span>
<div>{children}</div>
</label>}
function Kpi({label,value,note,tone=""}:{label:string;value:string;note:string;tone?:string}){return <article className={`engine-metric ${tone}`}>
<h2>{label}</h2>
<strong>{value}</strong>
<p>{note}</p>
</article>}

export default function EngineDashboard(p:Props){const {config,items,run:state,mode,speed,error,replay,onConfigChange,onItemsChange,onMachineChange,onStart,onPause,onReset,onInstant,onSpeedChange,onReplayChange,onExport,onLogout}=p;
const [tab,setTab]=useState<"live"|"setup"|"stock"|"players"|"stats">("live");
const locked=!!state;
const summary=state?summarizeEngine(state):null;
const oddsPreview=useMemo(()=>{if(state)return state;try{return createEngine(config,items);}catch{return null;}},[state,config,items]);
const rows=state?.items??items.map(i=>({...i,available:i.initialStock,reservedKeep:0,queued:0,pulls:0,sellbacks:0}));
const initial=rows.reduce((a,i)=>a+i.initialStock,0),available=rows.reduce((a,i)=>a+i.available,0);
const revenue=state?.revenueCents??0,payouts=state?.payoutCents??0,cogs=state?.reservedCostCents??0,fees=state?.feesCents??0,net=revenue-payouts-cogs-fees;
const event=state?.events.at(-1);
const player=state?.players.find(x=>x.id===event?.userId&&x.status==="active")??state?.players.find(x=>x.status==="active");
const playing=mode==="running"&&(summary?.playersActive??0)>0;
const machine=config.machineId[0].toUpperCase()+config.machineId.slice(1);
const change=<K extends keyof EngineConfig>(k:K,v:EngineConfig[K])=>onConfigChange({...config,[k]:v});
const item=<K extends keyof EngineItem>(id:string,k:K,v:EngineItem[K])=>onItemsChange(items.map(x=>x.id===id?{...x,[k]:v}:x));
const status=mode==="instant"?"COMPUTING RESULTS…":state?.stopReason==="edge-protected"?"EDGE PROTECTED · RESTOCK OR CHANGE PRICE":state?.stopReason==="pull-cap"?"ALL VISITS COMPLETED":state?.stopReason?state.stopReason.replaceAll("-"," "):mode==="paused"?"PAUSED · NO ACTIVITY IS SIMULATED":mode==="idle"?"READY FOR A NEW SCENARIO":"LIVE SIMULATION";
return <div className="engine-ui engine-shell">
<header className="engine-header">
<a className="engine-brand" href="/">
<span className="engine-logo">
<Gamepad2 size={25}/>
</span>
<span>GACHA <b>ENGINE</b>
</span>
<small>{APP_VERSION}</small>
</a>
<nav>
<a href="/admin">ADMIN</a>
<a href="/">ARCADE</a>
</nav>
<button className="engine-text-button" onClick={onLogout}>LOG OUT</button>
</header>
<div className="engine-strip">
<span>SIMULATION · FICTIONAL USD · NO LIVE INVENTORY OR PAYMENTS</span>
<span className={`engine-status ${mode}`}>{status}</span>
</div>
<main className="engine-main">{error&&<p className="engine-error" role="alert">{error}</p>}<section className="engine-controls engine-panel">
<div className="engine-control-row">
<div className="engine-buttons">{mode==="running"||mode==="instant"?<button className="engine-secondary" onClick={onPause}>{mode==="instant"?"STOP FULL RUN":"PAUSE"}</button>:<button className="engine-primary" onClick={()=>{setTab("live");onStart();}}>{mode==="paused"?"RESUME":"START NEW RUN"}</button>}<button className="engine-secondary" onClick={onReset}>
<RotateCcw size={16}/> RESET</button>
<button className="engine-secondary" disabled={mode==="running"||mode==="instant"} onClick={()=>{setTab("live");onInstant();}}>FULL RUN</button>
<button className="engine-secondary" disabled={!state} onClick={onExport}>EXPORT JSON</button>
</div>
<label className="engine-speed">TARGET SPEED <strong>{speed}×</strong>
<input aria-label="Target simulation speed" type="range" min="0" max="4" value={[1,2,10,100,1000].indexOf(speed)} onChange={e=>onSpeedChange([1,2,10,100,1000][Number(e.target.value)])}/>
<small>device-limited · fast modes show batches</small>
</label>
</div>
</section>
<div className="engine-tabs engine-primary-tabs" role="tablist">{(["live","setup","stock","players","stats"] as const).map(x=>
<button key={x} role="tab" aria-selected={tab===x} className={tab===x?"active":""} onClick={()=>setTab(x)}>{x.toUpperCase()}</button>)}</div>
{tab==="live"&&<>
<section className="engine-live-kpis">
<Kpi label="PLAYERS ACTIVE" value={`${num(mode==="running"?(summary?.playersActive??0):0)} / ${num(config.users)}`} note={mode==="paused"?"0 while paused":`${num(summary?.visitorsOnline??0)} online · ${num(summary?.playersArrived??0)} arrived`} tone="mint"/>
<Kpi label="TOTAL PULLS" value={num(state?.totalPulls??0)} note={`${num(state?.plannedPulls??0)} planned`}/>
<Kpi label="HOUSE P/L" value={money(net)} note="actual run result" tone={net>=0?"mint":"red"}/>
<Kpi label="STOCK LEFT" value={`${num(available)} / ${num(initial)}`} note={`${initial?pct(available/initial):"—"} available`} tone="gold"/>
</section>
<section className="engine-live-grid">
<section className="engine-panel engine-machine-stage">
<div className="engine-panel-title">
<h2>LIVE MACHINE · {machine}</h2>
<span>{playing?"PLAYING":mode==="paused"?"PAUSED":state?.stopReason?"FINISHED":"WAITING"}</span>
</div>
<div className="engine-machine-body">
<div className="engine-visitor">
<span className={`engine-avatar ${player?.profile??"browser"}`} aria-hidden="true"/>
<b>{player?`PLAYER ${player.id}`:state?.stopReason?"RUN FINISHED":"WAITING FOR PLAYERS"}</b>
<small>{player?`${player.profile.toUpperCase()} · ${num(player.pulls)} / ${num(player.plannedPulls)} pulls`:state?.stopReason?`${num(summary?.playersPlayed??0)} visitors played`:"Visitors arrive during the window"}</small>
<small>{num(summary?.playersWaiting??config.users)} waiting · {num(summary?.playersDeparted??0)} left</small>
</div>
<div className={`engine-machine-art ${playing?"running":""}`}>
<span role="img" aria-label={`${machine} machine`} style={{backgroundImage:`url(/pixelart/${machine}.png)`}}/>
</div>
<div className="engine-award">
<span>LATEST AWARD</span>{event&&<ProductImage prize={(rows.find(x=>x.id===event.itemId)??rows[0]) as ProductImagePrize} size={44}/>}<strong>{event?.itemName??"—"}</strong>
<small>{event?`PULL ${num(event.pull)} · ${money(event.marketCents)} value`:"The next award appears here."}</small>
</div>
</div>
<div className="engine-lanes">
<div className={event?.action==="sell"?"selected sell":"sell"}>
<b>SELL RETURN</b>
<span>{num(summary?.sellbacks??0)} returned</span>
</div>
<div className={event?.action==="keep"?"selected keep":"keep"}>
<b>KEEP</b>
<span>{num(summary?.reservedKeep??0)} held</span>
</div>
<div className={event?.action==="ship"?"selected ship":"ship"}>
<b>SHIP</b>
<span>{num(summary?.queued??0)} queued</span>
</div>
</div>
</section>
<aside className="engine-panel engine-live-side">
<div className="engine-panel-title">
<h2>RUN READOUT</h2>
<span>{state?`${Math.floor(state.simulatedSeconds)}S`:"NOT STARTED"}</span>
</div>
<div className="engine-economics">
<div>
<span>REVENUE</span>
<b>{money(revenue)}</b>
</div>
<div>
<span>PAYOUTS</span>
<b>{money(payouts)}</b>
</div>
<div>
<span>{state?"EXPECTED EDGE":"TARGET EDGE"}</span>
<b>{state?.expectedHouseEdge===null?"BLOCKED":pct(state?.expectedHouseEdge??config.targetHouseEdge)}</b>
</div>
<div>
<span>EXPECTED AWARD</span>
<b>{state?.expectedMarketCents==null?"—":money(state.expectedMarketCents)}</b>
</div>
</div>
<p className="engine-edge-note">Expected edge is a distribution estimate; it does not guarantee this run’s profit.</p>
<div className="engine-stock-gauges">
<h3>STOCK MOVING</h3>
<Gauge label="AVAILABLE" value={available} total={initial} tone="available"/>
<Gauge label="KEPT" value={rows.reduce((a,x)=>a+x.reservedKeep,0)} total={initial} tone="kept"/>
<Gauge label="SHIP QUEUE" value={rows.reduce((a,x)=>a+x.queued,0)} total={initial} tone="queue"/>
</div>
</aside>
</section>
<section className="engine-panel engine-feed">
<div className="engine-panel-title">
<h2>RECENT ACTIVITY</h2>
<span>{state?`LATEST ${num(Math.min(state.events.length,6))} PULLS`:"NO ACTIVITY"}</span>
</div>{state?.events.length?<div className="engine-feed-list">{state.events.slice(-6).reverse().map(e=>
<div key={`${e.pull}-${e.userId}`}>
<b>P{e.userId}</b>
<span>pulled <strong>{e.itemName}</strong>
</span>
<em className={e.action}>{e.action==="sell"?`sold for ${money(e.payoutCents)}`:e.action==="keep"?"kept award":"queued shipping"}</em>
<small>{Math.floor(e.simulatedSeconds)}s</small>
</div>)}</div>:<div className="engine-empty">
<Package size={28}/>
<strong>{mode==="paused"?"PAUSED — NO NEW EVENTS":"START A RUN TO SEE ACTIVITY"}</strong>
</div>}</section>
</>}
{tab==="setup"&&<section className="engine-panel engine-config">
<div className="engine-panel-title">
<h2>SCENARIO SETUP</h2>
<span>{locked?"LOCKED FOR THIS RUN":"NEW RUN"}</span>
</div>
<div className="engine-machine-row">
<span>MACHINE</span>{(["common","rare","epic"] as MachineId[]).map(x=>
<button key={x} disabled={locked} className={config.machineId===x?"selected":""} onClick={()=>onMachineChange(x)}>{x}</button>)}</div>
<div className="engine-field-grid">
<Field label="VISITORS">
<Input label="players" value={config.users} disabled={locked} onChange={v=>change("users",v)}/>
</Field>
<Field label="MAX PULLS / SESSION">
<Input label="max pulls" value={config.pullsPerUser} disabled={locked} onChange={v=>change("pullsPerUser",v)}/>
</Field>
<Field label="PRICE USD">
<Input label="price" value={config.pullPriceCents/100} step={.01} disabled={locked} onChange={v=>change("pullPriceCents",Math.round(v*100))}/>
</Field>
<Field label="TARGET HOUSE EDGE">
<Input label="edge" value={config.targetHouseEdge*100} disabled={locked} onChange={v=>change("targetHouseEdge",v/100)}/>
</Field>
<Field label="ARRIVAL WINDOW S">
<Input label="arrival" value={config.arrivalWindowSeconds} disabled={locked} onChange={v=>change("arrivalWindowSeconds",v)}/>
</Field>
<Field label="SECONDS / PULL">
<Input label="cadence" value={config.secondsPerPull} step={.1} disabled={locked} onChange={v=>change("secondsPerPull",v)}/>
</Field>
<Field label="PAYOUT RATE">
<Input label="payout rate" value={config.sellbackRate*100} disabled={locked} onChange={v=>change("sellbackRate",v/100)}/>
</Field>
<Field label="FEES USD">
<Input label="fees" value={config.feeCents/100} step={.01} disabled={locked} onChange={v=>change("feeCents",Math.round(v*100))}/>
</Field>
</div>
<div className="engine-actions">
<h3>PLAYER DECISIONS <small>Profiles determine session plans. No individual player odds are manipulated.</small>
</h3>{(["sell","keep","ship"] as const).map(x=>
<Field key={x} label={x.toUpperCase()}>
<Input label={x} value={config[`${x}Probability`]*100} disabled={locked} onChange={v=>change(`${x}Probability`,v/100)}/>
<small>%</small>
</Field>)}</div>
<div className="engine-replay">
<label>
<input type="checkbox" checked={replay} disabled={locked} onChange={e=>onReplayChange(e.target.checked)}/> REPEATABLE REPLAY</label>
<span>{replay?`uses seed ${state?.config.seed??config.seed}`:"new runs use a fresh random seed"}</span>
<Field label="REPLAY SEED">
<Input label="seed" value={config.seed} disabled={locked||!replay} onChange={v=>change("seed",v)}/>
</Field>
</div>
<p className="engine-profile-note">Synthetic visitors: 20% browse (0 pulls), 40% casual (1–5), 30% regular (6–30), 10% collectors (31–200). Random arrivals and pacing; session maximum caps each plan.</p>
</section>}
{tab==="stock"&&<Stock rows={rows} odds={oddsPreview?.currentOdds??[]} locked={locked} item={item}/>} {tab==="players"&&<Players state={state}/>} {tab==="stats"&&<Stats state={state} summary={summary}/>}</main>
</div>}
function Gauge({label,value,total,tone}:{label:string;value:number;total:number;tone:string}){return <div className="engine-gauge">
<span>{label}</span>
<b>{num(value)} <small>/ {num(total)}</small>
</b>
<i>
<em className={tone} style={{width:`${total?value/total*100:0}%`}}/>
</i>
</div>}
