import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type PrivateStockRow = {
  id: string;
  name: string;
  packs: number;
  boxes: number;
};

export async function readPrivateStock(): Promise<{
  available: boolean;
  rows: PrivateStockRow[];
}> {
  const unavailable = { available: false, rows: [] };
  if (
    process.env.ADMIN_LOCAL_INVENTORY !== "1" ||
    process.env.NODE_ENV === "production"
  )
    return unavailable;
  try {
    // Never import private JSON: read only at request time, in an explicitly
    // enabled local runtime. Production does not touch the local stock file.
    const raw = await readFile(
      join(process.cwd(), ".local", "private-inventory", "owner-stock.json"),
      "utf8",
    );
    if (raw.length > 1_000_000) return unavailable;
    const data: unknown = JSON.parse(raw);
    if (
      !data ||
      typeof data !== "object" ||
      !("sets" in data) ||
      !Array.isArray(data.sets) ||
      data.sets.length > 1000
    )
      return unavailable;
    const ids = new Set<string>();
    const rows: PrivateStockRow[] = [];
    for (const entry of data.sets) {
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof entry.id !== "string" ||
        !/^[a-z\d_-]{1,100}$/i.test(entry.id) ||
        ids.has(entry.id) ||
        typeof entry.name !== "string" ||
        !entry.name.trim() ||
        entry.name.length > 200 ||
        !Number.isSafeInteger(entry.reportedPacks) ||
        entry.reportedPacks < 0 ||
        !Number.isSafeInteger(entry.reportedBoxes) ||
        entry.reportedBoxes < 0
      )
        return unavailable;
      ids.add(entry.id);
      rows.push({
        id: entry.id,
        name: entry.name,
        packs: entry.reportedPacks,
        boxes: entry.reportedBoxes,
      });
    }
    return { available: true, rows };
  } catch {
    return unavailable;
  }
}
