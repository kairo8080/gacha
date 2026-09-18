import { setCatalog, type StockPrize } from "./catalog.ts";
import type { Prize } from "./demo.ts";
import { isProductImagePath } from "./ghost-stock.ts";

export type ProductImagePrize = Pick<Prize, "id" | "name" | "kind"> &
  Partial<Pick<StockPrize, "setId" | "imagePath">>;

/** Bundles share the single-pack product photo; their amount is shown separately. */
export function expectedProductImagePath(prize: ProductImagePrize): string {
  // Older single-pack awards used the set ID directly, without setId metadata.
  const setId =
    prize.setId === undefined && prize.kind === "pack" ? prize.id : prize.setId;
  const set = setCatalog.find((entry) => entry.id === setId);
  const stem =
    set && (prize.kind === "pack" || prize.kind === "box")
      ? `${String(set.number).padStart(2, "0")}-${set.id}-${prize.kind}`
      : prize.id;
  return `/products/${stem}.webp`;
}

export function resolveProductImagePath(
  prize: ProductImagePrize,
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
