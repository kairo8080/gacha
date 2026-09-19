"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import EngineDashboard from "@/components/engine-dashboard";
import { APP_VERSION } from "@/lib/version";
import type { MachineId } from "@/lib/demo";
import {
  advanceEngine,
  createDefaultEngineConfig,
  createDefaultEngineItems,
  createEngine,
  summarizeEngine,
  type EngineState,
} from "@/lib/engine";

type Session = { authenticated: boolean; configured: boolean };
type Mode = "idle" | "running" | "paused" | "instant";

/** Runs are isolated in memory: no arcade session, catalog, or warehouse writes. */
function Simulation({ onLogout }: { onLogout: () => void }) {
  const [config, setConfig] = useState(() => createDefaultEngineConfig());
  const [items, setItems] = useState(() => createDefaultEngineItems("common"));
  const [run, setRun] = useState<EngineState | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState("");
  const current = useRef<EngineState | null>(null);

  useEffect(() => {
    if (mode !== "running" && mode !== "instant") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let previous = performance.now();
    let pending = 0;
    const step = () => {
      if (cancelled || !current.current) return;
      const before = current.current;
      const now = performance.now();
      // 1× means every configured user makes one pull per configured interval.
      pending += ((now - previous) / 1000) * speed *
        before.config.users / before.config.secondsPerPull;
      previous = now;
      const count = mode === "instant" ? 500 : Math.min(10_000, Math.floor(pending));
      if (count > 0) {
        try {
          const next = advanceEngine(before, count);
          current.current = next;
          pending = Math.max(0, pending - count);
          // Instant mode paints only the final result, while yielding for Cancel.
          if (mode !== "instant" || next.stopReason) setRun(next);
          if (next.stopReason) {
            setMode("idle");
            return;
          }
        } catch (cause) {
          setRun(current.current);
          setError(cause instanceof Error ? cause.message : "Run could not continue.");
          setMode("paused");
          return;
        }
      }
      timer = setTimeout(step, mode === "instant" || pending >= 1 ? 0 : 16);
    };
    timer = setTimeout(step, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [mode, speed]);

  function start(instant: boolean) {
    try {
      const next = current.current && !current.current.stopReason
        ? current.current
        : createEngine(config, items);
      current.current = next;
      setRun(next);
      setError("");
      setMode(next.stopReason ? "idle" : instant ? "instant" : "running");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check the scenario inputs.");
    }
  }

  function pause() {
    setRun(current.current);
    setMode("paused");
  }

  function reset() {
    current.current = null;
    setRun(null);
    setMode("idle");
    setError("");
  }

  function machine(id: MachineId) {
    reset();
    setConfig((previous) => ({ ...previous, machineId: id,
      pullPriceCents: createDefaultEngineConfig(id).pullPriceCents }));
    setItems(createDefaultEngineItems(id));
  }

  function exportRun() {
    const snapshot = current.current;
    if (!snapshot) return;
    const blob = new Blob([JSON.stringify({
      version: APP_VERSION,
      simulation: true,
      currency: "USD",
      assumptions: "Fictional USD scenario; no CR/EUR conversion. Shipping is queued only. Fees per pull; taxes and fulfillment costs excluded.",
      summary: summarizeEngine(snapshot),
      run: snapshot,
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `gacha-engine-${config.machineId}-${config.seed}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <EngineDashboard
    config={config} items={items} run={run} mode={mode} speed={speed} error={error}
    onConfigChange={setConfig} onItemsChange={setItems} onMachineChange={machine}
    onStart={() => start(false)} onPause={pause} onReset={reset}
    onInstant={() => start(true)} onSpeedChange={setSpeed} onExport={exportRun}
    onLogout={onLogout}
  />;
}

export default function Engine() {
  const [session, setSession] = useState<Session | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const authGeneration = useRef(0);
  const authChanging = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (authChanging.current) return;
      const generation = ++authGeneration.current;
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        if (!response.ok) throw new Error("Session unavailable");
        const next: Session = await response.json();
        if (!cancelled && generation === authGeneration.current) { setSession(next); setError(""); }
      } catch {
        if (!cancelled && generation === authGeneration.current) { setSession(null); setError("Connection lost. Refresh to reconnect."); }
      }
    };
    void check();
    const timer = setInterval(check, 60_000);
    window.addEventListener("focus", check);
    return () => { cancelled = true; authGeneration.current++; clearInterval(timer); window.removeEventListener("focus", check); };
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    if (authChanging.current) return;
    authChanging.current = true;
    const generation = ++authGeneration.current;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) throw new Error(response.status === 429
        ? "Too many attempts. Try again later."
        : response.status === 503 ? "Admin access needs setup on this deployment." : "Wrong password. Try again.");
      const next: Session = await response.json();
      if (generation === authGeneration.current) { setSession(next); setPassword(""); }
    } catch (cause) {
      if (generation === authGeneration.current) setError(cause instanceof Error ? cause.message : "Could not connect.");
    } finally { authChanging.current = false; setBusy(false); }
  }

  async function logout() {
    if (authChanging.current) return;
    authChanging.current = true;
    const generation = ++authGeneration.current;
    try {
      const response = await fetch("/api/admin/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Sign out failed. Try again.");
      if (generation === authGeneration.current) setSession({ authenticated: false, configured: true });
    } catch (cause) {
      if (generation === authGeneration.current) setError(cause instanceof Error ? cause.message : "Could not sign out.");
    } finally { authChanging.current = false; }
  }

  if (session?.authenticated) return <>
    {error && <p className="engine-access-error" role="alert">{error}</p>}
    <Simulation onLogout={() => void logout()} />
  </>;
  return <main className="admin-login admin-ui">
    <a className="admin-back" href="/">← BACK TO ARCADE</a>
    <section className="admin-login-card">
      <span className="admin-kicker">GACHA ARCADE · {APP_VERSION}</span>
      <h1>ENGINE<br />LAB</h1>
      <p className="admin-subtitle">ADMIN ACCESS · SIMULATION</p>
      <form onSubmit={login}>
        <label htmlFor="engine-password">Password</label>
        <input id="engine-password" type="password" autoComplete="current-password"
          value={password} onChange={(event) => setPassword(event.target.value)}
          required maxLength={256} disabled={busy || session?.configured === false} />
        {error && <p className="admin-error" role="alert">{error}</p>}
        {session?.configured === false && <p className="admin-error">Admin access needs setup on this deployment.</p>}
        <button className="admin-primary" disabled={busy || !session?.configured || !password}>
          {busy ? "UNLOCKING…" : session === null ? "CONNECTING…" : "ENTER ENGINE"}
        </button>
      </form>
      <span className="admin-login-footer">SAME ADMIN LOGIN · FICTIONAL USD</span>
    </section>
  </main>;
}
