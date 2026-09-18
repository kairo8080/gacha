"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Coins,
  Gamepad2,
  Package,
  RotateCcw,
  ShieldCheck,
  Truck,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from "@/components/pixel-icons";
import {
  demoReducer,
  getMachines,
  getStockCatalog,
  machineStock,
  remainingStock,
  resaleValue,
  type InventoryItem,
  type MachineId,
  type Prize,
} from "@/lib/demo";
import { getLiveMachineOdds, samplePrizeIndex } from "@/lib/odds";
import { APP_VERSION } from "@/lib/version";
import { useDemoSession } from "@/hooks/use-demo-session";
import { useDemoPresence } from "@/hooks/use-demo-presence";
import { PlayerInventory } from "@/components/player-inventory";

const credits = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
const accents: Record<MachineId, string> = {
  common: "#40c7f4",
  rare: "#c073f5",
  epic: "#ffd34d",
};
type Panel = "how" | "wallet" | "result" | "redeem" | "reset" | "pool" | null;

function MachineSprite({
  id,
  className = "",
  animated = false,
}: {
  id: MachineId;
  className?: string;
  animated?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`machine-sprite ${animated ? "sprite-running" : ""} ${className}`}
      style={{
        backgroundImage: `url(/pixelart/${id[0].toUpperCase()}${id.slice(1)}.png)`,
      }}
    />
  );
}

export function PrizeSymbol({ prize }: { prize: Prize }) {
  const typeLabel = prizeTypeLabel(prize);
  return (
    <div className={`prize-symbol ${prize.kind}`} aria-hidden="true">
      {prize.kind === "graded" ? <ShieldCheck /> : <Package />}
      <span>{typeLabel}</span>
      <small className="prize-set-badge">{prize.name}</small>
    </div>
  );
}

function prizeTypeLabel(prize: Prize) {
  if (prize.kind === "pack")
    return prize.packCount === 1 ? "1 PACK" : `${prize.packCount} PACKS`;
  if (prize.kind === "box") return "BOX";
  if (prize.kind === "collection")
    return prize.name.toUpperCase().includes("D23") ? "D23" : "COLLECTION";
  if (prize.kind === "graded")
    return prize.grade?.replace(/\s+/g, "") ?? "GRADED";
  return "MYSTERY";
}

function ClawSequence({ id }: { id: MachineId }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const interval = setInterval(
      () => setFrame((previous) => Math.min(previous + 1, 89)),
      27,
    );
    return () => clearInterval(interval);
  }, []);
  return (
    <div
      className="claw-closeup"
      role="status"
      data-ui="A24"
      data-ui-name="Claw animation"
    >
      <span className="eyebrow">A LITTLE ARCADE MAGIC…</span>
      <div
        className="claw-sprite"
        style={{
          backgroundImage: `url(/pixelart/Claw_${id[0].toUpperCase()}${id.slice(1)}.png)`,
          backgroundPosition: `${(frame % 5) * 25}% ${(Math.floor(frame / 5) / 17) * 100}%`,
        }}
      />
      <span className="mono">YOUR PRIZE IS ON ITS WAY</span>
    </div>
  );
}

function InlinePanel({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (open) heading.current?.focus({ preventScroll: true });
  }, [open, title]);
  if (!open) return null;
  return (
    <section
      className="inline-panel"
      data-ui="A21"
      data-ui-name="Inline detail panel"
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="inline-panel-header">
        <h2 ref={heading} tabIndex={-1}>
          {title}
        </h2>
        <button
          className="text-button"
          onClick={onClose}
          aria-label="Back from details"
        >
          Back <X size={16} />
        </button>
      </div>
      <div className="inline-panel-body">{children}</div>
    </section>
  );
}

