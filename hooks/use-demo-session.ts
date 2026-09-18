"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import {
  initialState,
  LEGACY_STORAGE_KEY,
  PREVIOUS_STORAGE_KEY,
  PREVIOUS_V4_STORAGE_KEY,
  STORAGE_KEY,
  type DemoState,
} from "../lib/demo.ts";
import {
  isValidDemoDay,
  OPERATIONS_STORAGE_KEY,
  parseOperations,
  restoreDemoSession,
} from "../lib/operations.ts";
import { compareAndWriteSession } from "../lib/session-commit.ts";

const conflictNotice =
  "Another tab changed this demo. Your pending changes were not saved; the latest session has been loaded. Review it and try again.";
const fallbackNotice =
  "This browser uses best-effort tab synchronization. Avoid editing the demo in multiple tabs at once.";

/** Shared browser-local simulation. Web Locks serialize cooperating tab commits. */
export function useDemoSession() {
  const [state, updateState] = useState<DemoState>(initialState);
  const [demoDay, updateDemoDay] = useState(0);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");
  const [legacySessionNotice, setLegacySessionNotice] = useState(false);
  const stateRef = useRef(state);
  const persisted = useRef<string | null>(null);
  const queuedBase = useRef<string | null>(null);
  const lastOperations = useRef<string | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const commits = useRef<Promise<void>>(Promise.resolve());

  const invalidateCommits = useCallback(() => {
    generation.current++;
    controller.current?.abort();
    controller.current = new AbortController();
    queuedBase.current = persisted.current;
    commits.current = Promise.resolve();
  }, []);

  const restoreCurrent = useCallback(
    (current: string | null, conflict: boolean) => {
      const restored = restoreDemoSession(
        current,
        localStorage.getItem(PREVIOUS_V4_STORAGE_KEY),
        localStorage.getItem(PREVIOUS_STORAGE_KEY),
      );
      persisted.current = current;
      invalidateCommits();
      stateRef.current = restored;
      updateState(restored);
      if (conflict) setSyncNotice(conflictNotice);
    },
    [invalidateCommits],
  );

  const queueCommit = useCallback(
    (serialized: string) => {
      const base = queuedBase.current;
      if (serialized === base) return;
      queuedBase.current = serialized;
      const epoch = generation.current;
      const signal = controller.current?.signal;
      const stillCurrent = () =>
        mounted.current && epoch === generation.current;
      const commit = () => {
        if (!stillCurrent()) return;
        const outcome = compareAndWriteSession(
          localStorage,
          STORAGE_KEY,
          base,
          serialized,
        );
        if (outcome.status === "committed") {
          persisted.current = serialized;
          setSyncNotice(navigator.locks ? "" : fallbackNotice);
        } else if (outcome.status === "conflict") {
          restoreCurrent(outcome.current, true);
        } else {
          // Keep the latest optimistic edits in memory; cancel their stale commit bases.
          invalidateCommits();
          setStorageWarning(true);
          setSyncNotice(
            "Changes are kept in this tab only because browser storage is unavailable.",
          );
        }
      };
      commits.current = commits.current.then(async () => {
        if (!stillCurrent()) return;
        try {
          if (navigator.locks) {
            await navigator.locks.request(
              `${STORAGE_KEY}:commit`,
              { signal },
              commit,
            );
          } else {
            // Synchronous compare/write narrows the race but is not atomic across tabs.
            setSyncNotice(fallbackNotice);
            commit();
          }
        } catch {
          if (!stillCurrent() || signal?.aborted) return;
          invalidateCommits();
          setStorageWarning(true);
          setSyncNotice(
            "Changes are kept in this tab only because browser storage is unavailable.",
          );
        }
      });
    },
    [invalidateCommits, restoreCurrent],
  );

  const setState = useCallback(
    (action: SetStateAction<DemoState>) => {
      if (!mounted.current) return;
      // Direct snapshots (the arcade pull path) must still match their render's
      // base. Functional updates deliberately receive the latest in-memory state.
      if (typeof action !== "function" && stateRef.current !== state) {
        setSyncNotice(
          "The demo changed before this action completed. Review the current session and try again.",
        );
        return;
      }
      const next =
        typeof action === "function" ? action(stateRef.current) : action;
      if (next === stateRef.current) return;
      stateRef.current = next;
      updateState(next);
      queueCommit(JSON.stringify(next));
    },
    [queueCommit, state],
  );

  useEffect(() => {
    mounted.current = true;
    invalidateCommits();
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      const previousV4 = localStorage.getItem(PREVIOUS_V4_STORAGE_KEY);
      const previous = localStorage.getItem(PREVIOUS_STORAGE_KEY);
      restoreCurrent(current, false);
      const operations = localStorage.getItem(OPERATIONS_STORAGE_KEY);
      lastOperations.current = operations;
      updateDemoDay(parseOperations(operations).demoDay);
      setLegacySessionNotice(
        current === null &&
          previousV4 === null &&
          previous === null &&
          localStorage.getItem(LEGACY_STORAGE_KEY) !== null,
      );
      // Persist migration/normalization through the same protected commit path.
      queueCommit(JSON.stringify(stateRef.current));
      if (!navigator.locks) setSyncNotice(fallbackNotice);
    } catch {
      setStorageWarning(true);
    }
    setReady(true);
    function sync(event: StorageEvent) {
      if (
        event.storageArea !== localStorage ||
        (event.key !== null &&
          ![STORAGE_KEY, OPERATIONS_STORAGE_KEY].includes(event.key))
      )
        return;
      try {
        const current = localStorage.getItem(STORAGE_KEY);
        // A delayed event must not discard our own newer pending edits.
        if (current !== persisted.current) {
          const hadPending = queuedBase.current !== persisted.current;
          restoreCurrent(current, hadPending);
        }
        const operations = localStorage.getItem(OPERATIONS_STORAGE_KEY);
        lastOperations.current = operations;
        updateDemoDay(parseOperations(operations).demoDay);
      } catch {
        setStorageWarning(true);
      }
    }
    window.addEventListener("storage", sync);
    return () => {
      mounted.current = false;
      invalidateCommits();
      window.removeEventListener("storage", sync);
    };
  }, [invalidateCommits, queueCommit, restoreCurrent]);

  useEffect(() => {
    if (!ready) return;
    const serialized = JSON.stringify({ demoDay });
    if (serialized === lastOperations.current) return;
    try {
      localStorage.setItem(OPERATIONS_STORAGE_KEY, serialized);
      lastOperations.current = serialized;
    } catch {
      setStorageWarning(true);
    }
  }, [demoDay, ready]);

  const setDemoDay = useCallback((action: SetStateAction<number>) => {
    updateDemoDay((current) => {
      const next = typeof action === "function" ? action(current) : action;
      return isValidDemoDay(next) ? next : current;
    });
  }, []);
  const clearSyncNotice = useCallback(() => setSyncNotice(""), []);

  return {
    state,
    setState,
    ready,
    storageWarning,
    syncNotice,
    clearSyncNotice,
    legacySessionNotice,
    demoDay,
    setDemoDay,
  };
}
