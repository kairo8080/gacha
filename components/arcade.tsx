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
  HelpCircle,
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
  drawPrizeIndex,
  initialState,
  LEGACY_STORAGE_KEY,
  machineStock,
  machines,
  parseSavedState,
  remainingStock,
  resaleValue,
  stockCatalog,
  STORAGE_KEY,
  type InventoryItem,
  type MachineId,
  type Prize,
} from "@/lib/demo";
import { APP_VERSION } from "@/lib/version";

const credits = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
const accents: Record<MachineId, string> = {
  common: "#40c7f4",
  rare: "#c073f5",
  epic: "#ffd34d",
};
type Modal = "how" | "wallet" | "result" | "reset" | "shipping" | "pool" | null;

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

function PrizeSymbol({ prize }: { prize: Prize }) {
  return (
    <div className={`prize-symbol ${prize.kind}`} aria-hidden="true">
      {prize.kind === "graded" ? <ShieldCheck /> : <Package />}
      <span>{prize.kind === "graded" ? "GRADED" : "SEALED"}</span>
      <small className="prize-set-badge">{prize.name}</small>
    </div>
  );
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
    <div className="claw-closeup" role="status">
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

function Dialog({
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
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label={title}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <button
        className="icon-button dialog-close"
        aria-label="Close dialog"
        onClick={onClose}
      >
        <X size={20} />
      </button>
      {children}
    </dialog>
  );
}

export default function Arcade() {
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<MachineId>("common");
  const [view, setView] = useState<"arcade" | "inventory">("arcade");
  const [filter, setFilter] = useState<"held" | "history">("held");
  const [modal, setModal] = useState<Modal>(null);
  const [sound, setSound] = useState(false);
  const [running, setRunning] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const [shippingId, setShippingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);
  const [legacySessionNotice, setLegacySessionNotice] = useState(false);
  const [showAllStock, setShowAllStock] = useState(false);
  const pullLock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const machine = machines.find((item) => item.id === selected)!;

  // Restore via a dedicated action wrapper, keeping the pure reducer unaware of the browser.
  const [savedState, setSavedState] = useState<typeof initialState | null>(
    null,
  );
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      setSavedState(parseSavedState(saved));
      setLegacySessionNotice(
        saved === null && localStorage.getItem(LEGACY_STORAGE_KEY) !== null,
      );
    } catch {
      setStorageWarning(true);
      setSavedState(initialState);
    }
    setReady(true);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  // The persisted demo session is the starting point for all subsequent actions.
  const activeState = savedState ?? initialState;
  const activeHeld = activeState.items.filter((item) => item.status === "held");
  const activeResult = activeState.items.find((item) => item.id === resultId);
  const activeShipping = activeState.items.find(
    (item) => item.id === shippingId,
  );
  const selectedMachineStock = machineStock(activeState, selected);
  const totalRemainingStock = stockCatalog.reduce(
    (total, prize) => total + remainingStock(activeState, prize.id),
    0,
  );
  function act(action: Parameters<typeof demoReducer>[1]) {
    setSavedState((current) => demoReducer(current ?? initialState, action));
  }
  useEffect(() => {
    if (!ready || savedState === null) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));
    } catch {
      setStorageWarning(true);
    }
  }, [savedState, ready]);

  function notify(message: string) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 4500);
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
    setModal("result");
  }
  function pull() {
    if (
      !ready ||
      pullLock.current ||
      activeState.balance < machine.price ||
      selectedMachineStock < 1
    )
      return;
    pullLock.current = true;
    const itemId = crypto.randomUUID();
    const limit =
      Math.floor(2 ** 32 / selectedMachineStock) * selectedMachineStock;
    let random = crypto.getRandomValues(new Uint32Array(1))[0];
    while (random >= limit)
      random = crypto.getRandomValues(new Uint32Array(1))[0];
    const prizeIndex = drawPrizeIndex(
      activeState,
      selected,
      random % selectedMachineStock,
    );
    if (prizeIndex < 0) {
      pullLock.current = false;
      notify(
        "That machine is sold out in this local demo. Reset demo to play again.",
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
    setSavedState(nextState);
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
    setModal(null);
    notify(`Resold for ${credits(resaleValue(item.prize))} demo credits.`);
  }
  function select(id: MachineId) {
    if (!running) setSelected(id);
  }
  function openInventory() {
    if (!running) {
      setView("inventory");
      setModal(null);
    }
  }
  const displayedItems = activeState.items
    .filter((item) =>
      filter === "held" ? item.status === "held" : item.status !== "held",
    )
    .slice()
    .reverse();

  return (
    <div
      className={`app-shell ${view === "arcade" ? "arcade-view" : "inventory-view"}`}
    >
      <a className="skip-link" href="#main">
        Skip to arcade
      </a>
      <header className="site-header">
        <button
          className="brand"
          onClick={() => {
            if (!running) setView("arcade");
          }}
          aria-label="Gacha Arcade home"
        >
          <span className="brand-icon">
            <Gamepad2 size={27} strokeWidth={2.1} />
          </span>
          <span>
            GACHA<span className="brand-sub">ARCADE</span>
          </span>
          <span className="release-version" aria-label={`Version ${APP_VERSION}`}>
            {APP_VERSION}
          </span>
        </button>
        <nav aria-label="Main navigation">
          <button
            disabled={running}
            className={view === "arcade" ? "nav-link active" : "nav-link"}
            onClick={() => setView("arcade")}
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
          <button className="nav-link help-nav" onClick={() => setModal("how")}>
            How to play
            <ArrowUpRight size={14} />
          </button>
        </nav>
        <button className="wallet-button" onClick={() => setModal("wallet")}>
          <Wallet size={17} />
          <span>Demo wallet</span>
          <span className="wallet-amount">
            {credits(activeState.balance)}
            <span className="tiny"> CR</span>
          </span>
        </button>
      </header>

      <div className="demo-banner">
        <span>
          <span className="demo-label">FREE PLAY</span>
          <span className="demo-copy">
            This is a demo. Sample prizes, play credits, zero real transactions.
          </span>
          <span className="demo-copy-compact">
            DEMO · Play credits. Sample prizes.
          </span>
        </span>
        <button
          onClick={() => setModal("reset")}
          aria-label="Reset demo session"
        >
          <RotateCcw size={13} />
          <span>Reset demo</span>
        </button>
      </div>

      <main id="main" className="main-content">
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span className="pixel-square" />
              THE LORCANA ROOM <span className="eyebrow-divider">/</span>{" "}
              {view === "arcade" ? "SELECT A MACHINE" : "YOUR COLLECTION"}
            </div>
            <h1>
              {view === "arcade" ? (
                <>
                  A little luck. <span>A great find.</span>
                </>
              ) : (
                <>
                  Your next favorites.<span> All in one place.</span>
                </>
              )}
            </h1>
            <p>
              {view === "arcade"
                ? "Three machines. A world of collectibles. Which one calls to you?"
                : "Keep your pulls, try a resale, or preview a shipping request."}
            </p>
          </div>
          <div className="edition">
            <span>{APP_VERSION}</span>
            <span>BETA EDITION</span>
          </div>
        </div>

        {view === "arcade" ? (
          <>
            <div className="arcade-layout">
              <section className="arcade-panel" aria-label="Machine selection">
                <div className="panel-toolbar">
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
                <div className={`arcade-scene ${running ? "is-running" : ""}`}>
                  <div className="scene-sign">
                    <span>✦</span> SELECT YOUR MACHINE <span>✦</span>
                  </div>
                  <div className="rear-machines" aria-hidden="true" />
                  <div className="gray-machine gray-left" aria-hidden="true" />
                  <div className="gray-machine gray-right" aria-hidden="true" />
                  <div
                    className="scene-machines"
                    role="group"
                    aria-label="Choose machine tier"
                  >
                    {machines.map((item, index) => (
                      <button
                        key={item.id}
                        className={`scene-machine ${item.id === selected ? "selected" : ""} ${item.id}`}
                        disabled={running}
                        aria-label={`Select ${item.name} machine`}
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
                  <div className="pixel-character" aria-hidden="true" />
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
                className={`machine-details ${selected}`}
                style={{ "--tier-color": accents[selected] } as CSSProperties}
                aria-label={`${machine.name} machine details`}
              >
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
                <h2>
                  {machine.name} discoveries<span>Start your next story.</span>
                </h2>
                <p className="details-description">{machine.description}</p>
                <div className="machine-specs">
                  <div>
                    <span>Inside this machine</span>
                    <strong>
                      {machine.prizes.length} Lorcana sets · Sample stock
                    </strong>
                  </div>
                  <div>
                    <span>Prize selection</span>
                    <strong>
                      {machine.prizes.length} sets · current demo odds
                      <HelpCircle size={13} />
                    </strong>
                  </div>
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
                  onClick={
                    running
                      ? finishPull
                      : activeState.balance < machine.price ||
                          selectedMachineStock < 1
                        ? () => setModal("reset")
                        : pull
                  }
                  disabled={!ready}
                >
                  {running ? (
                    <>
                      Reveal prize <ArrowRight size={19} />
                    </>
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
                ) : activeState.balance < machine.price ||
                  selectedMachineStock < 1 ? (
                  <button
                    className="text-button skip-reveal"
                    onClick={() => setModal("reset")}
                  >
                    {selectedMachineStock < 1
                      ? "Reset demo stock"
                      : "Reset your demo balance"}{" "}
                    <RotateCcw size={14} />
                  </button>
                ) : (
                  <p className="pull-note">
                    <ShieldCheck size={13} />
                    One pull awards one sealed Lorcana booster pack.
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
                  onClick={() => {
                    setShowAllStock(false);
                    setModal("pool");
                  }}
                >
                  <Package size={15} /> View sample stock ·{" "}
                  {machine.prizes.length} sets
                  <ChevronRight size={15} />
                </button>
              </aside>
            </div>
          </>
        ) : (
          <section className="inventory-section">
            <div className="inventory-toolbar">
              <div className="inventory-tabs">
                <button
                  className={filter === "held" ? "active" : ""}
                  onClick={() => setFilter("held")}
                >
                  In inventory <span>{activeHeld.length}</span>
                </button>
                <button
                  className={filter === "history" ? "active" : ""}
                  onClick={() => setFilter("history")}
                >
                  History{" "}
                  <span>{activeState.items.length - activeHeld.length}</span>
                </button>
              </div>
              <span className="mono muted">
                {activeState.pulls} DEMO PULL
                {activeState.pulls === 1 ? "" : "S"}
              </span>
            </div>
            {displayedItems.length === 0 ? (
              <div className="empty-inventory">
                <div className="empty-sprite">
                  <MachineSprite id="common" />
                </div>
                <span className="eyebrow">
                  {filter === "held"
                    ? "YOUR COLLECTION STARTS HERE"
                    : "ALL QUIET HERE"}
                </span>
                <h2>
                  {filter === "held"
                    ? "A little room for something great."
                    : "Your next chapter is unwritten."}
                </h2>
                <p>
                  {filter === "held"
                    ? "Try a machine. Your demo prizes will be waiting here."
                    : "Resold items and shipping previews appear here."}
                </p>
                <button
                  className="primary-button"
                  onClick={() => setView("arcade")}
                >
                  Explore the arcade <ArrowRight size={17} />
                </button>
              </div>
            ) : (
              <div className="inventory-grid">
                {displayedItems.map((item) => (
                  <article
                    className="inventory-card"
                    key={item.id}
                    style={
                      {
                        "--tier-color": accents[item.machineId],
                      } as CSSProperties
                    }
                  >
                    <div className="inventory-card-top">
                      <span className="tier-badge">
                        {item.machineId.toUpperCase()}
                      </span>
                      <span className={`item-status ${item.status}`}>
                        {item.status === "held"
                          ? "IN INVENTORY"
                          : item.status === "sold"
                            ? "RESOLD · DEMO"
                            : "SHIPPING · DEMO"}
                      </span>
                    </div>
                    <PrizeSymbol prize={item.prize} />
                    <h3>{item.prize.name}</h3>
                    <p>{item.prize.detail}</p>
                    <div className="inventory-value">
                      <span>Demo value</span>
                      <strong>{credits(item.prize.value)} CR</strong>
                    </div>
                    {item.status === "held" ? (
                      <div className="inventory-actions">
                        <button
                          onClick={() => {
                            setResultId(item.id);
                            setModal("result");
                          }}
                        >
                          <RotateCcw size={15} />
                          Resell
                        </button>
                        <button
                          onClick={() => {
                            setShippingId(item.id);
                            setModal("shipping");
                          }}
                        >
                          <Truck size={15} />
                          Ship
                        </button>
                      </div>
                    ) : (
                      <div className="completed-action">
                        <Check size={15} />
                        {item.status === "sold"
                          ? `${credits(resaleValue(item.prize))} demo credits returned`
                          : "Preview request saved. No shipment created."}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        <footer className="site-footer">
          <div className="footer-brand">
            <Gamepad2 size={18} />
            <span>GOOD FINDS. GOOD TIMES.</span>
          </div>
          <div>
            <span>Made for collectors.</span>
            <span className="footer-dot">·</span>
            <button onClick={() => setModal("how")}>How it works</button>
            <span className="version">{APP_VERSION} beta</span>
          </div>
        </footer>
      </main>

      {storageWarning && (
        <div className="storage-warning" role="status">
          Browser storage is unavailable. This demo session may not survive a
          refresh.
        </div>
      )}
      {legacySessionNotice && (
        <div className="storage-warning legacy-session-notice" role="status">
          <span>
            Your previous demo is saved separately. This is a fresh sample-stock
            simulation.
          </span>
          <button
            className="icon-button"
            aria-label="Dismiss session notice"
            onClick={() => setLegacySessionNotice(false)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div
        className={`toast ${notice ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {notice && (
          <>
            <Check size={17} />
            {notice}
          </>
        )}
      </div>

      <Dialog
        open={modal !== null}
        onClose={() => setModal(null)}
        title={
          modal === "result"
            ? "Your demo prize"
            : modal === "shipping"
              ? "Preview shipping request"
              : modal === "reset"
                ? "Reset demo"
                : modal === "wallet"
                  ? "Demo wallet"
                  : modal === "pool"
                    ? `${machine.name} sample stock`
                    : "How to play"
        }
      >
        {modal === "pool" && (
          <>
            <span className="eyebrow">
              SAMPLE STOCK · ILLUSTRATIVE GAME CONFIG
            </span>
            <h2>
              {showAllStock
                ? "All sample stock"
                : `${machine.name} machine pool`}
            </h2>
            <p className="dialog-note pool-stock-intro">
              100 fictional packs per set. Demo quantities do not reflect
              warehouse stock.
            </p>
            <div className="pool-summary">
              <span>
                {showAllStock ? totalRemainingStock : selectedMachineStock} sample
                {" "}packs remaining
              </span>
              <span>
                fictional game config
              </span>
            </div>
            <button
              className="text-button full-width pool-toggle"
              onClick={() => setShowAllStock((current) => !current)}
            >
              {showAllStock
                ? `View ${machine.name} pool`
                : `View all sample stock · ${stockCatalog.length} sets`}
              <ChevronRight size={15} />
            </button>
            <div className="pool-dialog-list">
              {(showAllStock ? stockCatalog : machine.prizes).map(
                (prize, index) => {
                  const prizeMachine = prize.machineId ?? selected;
                  const remaining = remainingStock(activeState, prize.id);
                  const machineTotal = machineStock(activeState, prizeMachine);
                  return (
                    <article
                      className="pool-dialog-item"
                      key={prize.id}
                      style={
                        {
                          "--tier-color": accents[prizeMachine],
                        } as CSSProperties
                      }
                    >
                      {!showAllStock && (
                        <span className="prize-number">0{index + 1}</span>
                      )}
                      <PrizeSymbol prize={prize} />
                      <div>
                        <span className="prize-type">
                          <span
                            className={`machine-mini-badge ${prizeMachine}`}
                          >
                            {prizeMachine}
                          </span>{" "}
                          SEALED PACK
                        </span>
                        <h3>{prize.name}</h3>
                        <p>{prize.detail}</p>
                        <strong>
                          {credits(prize.value)} CR <span>demo value</span>
                        </strong>
                        <p className="stock-line">
                          Sample stock: {remaining} / {prize.startingQuantity} packs
                          {!showAllStock && machineTotal > 0
                            ? ` · ${((remaining / machineTotal) * 100).toFixed(1)}% current odds`
                            : ""}
                        </p>
                      </div>
                    </article>
                  );
                },
              )}
            </div>
            <p className="dialog-note">
              One sealed pack per pull. Each remaining pack has the same chance
              in its machine; the shown percentages are rounded. Tiers and
              credit values are provisional. Demo resale returns the pack to its
              sample pool.
            </p>

            <button
              className="primary-button full-width"
              onClick={() => setModal(null)}
            >
              Back to {machine.name} <ArrowRight size={17} />
            </button>
          </>
        )}
        {modal === "how" && (
          <>
            <span className="eyebrow">WELCOME TO GACHA ARCADE</span>
            <h2>
              One pull.
              <br />
              Three possibilities.
            </h2>
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
                    Spend play credits and reveal one sealed Lorcana booster
                    pack. You start with 250 credits.
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
            <p className="dialog-note">
              This local, per-browser demo uses fictional sample stock only. No
              physical inventory is reserved. No purchases, wallet signatures,
              payouts, or shipments occur. The demo resale rate is 80% of demo
              item value.
            </p>
            <button
              className="primary-button full-width"
              onClick={() => setModal(null)}
            >
              Let’s play <ArrowRight size={17} />
            </button>
          </>
        )}
        {modal === "wallet" && (
          <>
            <span className="dialog-icon">
              <Wallet size={30} />
            </span>
            <span className="eyebrow">FREE PLAY WALLET</span>
            <h2>A little pocket magic.</h2>
            <div className="wallet-total">
              {credits(activeState.balance)}
              <span>demo credits</span>
            </div>
            <p>
              Your demo credits are saved in this browser. They have no monetary
              value and cannot be withdrawn.
            </p>
            <div className="dialog-note">
              Crypto payments will be connected after the network, token, and
              machine prices are confirmed.
            </div>
            <button
              className="primary-button full-width"
              onClick={() => setModal(null)}
            >
              Back to the arcade <ArrowRight size={17} />
            </button>
          </>
        )}
        {modal === "result" && activeResult && (
          <>
            <span className="eyebrow">
              {activeResult.status === "held"
                ? "A NEW FIND FOR YOUR COLLECTION"
                : "YOUR DEMO PRIZE"}
            </span>
            <h2>
              {activeResult.status === "held"
                ? "Look what you found."
                : "This one is settled."}
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
                    setModal(null);
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
                      setShippingId(activeResult.id);
                      setModal("shipping");
                    }}
                  >
                    <Truck size={17} />
                    <span>Preview shipping</span>
                  </button>
                </div>
                <p className="dialog-note">
                  Demo resale: 80% of sample item value, returned as play
                  credits. Your prize is already saved if you close this window.
                </p>
              </>
            ) : (
              <p className="dialog-note">
                {activeResult.status === "sold"
                  ? "This demo item has been resold."
                  : "This item has a demo shipping request."}
              </p>
            )}
          </>
        )}
        {modal === "shipping" && activeShipping && (
          <>
            <span className="dialog-icon">
              <Truck size={30} />
            </span>
            <span className="eyebrow">SHIPPING PREVIEW</span>
            <h2>
              From your vault
              <br />
              to your doorstep.
            </h2>
            <p>
              <strong>{activeShipping.prize.name}</strong>
            </p>
            <p>
              For the live beta, physical items will ship from Portugal.
              Destinations, shipping rates, and address collection are still to
              be configured.
            </p>
            <div className="dialog-note">
              This demo marks the item as requested for shipping and removes
              resale access. No address is collected and no real shipment is
              created.
            </div>
            <button
              className="primary-button full-width"
              disabled={activeShipping.status !== "held"}
              onClick={() => {
                act({ type: "ship", itemId: activeShipping.id });
                setModal(null);
                notify(
                  "Demo shipping request saved. No real shipment created.",
                );
              }}
            >
              Save demo shipping request <ArrowRight size={17} />
            </button>
          </>
        )}
        {modal === "reset" && (
          <>
            <span className="dialog-icon">
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
                setModal(null);
                setResultId(null);
                notify("Fresh start. 250 demo credits are ready.");
              }}
            >
              Reset demo session <RotateCcw size={17} />
            </button>
            <button
              className="text-button full-width cancel-button"
              onClick={() => setModal(null)}
            >
              Keep my session
            </button>
          </>
        )}
      </Dialog>
    </div>
  );
}
