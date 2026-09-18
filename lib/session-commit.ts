type SessionStorage = Pick<Storage, "getItem" | "setItem">;

export type SessionCommit =
  | { status: "committed" }
  | { status: "conflict"; current: string | null }
  | { status: "unavailable" };

/** Call inside a shared Web Lock. Without a lock this is best-effort only. */
export function compareAndWriteSession(
  storage: SessionStorage,
  key: string,
  expected: string | null,
  next: string,
): SessionCommit {
  try {
    const current = storage.getItem(key);
    if (current !== expected) return { status: "conflict", current };
    if (current !== next) storage.setItem(key, next);
    return { status: "committed" };
  } catch {
    return { status: "unavailable" };
  }
}
