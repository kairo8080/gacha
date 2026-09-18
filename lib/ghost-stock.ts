import { setCatalog, type StockPrize } from "./catalog.ts";
import type { Prize } from "./demo.ts";

export function isMachineId(
  value: unknown,
): value is "common" | "rare" | "epic" {
  return value === "common" || value === "rare" || value === "epic";
}

/** Product images are reviewed local assets; remote URLs and nested paths are invalid. */
export function isProductImagePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 200 &&
    /^\/products\/[a-z0-9]+(?:[-_][a-z0-9]+)*\.(?:webp|png|jpg|jpeg)$/.test(
      value,
    )
  );
}

export function isCardmarketReference(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1000) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "www.cardmarket.com" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      /^\/en\/Lorcana\/Products\/[A-Za-z0-9-]+\/[A-Za-z0-9-]+\/?$/.test(
        url.pathname,
      )
    );
  } catch {
    return false;
  }
}

function boundedText(value: unknown, max: number): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= max
  );
}

function price(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100000
  );
}

export function isPrizeSnapshot(value: unknown): value is Prize {
  if (!value || typeof value !== "object") return false;
  const prize = value as Record<string, unknown>;
  return (
    typeof prize.id === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(prize.id) &&
    prize.id.length <= 100 &&
    boundedText(prize.name, 160) &&
    boundedText(prize.detail, 500) &&
    price(prize.value) &&
    typeof prize.kind === "string" &&
    ["pack", "box", "collection", "graded", "mystery"].includes(prize.kind) &&
    (prize.kind === "pack"
      ? [1, 2, 3].includes(prize.packCount as number)
      : prize.packCount === undefined) &&
    (prize.kind === "graded"
      ? prize.grade === "PSA 9" || prize.grade === "PSA 10"
      : prize.grade === undefined)
  );
}

/** Cardmarket references are manually verified EN references, never live price feeds. */
export function isStockPrize(value: unknown): value is StockPrize {
  if (!isPrizeSnapshot(value)) return false;
  const prize = value as StockPrize;
  return (
    prize.language === "EN" &&
    (prize.specialEvent === undefined ||
      typeof prize.specialEvent === "boolean") &&
    (prize.availability === undefined ||
      prize.availability === "active" ||
      prize.availability === "paused" ||
      prize.availability === "retired") &&
    (prize.imagePath === undefined ||
      prize.imagePath === null ||
      isProductImagePath(prize.imagePath)) &&
    Number.isInteger(prize.startingQuantity) &&
    prize.startingQuantity >= 0 &&
    prize.startingQuantity <= 1000000 &&
    Array.isArray(prize.machineIds) &&
    prize.machineIds.every(isMachineId) &&
    new Set(prize.machineIds).size === prize.machineIds.length &&
    (prize.setId === null ||
      setCatalog.some((set) => set.id === prize.setId)) &&
    (!["pack", "box"].includes(prize.kind) || prize.setId !== null) &&
    (prize.cardmarketUrl === null ||
      isCardmarketReference(prize.cardmarketUrl)) &&
    (prize.marketPriceEur === null
      ? prize.marketCheckedAt === null
      : price(prize.marketPriceEur) &&
        prize.cardmarketUrl !== null &&
        prize.marketCheckedAt !== null) &&
    (prize.marketCheckedAt === null ||
      (typeof prize.marketCheckedAt === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(
          prize.marketCheckedAt,
        ) &&
        Number.isFinite(Date.parse(prize.marketCheckedAt)) &&
        new Date(prize.marketCheckedAt).toISOString().replace(".000Z", "Z") ===
          prize.marketCheckedAt.replace(".000Z", "Z")))
  );
}

export function copyStockPrize(prize: StockPrize): StockPrize {
  return {
    id: prize.id,
    name: prize.name,
    detail: prize.detail,
    kind: prize.kind,
    value: prize.value,
    ...(prize.packCount === undefined ? {} : { packCount: prize.packCount }),
    ...(prize.grade === undefined ? {} : { grade: prize.grade }),
    startingQuantity: prize.startingQuantity,
    machineIds: [...prize.machineIds],
    setId: prize.setId,
    language: "EN",
    cardmarketUrl: prize.cardmarketUrl,
    marketPriceEur: prize.marketPriceEur,
    marketCheckedAt: prize.marketCheckedAt,
    ...(prize.specialEvent === undefined
      ? {}
      : { specialEvent: prize.specialEvent }),
    ...(prize.availability === undefined
      ? {}
      : { availability: prize.availability }),
    ...(prize.imagePath === undefined ? {} : { imagePath: prize.imagePath }),
  };
}