export default function Arcade() {
  const {
    state: activeState,
    setState,
    ready,
    storageWarning,
    syncNotice,
    clearSyncNotice,
    legacySessionNotice,
    demoDay,
  } = useDemoSession();
  useDemoPresence(true);
  const [selected, setSelected] = useState<MachineId>("common");
  const [view, setView] = useState<"arcade" | "inventory">("arcade");
  const [panel, setPanel] = useState<Panel>(null);
  const panelTrigger = useRef<HTMLElement | null>(null);
  const [sound, setSound] = useState(false);
  const [running, setRunning] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [showLegacySessionNotice, setShowLegacySessionNotice] = useState(true);
  const [showAllStock, setShowAllStock] = useState(false);
  const pullLock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const machines = getMachines(activeState);
  const stockCatalog = getStockCatalog(activeState).filter(
    (prize) =>
      (prize.availability ?? "active") === "active" &&
      prize.machineIds.length > 0,
  );
  const machine = machines.find((item) => item.id === selected)!;
  const displayedStock = showAllStock ? stockCatalog : machine.prizes;

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const activeHeld = activeState.items.filter((item) => item.status === "held");
  const activeResult = activeState.items.find((item) => item.id === resultId);
  useEffect(() => {
    // A conflicting cross-tab save can reject an optimistic pull. Close its
    // pending reveal; the inline sync notice explains why nothing was charged.
    if (!syncNotice || !resultId || activeResult) return;
    if (timer.current) clearTimeout(timer.current);
    pullLock.current = false;
    setRunning(false);
    setResultId(null);
    setPanel(null);
  }, [syncNotice, resultId, activeResult]);
  const selectedMachineStock = machineStock(activeState, selected);
  const selectedOdds = getLiveMachineOdds(activeState, selected);
  const oddsPaused =
    selectedMachineStock > 0 && selectedOdds.status !== "ready";
  const prizeProbabilities = new Map(
    selectedOdds.rows.map((row) => [row.prizeId, row.probability]),
  );
  const totalRemainingStock = stockCatalog.reduce(
    (total, prize) => total + remainingStock(activeState, prize.id),
    0,
  );
  function act(action: Parameters<typeof demoReducer>[1]) {
    setState((current) => demoReducer(current, action));
  }

  function openPanel(next: Panel) {
    if (next && !panel)
      panelTrigger.current = document.activeElement as HTMLElement;
    setPanel(next);
    if (!next)
      requestAnimationFrame(() => {
        const target = panelTrigger.current;
        if (target?.isConnected) target.focus({ preventScroll: true });
        else
          (
            document.querySelector<HTMLButtonElement>(".pull-button") ??
            document.querySelector<HTMLButtonElement>(".nav-link")
          )?.focus({ preventScroll: true });
      });
  }
  function notify(message: string) {
    setNotice(message);
  }
  function beep() {
    if (!sound) return;
    try {
      const audio = new AudioContext();
      [440, 660, 880].forEach((frequency, index) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = "square";
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.025, audio.currentTime + index * 0.11);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          audio.currentTime + index * 0.11 + 0.12,
        );
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(audio.currentTime + index * 0.11);
        osc.stop(audio.currentTime + index * 0.11 + 0.14);
      });
      setTimeout(() => void audio.close(), 600);
    } catch {
      /* Sound is optional; never interrupt a pull. */
    }
  }
  function finishPull() {
    if (timer.current) clearTimeout(timer.current);
    setRunning(false);
    pullLock.current = false;
    openPanel("result");
  }
  function pull() {
    if (
      !ready ||
      pullLock.current ||
      activeState.balance < machine.price ||
      selectedMachineStock < 1 ||
      oddsPaused
    )
      return;
    pullLock.current = true;
    const itemId = crypto.randomUUID();
    const ticket = new Uint32Array(2);
    crypto.getRandomValues(ticket);
    const random = ((ticket[0] & 0x1fffff) * 2 ** 32 + ticket[1]) / 2 ** 53;
    const prizeIndex = samplePrizeIndex(activeState, selected, random);
    if (prizeIndex < 0) {
      pullLock.current = false;
      notify(
        "This machine is currently unavailable. Check its stock and odds settings.",
      );
      return;
    }
    const action = {
      type: "pull",
      machineId: selected,
      itemId,
      prizeIndex,
      createdAt: new Date().toISOString(),
    } as const;
    const nextState = demoReducer(activeState, action);
    if (
      nextState === activeState ||
      !nextState.items.some((item) => item.id === itemId)
    ) {
      pullLock.current = false;
      notify("This pull could not be completed. Please try again.");
      return;
    }
    setState(nextState);
    beep();
    setResultId(itemId);
    setRunning(true);
    timer.current = setTimeout(
      finishPull,
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 150 : 2600,
    );
  }
  function sell(item: InventoryItem) {
    act({ type: "sell", itemId: item.id });
    openPanel(null);
    notify(`Resold for ${credits(resaleValue(item.prize))} demo credits.`);
  }
  function select(id: MachineId) {
    if (!running) setSelected(id);
  }
  function openInventory() {
    if (!running) {
      setView("inventory");
      setPanel(null);
      setNotice("");
    }
  }
  const panelContent = (
    <InlinePanel
      open={panel !== null}
      onClose={() => openPanel(null)}
      title={
        panel === "result"
          ? "Your demo prize"
          : panel === "redeem"
            ? "Redeem demo prize"
            : panel === "reset"
              ? "Reset demo"
              : panel === "wallet"
                ? "Demo wallet"
                : panel === "pool"
                  ? showAllStock
                    ? "All sample stock"
                    : `${machine.name} sample stock`
                  : "How to play"
      }
    >
      {panel === "pool" && (
        <>
          <div className="pool-meta">
            <strong>
              {showAllStock ? totalRemainingStock : selectedMachineStock}{" "}
              <span>PRIZES LEFT</span>
            </strong>
            <button
              className="text-button"
              onClick={() => setShowAllStock((current) => !current)}
            >
              {showAllStock ? machine.name + " pool" : "All prizes"}{" "}
              <ChevronRight size={15} />
            </button>
          </div>
          <p className="pool-caption">
            Fictional stock · Each pull awards one prize
          </p>
          <div className="pool-stock-list">
            {displayedStock.map((prize) => {
              const eligibleInSelectedMachine =
                prize.machineIds.includes(selected);
              const tier = prize.machineIds[0] ?? selected;
              const left = remainingStock(activeState, prize.id);
              const probability = prizeProbabilities.get(prize.id) ?? 0;
              return (
                <article
                  className="pool-stock-row"
                  key={prize.id}
                  style={{ "--tier-color": accents[tier] } as CSSProperties}
                >
                  <div>
                    <h3>{prize.name}</h3>
                    <span>
                      {prize.detail} · {left} available ·{" "}
                      {eligibleInSelectedMachine
                        ? oddsPaused
                          ? "Draws paused"
                          : selectedMachineStock > 0
                            ? `${probability > 0 && probability < 0.0001 ? "<0.01" : (probability * 100).toFixed(2)}% odds`
                            : "Empty pool"
                        : `Not in ${machine.name} pool`}
                    </span>
                    {showAllStock && (
                      <span>
                        {prize.machineIds.map((machineId) => (
                          <b
                            className={`machine-mini-badge ${machineId}`}
                            key={machineId}
                          >
                            {machineId}
                          </b>
                        ))}
                      </span>
                    )}
                  </div>
                  <strong>
                    {credits(prize.value)} <small>CR</small>
                  </strong>
                </article>
              );
            })}
          </div>
          <p className="pool-caption">
            One bundle or box is one reward unit. These are the current odds for
            the selected machine; they update with stock and admin settings.
            Resell returns the prize to its pool. Displayed percentages are
            rounded.
          </p>
        </>
      )}
      {panel === "how" && (
        <>
          <span className="eyebrow">WELCOME TO GACHA ARCADE</span>
          <h2>PULL. KEEP. REPEAT.</h2>
          <div className="how-steps">
            <div>
              <span>01</span>
              <section>
                <h3>Pick your machine</h3>
                <p>
                  Common, Rare, or Epic. Each has its own sample pool and demo
                  price.
                </p>
              </section>
            </div>
            <div>
              <span>02</span>
              <section>
                <h3>Find your next collectible</h3>
                <p>
                  Spend play credits and reveal a fictional prize. A pull can be
                  a pack bundle, box, graded card, collection, or mystery. You
                  start with 250 credits.
                </p>
              </section>
            </div>
            <div>
              <span>03</span>
              <section>
                <h3>Make it yours</h3>
                <p>
                  Keep it in your demo inventory, resell for play credits, or
                  preview shipping.
                </p>
              </section>
            </div>
          </div>
          <p className="panel-note">
            Simulation only. Resell for 80% of sample value in play credits. No
            real payments or shipping.
          </p>
          <button
            className="primary-button full-width"
            onClick={() => openPanel(null)}
          >
            Let’s play <ArrowRight size={17} />
          </button>
        </>
      )}
      {panel === "wallet" && (
        <>
          <span className="panel-icon">
            <Wallet size={30} />
          </span>
          <span className="eyebrow">FREE PLAY WALLET</span>
          <h2>YOUR PLAY CREDITS.</h2>
          <div className="wallet-total">
            {credits(activeState.balance)}
            <span>demo credits</span>
          </div>
          <p>Saved in this browser. No cash value or withdrawals.</p>
          <div className="panel-note">
            Wallet connection comes later. Play free for now.
          </div>
          <a className="text-button" href="/admin">
            Demo admin
          </a>
          <button
            className="primary-button full-width"
            onClick={() => openPanel(null)}
          >
            Back to the arcade <ArrowRight size={17} />
          </button>
        </>
      )}
      {panel === "result" && activeResult && (
        <>
          <span className="eyebrow">
            {activeResult.status === "held"
              ? "A NEW FIND FOR YOUR COLLECTION"
              : "YOUR DEMO PRIZE"}
          </span>
          <h2>
            {activeResult.status === "held" ? "New pull." : "Demo record."}
          </h2>
          <div
            className="result-prize"
            style={
              {
                "--tier-color": accents[activeResult.machineId],
              } as CSSProperties
            }
          >
            <PrizeSymbol prize={activeResult.prize} />
            <span className="tier-badge">
              {activeResult.machineId.toUpperCase()} MACHINE
            </span>
            <h3>{activeResult.prize.name}</h3>
            <p>{activeResult.prize.detail}</p>
            <strong>
              {credits(activeResult.prize.value)} CR <span>sample value</span>
            </strong>
          </div>
          {activeResult.status === "held" ? (
            <>
              <button
                className="primary-button full-width"
                onClick={() => {
                  openPanel(null);
                  notify("Kept in your demo inventory.");
                }}
              >
                <Package size={18} />
                Keep in inventory
                <Check size={18} />
              </button>
              <div className="result-actions">
                <button onClick={() => sell(activeResult)}>
                  <RotateCcw size={17} />
                  <span>
                    Resell for {credits(resaleValue(activeResult.prize))} CR
                  </span>
                </button>
                <button
                  onClick={() => {
                    openPanel("redeem");
                  }}
                >
                  <Truck size={17} />
                  <span>Redeem</span>
                </button>
              </div>
              <p className="panel-note">
                Sample value only. Your pull is already saved.
              </p>
            </>
          ) : (
            <p className="panel-note">
              {activeResult.status === "sold"
                ? "This demo item has been resold."
                : "This item has a demo shipping request."}
            </p>
          )}
        </>
      )}
      {panel === "redeem" && activeResult && (
        <>
          <span className="eyebrow">DEMO ACTION</span>
          <h2>Redeem this pull?</h2>
          <p>
            <strong>{activeResult.prize.name}</strong>
          </p>
          <p className="panel-note">
            Redeem unlocks the shipping queue. Shipping opens 60 days after
            launch; you can queue now.
          </p>
          <button
            className="primary-button full-width"
            onClick={() => {
              act({ type: "redeem", itemId: activeResult.id });
              openPanel(null);
              notify("Redeemed in your demo collection.");
            }}
          >
            Redeem <Check size={17} />
          </button>
        </>
      )}
      {panel === "reset" && (
        <>
          <span className="panel-icon">
            <RotateCcw size={30} />
          </span>
          <span className="eyebrow">A FRESH START</span>
          <h2>Another round?</h2>
          <p>
            Reset this browser’s demo inventory and history, and restore your
            balance to 250 play credits.
          </p>
          <button
            className="primary-button full-width"
            onClick={() => {
              if (timer.current) clearTimeout(timer.current);
              pullLock.current = false;
              setRunning(false);
              act({ type: "reset" });
              openPanel(null);
              setResultId(null);
              notify("Fresh start. 250 demo credits are ready.");
            }}
          >
            Reset demo session <RotateCcw size={17} />
          </button>
          <button
            className="text-button full-width cancel-button"
            onClick={() => openPanel(null)}
          >
            Keep my session
          </button>
        </>
      )}
    </InlinePanel>
  );
  return (
    <div
      className={`app-shell arcade-view ${view === "inventory" ? "inventory-view" : ""} ${panel ? "has-inline-panel" : ""}`}
    >
      <a className="skip-link" href="#main">
        Skip to arcade
      </a>
      <header className="site-header" data-ui="A01" data-ui-name="Header">
        <button
          className="brand"
          data-ui="A02"
          data-ui-name="Brand and version"
          onClick={() => {
            if (!running) {
              setView("arcade");
              setPanel(null);
            }
          }}
          aria-label="Gacha Arcade home"
        >
          <span className="brand-icon">
            <Gamepad2 size={27} strokeWidth={2.1} />
          </span>
          <span>
            GACHA<span className="brand-sub">ARCADE</span>
          </span>
          <span
            className="release-version"
            aria-label={`Version ${APP_VERSION}`}
          >
            {APP_VERSION}
          </span>
        </button>
        <div className="header-center">
          <nav
            aria-label="Main navigation"
            data-ui="A03"
            data-ui-name="Navigation"
          >
            <button
              disabled={running}
              className={view === "arcade" ? "nav-link active" : "nav-link"}
              onClick={() => {
                setView("arcade");
                setPanel(null);
              }}
            >
              <Gamepad2 size={17} />
              Arcade
            </button>
            <button
              disabled={running}
              className={view === "inventory" ? "nav-link active" : "nav-link"}
              onClick={openInventory}
            >
              <Package size={17} />
              My inventory<span className="nav-count">{activeHeld.length}</span>
            </button>
            <button
              disabled={running}
              className="nav-link help-nav"
              onClick={() => openPanel("how")}
            >
              How to play
              <ArrowUpRight size={14} />
            </button>
          </nav>
          <small
            className="header-demo-note"
            data-ui="A05"
            data-ui-name="Demo note"
          >
            Demo · Sample prizes · No real payments
          </small>
        </div>
        <div className="header-actions">
          <button
            disabled={running}
            className="wallet-button"
            data-ui="A04"
            data-ui-name="Demo wallet"
            aria-label={`Demo wallet ${credits(activeState.balance)} CR`}
            onClick={() => openPanel("wallet")}
          >
            <Wallet size={17} />
            <span>Demo wallet</span>
            <span className="wallet-amount">
              {credits(activeState.balance)}
              <span className="tiny"> CR</span>
            </span>
          </button>
          <button
            className="header-reset"
            disabled={running}
            onClick={() => openPanel("reset")}
            aria-label="Reset demo session"
            data-ui="A06"
            data-ui-name="Reset session"
          >
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>
        </div>
      </header>

      <main
        id="main"
        className="main-content"
        data-ui="A07"
        data-ui-name="Main workspace"
      >
        <h1 className="sr-only">
          {view === "arcade" ? "Gacha Arcade" : "Your collection"}
        </h1>

        {(notice ||
          storageWarning ||
          syncNotice ||
          (legacySessionNotice && showLegacySessionNotice)) && (
          <div
            className="arcade-feedback"
            data-ui="A22"
            data-ui-name="Inline feedback"
            role="status"
            aria-live="polite"
          >
            <span>
              {storageWarning
                ? "Storage unavailable. This session may not survive a refresh."
                : syncNotice ||
                  notice ||
                  "Your previous demo is saved separately. This session uses sample stock."}
            </span>
            {!storageWarning && (
              <button
                aria-label="Dismiss update"
                onClick={() => {
                  setNotice("");
                  clearSyncNotice();
                  setShowLegacySessionNotice(false);
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {view === "arcade" ? (
          <>
            <div className="arcade-layout">
              <section
                className="arcade-panel"
                data-ui="A08"
                data-ui-name="Arcade cabinet"
                aria-label="Machine selection"
              >
                <div
                  className="panel-toolbar"
                  data-ui="A09"
                  data-ui-name="Scene toolbar"
                >
                  <span>
                    <Gamepad2 size={16} /> THE ARCADE
                  </span>
                  <div>
                    <span className="toolbar-hint">
                      {running
                        ? "PULL IN PROGRESS"
                        : sound
                          ? "SOUND ON"
                          : "SOUND OFF"}
                    </span>
                    <button
                      className="icon-button"
                      aria-label={
                        sound ? "Mute arcade sound" : "Enable arcade sound"
                      }
                      aria-pressed={sound}
                      onClick={() => setSound(!sound)}
                    >
                      {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
                    </button>
                  </div>
                </div>
                <div
                  className={`arcade-scene ${running ? "is-running" : ""}`}
                  data-ui="A10"
                  data-ui-name="Store scene"
                >
                  <div
                    className="scene-sign"
                    data-ui="A11"
                    data-ui-name="Scene sign"
                  >
                    <span>✦</span> SELECT YOUR MACHINE <span>✦</span>
                  </div>
                  <div className="rear-machines" aria-hidden="true" />
                  <div className="gray-machine gray-left" aria-hidden="true" />
                  <div className="gray-machine gray-right" aria-hidden="true" />
                  <div
                    className="scene-machines"
                    data-ui="A12"
                    data-ui-name="Machine group"
                    role="group"
                    aria-label="Choose machine tier"
                  >
                    {machines.map((item, index) => (
                      <button
                        key={item.id}
                        className={`scene-machine ${item.id === selected ? "selected" : ""} ${item.id}`}
                        disabled={running}
                        aria-label={`Select ${item.name} machine`}
                        data-ui={`A${13 + index}`}
                        data-ui-name={`${item.name} machine`}
                        aria-pressed={selected === item.id}
                        onClick={() => select(item.id)}
                        onKeyDown={(event) => {
                          if (
                            event.key === "ArrowRight" ||
                            event.key === "ArrowLeft"
                          ) {
                            event.preventDefault();
                            const next =
                              (index + (event.key === "ArrowRight" ? 1 : 2)) %
                              3;
                            select(machines[next].id);
                            (
                              event.currentTarget.parentElement?.children[
                                next
                              ] as HTMLElement
                            )?.focus();
                          }
                        }}
                        style={
                          { "--tier-color": accents[item.id] } as CSSProperties
                        }
                      >
                        {selected === item.id && (
                          <span className="selection-arrow" aria-hidden="true">
                            <ArrowDown size={24} strokeWidth={4} />
                          </span>
                        )}
                        <MachineSprite
                          id={item.id}
                          animated={running && selected === item.id}
                        />
                        <span className="machine-shadow" />
                        <span className="scene-machine-label">
                          {item.name.toUpperCase()}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div
                    className="pixel-character"
                    aria-hidden="true"
                    data-ui="A16"
                    data-ui-name="Character"
                  />
                  {running && <ClawSequence id={selected} />}
                  <div className="scene-caption">
                    <span className="scene-caption-key">
                      {running ? "..." : "↵"}
                    </span>
                    {running
                      ? "Finding your next collectible…"
                      : "Choose a machine to take a closer look"}
                  </div>
                </div>
                <div
                  className="machine-tabs"
                  data-ui="A17"
                  data-ui-name="Machine prices"
                  role="group"
                  aria-label="Machine prices"
                >
                  {machines.map((item, index) => (
                    <button
                      key={item.id}
                      disabled={running}
                      onClick={() => select(item.id)}
                      className={`machine-tab ${selected === item.id ? "selected" : ""}`}
                      style={
                        { "--tier-color": accents[item.id] } as CSSProperties
                      }
                    >
                      <span className="tab-index">0{index + 1}</span>
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.id === "common"
                            ? "A little everyday magic"
                            : item.id === "rare"
                              ? "For the treasure hunters"
                              : "The big-dream machine"}
                        </small>
                      </span>
                      <span className="tab-price">
                        {item.price}
                        <small>CR / PULL</small>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <aside
                className={`machine-details ${selected} ${panel ? "details-workspace" : ""}`}
                data-ui="A18"
                data-ui-name="Machine controls"
                style={{ "--tier-color": accents[selected] } as CSSProperties}
                aria-label={
                  panel ? "Arcade details" : `${machine.name} machine details`
                }
              >
                {panel ? (
                  panelContent
                ) : (
                  <>
                    <div className="details-top">
                      <span className="tier-badge">
                        <span />
                        {machine.name.toUpperCase()}
                      </span>
                      <span className="mono muted">
                        MACHINE 0
                        {machines.findIndex((item) => item.id === selected) + 1}
                      </span>
                    </div>
                    <h2>{machine.name} discoveries</h2>
                    <div className="machine-facts">
                      <span>
                        <strong>{machine.prizes.length}</strong> prizes
                      </span>
                      <span>
                        <strong>{selectedMachineStock}</strong> sample prizes
                        left
                      </span>
                    </div>
                    <div className="price-block">
                      <div>
                        <span className="eyebrow">ONE DEMO PULL</span>
                        <div className="price">
                          {machine.price}
                          <span>credits</span>
                        </div>
                      </div>
                      <span className="play-credit-icon">
                        <Coins size={27} />
                      </span>
                    </div>
                    <button
                      className="pull-button"
                      data-ui="A19"
                      data-ui-name="Pull / reveal action"
                      onClick={
                        running
                          ? finishPull
                          : activeState.balance < machine.price ||
                              selectedMachineStock < 1
                            ? () => openPanel("reset")
                            : pull
                      }
                      disabled={!ready || (!running && oddsPaused)}
                    >
                      {running ? (
                        <>
                          Reveal prize <ArrowRight size={19} />
                        </>
                      ) : oddsPaused ? (
                        "MACHINE PAUSED"
                      ) : activeState.balance < machine.price ||
                        selectedMachineStock < 1 ? (
                        <>
                          {selectedMachineStock < 1
                            ? "Reset demo stock"
                            : "Reset demo"}{" "}
                          <RotateCcw size={18} />
                        </>
                      ) : (
                        <>
                          <Gamepad2 size={20} />
                          PULL {machine.name.toUpperCase()}
                          <ArrowRight size={19} />
                        </>
                      )}
                    </button>
                    {running ? (
                      <button
                        className="text-button skip-reveal"
                        onClick={finishPull}
                      >
                        Skip animation <ChevronRight size={14} />
                      </button>
                    ) : oddsPaused ? (
                      <p className="pull-note" role="status">
                        This machine is paused while its demo odds are reviewed.
                      </p>
                    ) : activeState.balance < machine.price ||
                      selectedMachineStock < 1 ? (
                      <button
                        className="text-button skip-reveal"
                        onClick={() => openPanel("reset")}
                      >
                        {selectedMachineStock < 1
                          ? "Reset demo stock"
                          : "Reset your demo balance"}{" "}
                        <RotateCcw size={14} />
                      </button>
                    ) : (
                      <p className="pull-note">
                        <ShieldCheck size={13} />
                        One pull awards one prize: a pack bundle, box, graded
                        card, collection, or mystery.
                      </p>
                    )}
                    <div className="outcome-options">
                      <span>
                        <RotateCcw size={15} />
                        Resell
                      </span>
                      <span>
                        <Package size={15} />
                        Keep
                      </span>
                      <span>
                        <Truck size={15} />
                        Ship
                      </span>
                    </div>
                    <button
                      className="pool-button"
                      data-ui="A20"
                      data-ui-name="Sample stock action"
                      disabled={running}
                      onClick={() => {
                        setShowAllStock(false);
                        openPanel("pool");
                      }}
                    >
                      <Package size={15} /> View sample stock ·{" "}
                      {machine.prizes.length} prizes
                      <ChevronRight size={15} />
                    </button>
                  </>
                )}
              </aside>
            </div>
          </>
        ) : panel ? (
          <div className="collection-workspace">{panelContent}</div>
        ) : (
          <PlayerInventory
            state={activeState}
            setState={setState}
            demoDay={demoDay}
            onBack={() => setView("arcade")}
          />
        )}

        <footer className="site-footer">
          <div className="footer-brand">
            <Gamepad2 size={18} />
            <span>GOOD FINDS. GOOD TIMES.</span>
          </div>
          <div>
            <span>Made for collectors.</span>
            <span className="footer-dot">·</span>
            <button onClick={() => openPanel("how")}>How it works</button>
            <a href="/admin">Admin</a>
            <span className="version">{APP_VERSION} beta</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
