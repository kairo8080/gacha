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
  STORAGE_KEY,
  type DemoState,
} from "../lib/demo.ts";
import {
  isValidDemoDay,
  OPERATIONS_STORAGE_KEY,
  parseOperations,
  restoreDemoSession,
} from "../lib/operations.ts";

/** Shared browser-local simulation for player and operations views. */
export function useDemoSession() {
  const [state, setState] = useState<DemoState>(initialState);
  const [demoDay, updateDemoDay] = useState(0);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [legacySessionNotice, setLegacySessionNotice] = useState(false);
  const lastState = useRef<string | null>(null);
  const lastOperations = useRef<string | null>(null);

  useEffect(() => {
    function restore() {
      try {
        const current = localStorage.getItem(STORAGE_KEY);
        const previous = localStorage.getItem(PREVIOUS_STORAGE_KEY);
        const operations = localStorage.getItem(OPERATIONS_STORAGE_KEY);
        lastState.current = current;
        lastOperations.current = operations;
        setState(restoreDemoSession(current, previous));
        updateDemoDay(parseOperations(operations).demoDay);
        setLegacySessionNotice(
          current === null &&
            previous === null &&
            localStorage.getItem(LEGACY_STORAGE_KEY) !== null,
        );
      } catch {
        setStorageWarning(true);
      }
    }
    restore();
    setReady(true);
    function sync(event: StorageEvent) {
      if (
        event.storageArea === localStorage &&
        (event.key === null ||
          [STORAGE_KEY, OPERATIONS_STORAGE_KEY].includes(event.key))
      )
        restore();
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const serialized = JSON.stringify(state);
    if (serialized === lastState.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, serialized);
      lastState.current = serialized;
    } catch {
      setStorageWarning(true);
    }
  }, [state, ready]);

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

  return {
    state,
    setState,
    ready,
    storageWarning,
    legacySessionNotice,
    demoDay,
    setDemoDay,
  };
}
