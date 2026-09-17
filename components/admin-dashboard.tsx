"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import {
  ArrowRight,
  Gamepad2,
  Package,
  ShieldCheck,
  Truck,
} from "@/components/pixel-icons";
import { useDemoSession } from "@/hooks/use-demo-session";
import { useDemoPresence } from "@/hooks/use-demo-presence";
import {
  demoReducer,
  machines,
  remainingStock,
  stockCatalog,
  SHIPPING_UNLOCK_DAY,
} from "@/lib/demo";
import { getDemoMetrics, getShippingStage } from "@/lib/operations";
import { APP_VERSION } from "@/lib/version";

type Session = { authenticated: boolean; configured: boolean };
type WarehouseRow = { id: string; name: string; packs: number; boxes: number };
type Section = "overview" | "physical" | "ghost" | "shipping";
const fmt = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
const colors = { common: "#40c7f4", rare: "#c073f5", epic: "#ffd34d" };
const sections: { id: Section; name: string }[] = [
  { id: "overview", name: "Overview" },
  { id: "physical", name: "Physical stock" },
  { id: "ghost", name: "Ghost stock" },
  { id: "shipping", name: "Ship queue" },
];

export default function AdminDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [section, setSection] = useState<Section>("overview");
  const [warehouse, setWarehouse] = useState<WarehouseRow[]>([]);
  const [warehouseState, setWarehouseState] = useState<
    "loading" | "available" | "local" | "error"
  >("loading");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const { state, setState, ready, storageWarning, demoDay, setDemoDay } =
    useDemoSession();
  const online = useDemoPresence();
  const metrics = getDemoMetrics(state);
  const shippingOpen = demoDay >= SHIPPING_UNLOCK_DAY;
  const requests = state.items
    .filter((item) => item.status === "queued" || item.status === "shipping")
    .slice()
    .reverse();

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      try {
        const response = await fetch("/api/admin/session", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Session unavailable");
        const next: Session = await response.json();
        if (cancelled) return;
        setSession(next);
        if (!next.authenticated) setWarehouse([]);
      } catch {
        if (!cancelled) {
          setSession(null);
          setWarehouse([]);
          setError("Connection lost. Refresh to reconnect.");
        }
      }
    }
    void checkSession();
    const timer = setInterval(checkSession, 60_000);
    window.addEventListener("focus", checkSession);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", checkSession);
    };
  }, []);

  useEffect(() => {
    if (!session?.authenticated) return;
    let cancelled = false;
    setWarehouseState("loading");
    fetch("/api/admin/inventory", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          if (!cancelled) {
            setSession({ authenticated: false, configured: true });
            setWarehouse([]);
          }
          return;
        }
        if (!response.ok) throw new Error("Inventory unavailable");
        const data: { available: boolean; rows: WarehouseRow[] } =
          await response.json();
        if (!cancelled) {
          setWarehouse(data.available ? data.rows : []);
          setWarehouseState(data.available ? "available" : "local");
        }
      })
      .catch(() => {
        if (!cancelled) setWarehouseState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [session?.authenticated]);

  async function login(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? "Too many attempts. Try again in 5 minutes."
            : response.status === 503
              ? "Admin access needs setup on this deployment."
              : "Wrong password. Try again.",
        );
        return;
      }
      setSession(await response.json());
      setPassword("");
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Logout failed");
      setSession({ authenticated: false, configured: true });
      setWarehouse([]);
      setPassword("");
      setError("");
    } catch {
      setError("Could not sign out. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!session?.authenticated)
    return (
      <main className="admin-login admin-ui">
        <a className="admin-back" href="/">
          ← BACK TO ARCADE
        </a>
        <section className="admin-login-card">
          <div className="admin-lock">
            <ShieldCheck size={36} />
          </div>
          <span className="admin-kicker">GACHA ARCADE · {APP_VERSION}</span>
          <h1>
            CONTROL
            <br />
            ROOM
          </h1>
          <p className="admin-subtitle">PRIVATE ACCESS</p>
          <form onSubmit={login}>
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              maxLength={256}
              disabled={busy || session?.configured === false}
            />
            {error && (
              <p className="admin-error" role="alert">
                {error}
              </p>
            )}
            {session?.configured === false && (
              <p className="admin-error">
                Admin access needs setup on this deployment.
              </p>
            )}
            <button
              className="admin-primary"
              disabled={busy || !session?.configured || !password}
            >
              {busy
                ? "UNLOCKING…"
                : session === null
                  ? "CONNECTING…"
                  : "ENTER DASHBOARD"}
              <ArrowRight size={20} />
            </button>
          </form>
          <span className="admin-login-footer">
            STAFF ONLY · BETA SIMULATION
          </span>
        </section>
      </main>
    );

  const stockLeft = stockCatalog.reduce(
    (total, prize) => total + remainingStock(state, prize.id),
    0,
  );
  const matchingStock = stockCatalog.filter((prize) =>
    prize.name.toLowerCase().includes(query.toLowerCase()),
  );
  const matchingWarehouse = warehouse.filter((row) =>
    row.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="admin-ui admin-shell">
      <header className="admin-header">
        <a className="admin-brand" href="/">
          <span className="admin-logo">
            <Gamepad2 size={27} />
          </span>
          <span>
            GACHA<span>CONTROL ROOM</span>
          </span>
          <small>{APP_VERSION}</small>
        </a>
        <div className="admin-header-actions">
          <a href="/">
            PLAY ARCADE <ArrowRight size={16} />
          </a>
          <button onClick={logout} disabled={busy}>
            SIGN OUT
          </button>
        </div>
      </header>
      <div className="admin-mode">
        <span className="admin-dot" /> LOCAL SIMULATION{" "}
        <span>THIS BROWSER · PLAY CREDITS</span>
      </div>
      <main className="admin-main">
        <div className="admin-heading">
          <div>
            <span className="admin-kicker">PLAYER ONE / ADMIN</span>
            <h1>THE CONTROL ROOM.</h1>
          </div>
          <span className="admin-live">
            <span className="admin-dot" />{" "}
            {ready ? "SESSION SYNCED" : "LOADING…"}
          </span>
        </div>
        <nav className="admin-nav" aria-label="Admin sections">
          {sections.map((tab) => (
            <button
              key={tab.id}
              className={section === tab.id ? "active" : ""}
              aria-current={section === tab.id ? "page" : undefined}
              onClick={() => {
                setSection(tab.id);
                setQuery("");
              }}
            >
              {tab.name}
              {tab.id === "shipping" && (
                <span>
                  {requests.filter((item) => item.status === "queued").length}
                </span>
              )}
            </button>
          ))}
        </nav>
        {(error || storageWarning) && (
          <p className="admin-error" role="alert">
            {error || "Browser storage unavailable. Changes may not be saved."}
          </p>
        )}
        {notice && (
          <p className="admin-notice" role="status">
            {notice}
            <button onClick={() => setNotice("")} aria-label="Dismiss notice">
              ×
            </button>
          </p>
        )}

        {section === "overview" && (
          <>
            <section className="admin-metrics" aria-label="Session statistics">
              <Metric
                label="ONLINE NOW"
                value={online}
                note="This browser only"
                accent="mint"
              />
              <Metric
                label="PLAYERS"
                value={metrics.usersPlayed}
                note="Played this session"
              />
              <Metric
                label="TOTAL PULLS"
                value={metrics.totalPulls}
                note="Across all machines"
                accent="blue"
              />
              <Metric
                label="REVENUE"
                value={fmt(metrics.revenue)}
                unit="CR"
                note="Demo pull spend"
                accent="gold"
              />
              <Metric label="PROFIT" value="—" note="Costs not set" />
              <Metric
                label="SELL BACKS"
                value={metrics.sellBacks}
                note={`${fmt(metrics.sellBackCredits)} CR returned`}
              />
              <Metric
                label="REDEEMED"
                value={metrics.redemptions}
                note="Includes queued items"
              />
              <Metric
                label="SHIP REQUESTS"
                value={metrics.shippingRequests}
                note={`${requests.filter((item) => item.status === "queued").length} waiting`}
                accent="purple"
              />
            </section>
            <div className="admin-overview-grid">
              <section className="admin-panel">
                <div className="admin-panel-title">
                  <h2>MACHINE PULLS</h2>
                  <span>{metrics.totalPulls} TOTAL</span>
                </div>
                <div className="admin-machine-list">
                  {machines.map((machine) => (
                    <div
                      className="admin-machine-row"
                      key={machine.id}
                      style={
                        {
                          "--machine-color": colors[machine.id],
                        } as CSSProperties
                      }
                    >
                      <span
                        className={`admin-machine-icon ${machine.id}`}
                        aria-hidden="true"
                      />
                      <div>
                        <div className="admin-machine-label">
                          <strong>{machine.name}</strong>
                          <span>
                            {metrics.pullsByMachine[machine.id]}{" "}
                            <small>PULLS</small>
                          </span>
                        </div>
                        <div className="admin-bar">
                          <span
                            style={{
                              width: `${metrics.totalPulls ? (metrics.pullsByMachine[machine.id] / metrics.totalPulls) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="admin-panel admin-stock-summary">
                <div className="admin-panel-title">
                  <h2>STOCK CHECK</h2>
                  <Package size={20} />
                </div>
                <button onClick={() => setSection("physical")}>
                  <span>
                    PHYSICAL STOCK
                    <small>
                      {warehouseState === "available"
                        ? "Local owner reference"
                        : "Private · local access"}
                    </small>
                  </span>
                  <strong>
                    {warehouseState === "available"
                      ? fmt(warehouse.reduce((sum, row) => sum + row.packs, 0))
                      : "—"}
                    <ArrowRight size={18} />
                  </strong>
                </button>
                <button onClick={() => setSection("ghost")}>
                  <span>
                    GHOST STOCK<small>Fictional packs available</small>
                  </span>
                  <strong>
                    {fmt(stockLeft)}
                    <ArrowRight size={18} />
                  </strong>
                </button>
                <p>Demo pulls never reduce physical stock.</p>
              </section>
            </div>
            <section className="admin-shipping-strip">
              <Truck size={28} />
              <div>
                <strong>
                  {shippingOpen
                    ? "SHIPPING PREVIEW OPEN"
                    : "QUEUE NOW. SHIP FROM DAY 60."}
                </strong>
                <span>
                  {requests.filter((item) => item.status === "queued").length}{" "}
                  waiting · Demo day {demoDay}
                </span>
              </div>
              <button
                className="admin-secondary"
                onClick={() => setSection("shipping")}
              >
                VIEW QUEUE <ArrowRight size={17} />
              </button>
            </section>
          </>
        )}

        {(section === "physical" || section === "ghost") && (
          <section className="admin-panel admin-stock-panel">
            <div className="admin-panel-title">
              <div>
                <h2>
                  {section === "physical"
                    ? "PHYSICAL INVENTORY"
                    : "GHOST INVENTORY"}
                </h2>
                <p>
                  {section === "physical"
                    ? "Local owner reference · counts unverified"
                    : "Fictional stock · this browser’s pulls"}
                </p>
              </div>
              <label className="admin-search">
                <span className="sr-only">Search stock</span>
                <input
                  type="search"
                  placeholder="Find a set…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            {section === "physical" && warehouseState !== "available" ? (
              <div className="admin-empty">
                <ShieldCheck size={40} />
                <h3>
                  {warehouseState === "loading"
                    ? "LOADING STOCK…"
                    : warehouseState === "error"
                      ? "STOCK UNAVAILABLE"
                      : "LOCAL ACCESS ONLY"}
                </h3>
                <p>
                  {warehouseState === "error"
                    ? "Reload to retry."
                    : "Exact warehouse counts stay on your device."}
                </p>
              </div>
            ) : (
              <>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>SET</th>
                        {section === "physical" ? (
                          <>
                            <th>PACKS</th>
                            <th>BOXES</th>
                          </>
                        ) : (
                          <>
                            <th>MACHINE</th>
                            <th>AVAILABLE</th>
                            <th>RESERVED</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {section === "physical"
                        ? matchingWarehouse.map((row) => (
                            <tr key={row.id}>
                              <th scope="row">{row.name}</th>
                              <td>{fmt(row.packs)}</td>
                              <td>{fmt(row.boxes)}</td>
                            </tr>
                          ))
                        : matchingStock.map((prize) => (
                            <tr key={prize.id}>
                              <th scope="row">{prize.name}</th>
                              <td>
                                <span
                                  className={`admin-tier ${prize.machineId}`}
                                >
                                  {prize.machineId}
                                </span>
                              </td>
                              <td>
                                {remainingStock(state, prize.id)}{" "}
                                <small>/ {prize.startingQuantity}</small>
                              </td>
                              <td>
                                {prize.startingQuantity -
                                  remainingStock(state, prize.id)}
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
                {(section === "physical"
                  ? matchingWarehouse.length
                  : matchingStock.length) === 0 && (
                  <p className="admin-empty-result">No matching sets.</p>
                )}
                <div className="admin-table-footer">
                  {section === "physical"
                    ? `${warehouse.length} SETS · BOXES AND PACKS ARE SEPARATE REPORTED COUNTS`
                    : "14 SETS · SELL BACKS RETURN PACKS TO THE GHOST POOL"}
                </div>
              </>
            )}
          </section>
        )}

        {section === "shipping" && (
          <>
            <section className="admin-launch-panel">
              <div>
                <span className="admin-kicker">SHIPPING GATE</span>
                <h2>
                  {shippingOpen
                    ? "READY TO SHIP."
                    : `${SHIPPING_UNLOCK_DAY - demoDay} DAYS TO GO.`}
                </h2>
                <p>Opens 60 days after launch. Queue stays open.</p>
                <small>Demo clock only · launch date not set</small>
              </div>
              <div className="admin-clock">
                <label htmlFor="demo-day">
                  PREVIEW LAUNCH DAY <strong>{demoDay}</strong>
                </label>
                <input
                  id="demo-day"
                  type="range"
                  min="0"
                  max="90"
                  step="1"
                  value={Math.min(demoDay, 90)}
                  onChange={(event) => setDemoDay(Number(event.target.value))}
                />
                <div>
                  <button onClick={() => setDemoDay(0)}>DAY 0</button>
                  <button onClick={() => setDemoDay(60)}>DAY 60</button>
                  <span>{shippingOpen ? "OPEN · DEMO" : "LOCKED"}</span>
                </div>
              </div>
            </section>
            <section className="admin-panel">
              <div className="admin-panel-title">
                <h2>SHIPPING REQUESTS</h2>
                <span>{requests.length} REQUESTS</span>
              </div>
              {requests.length === 0 ? (
                <div className="admin-empty">
                  <Truck size={40} />
                  <h3>QUEUE IS CLEAR.</h3>
                  <p>Redeem a prize and queue it from your collection.</p>
                  <a className="admin-secondary" href="/">
                    OPEN ARCADE <ArrowRight size={17} />
                  </a>
                </div>
              ) : (
                <div className="admin-request-list">
                  {requests.map((item) => (
                    <article key={item.id} className="admin-request">
                      <div>
                        <span className={`admin-tier ${item.machineId}`}>
                          {item.machineId}
                        </span>
                        <h3>{item.prize.name}</h3>
                        <small>
                          #{item.id.slice(0, 8)} ·{" "}
                          {new Date(item.createdAt).toLocaleDateString("en-GB")}
                        </small>
                      </div>
                      <span className={`admin-request-status ${item.status}`}>
                        {getShippingStage(item, demoDay) === "ready"
                          ? "READY TO SHIP"
                          : item.status === "shipping"
                            ? "SHIPPING · DEMO"
                            : "QUEUED"}
                      </span>
                      <button
                        className="admin-secondary"
                        disabled={
                          !ready || !shippingOpen || item.status !== "queued"
                        }
                        onClick={() => {
                          setState((current) =>
                            demoReducer(current, {
                              type: "ship",
                              itemId: item.id,
                              demoDay,
                            }),
                          );
                          setNotice(
                            "Marked shipping in this demo. No parcel was sent.",
                          );
                        }}
                      >
                        {item.status === "shipping"
                          ? "IN PROGRESS"
                          : shippingOpen
                            ? "SIMULATE SHIP"
                            : "OPENS DAY 60"}
                        <Truck size={17} />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
        <footer className="admin-footer">
          <span>
            <ShieldCheck size={15} /> PRIVATE ACCESS
          </span>
          <span>{APP_VERSION} · BETA SIMULATION</span>
          <a href="/">BACK TO THE ARCADE</a>
        </footer>
      </main>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  unit,
  accent = "",
}: {
  label: string;
  value: string | number;
  note: string;
  unit?: string;
  accent?: string;
}) {
  return (
    <article className={`admin-metric ${accent}`}>
      <h2>{label}</h2>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
      <p>{note}</p>
    </article>
  );
}
