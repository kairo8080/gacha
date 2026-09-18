import { setCatalog, type StockPrize } from "./catalog.ts";
import { isProductImagePath } from "./ghost-stock.ts";

/** Bundles share the single-pack product photo; their amount is shown separately. */
export function expectedProductImagePath(prize: StockPrize): string {
  const set = setCatalog.find((entry) => entry.id === prize.setId);
  const stem =
    set && (prize.kind === "pack" || prize.kind === "box")
      ? `${String(set.number).padStart(2, "0")}-${set.id}-${prize.kind}`
      : prize.id;
  return `/products/${stem}.webp`;
}

export function resolveProductImagePath(
  prize: StockPrize,
  available: readonly string[],
): string | null {
  if (prize.imagePath)
    return isProductImagePath(prize.imagePath) &&
      available.includes(prize.imagePath)
      ? prize.imagePath
      : null;
  const stem = expectedProductImagePath(prize).replace(/\.webp$/, "");
  return (
    ["webp", "png", "jpg", "jpeg"]
      .map((extension) => `${stem}.${extension}`)
      .find((path) => available.includes(path)) ?? null
  );
}
