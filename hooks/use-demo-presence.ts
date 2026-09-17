"use client";

import { useEffect, useState } from "react";

const PREFIX = "gacha-demo-presence:";
const EXPIRY = 35_000;

/** Presence is limited to this browser. Tabs are not counted as separate users. */
export function useDemoPresence(trackPlayer = false) {
  const [online, setOnline] = useState(0);

  useEffect(() => {
    const key = `${PREFIX}${crypto.randomUUID()}`;
    function readPresence() {
      try {
        const now = Date.now();
        let active = false;
        for (let index = localStorage.length - 1; index >= 0; index--) {
          const candidate = localStorage.key(index);
          if (!candidate?.startsWith(PREFIX)) continue;
          const timestamp = Number(localStorage.getItem(candidate));
          if (timestamp <= now && timestamp > now - EXPIRY) active = true;
          else localStorage.removeItem(candidate);
        }
        setOnline(active ? 1 : 0);
      } catch {
        setOnline(trackPlayer ? 1 : 0);
      }
    }
    function refresh() {
      try {
        if (trackPlayer) localStorage.setItem(key, String(Date.now()));
      } catch {
        /* Read fallback still reports the current player. */
      }
      readPresence();
    }
    function leave() {
      try {
        localStorage.removeItem(key);
      } catch {
        /* Optional demo presence. */
      }
    }
    refresh();
    const timer = setInterval(refresh, 10_000);
    window.addEventListener("storage", readPresence);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", readPresence);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", refresh);
      leave();
    };
  }, [trackPlayer]);

  return online;
}
