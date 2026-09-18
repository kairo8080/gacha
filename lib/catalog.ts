import type { Machine, MachineId, Prize } from "./demo.ts";

export type StockPrize = Prize & {
  startingQuantity: number;
  machineIds: MachineId[];
  setId: string | null;
  language: "EN";
  cardmarketUrl: string | null;
  marketPriceEur: number | null;
  /** Manually entered EUR acquisition cost; absent in older v5 sessions. */
  buyCostEur?: number | null;
  marketCheckedAt: string | null;
  /** Absent metadata retains the original v5 defaults: false, active, and null. */
  specialEvent?: boolean;
  availability?: "active" | "paused" | "retired";
  imagePath?: string | null;
};

/** Public fictional values, unrelated to warehouse quantities or market prices. */
const sourceRows = [
  ["the-first-chapter", "The First Chapter", "epic", 90, 1],
  ["rise-of-the-floodborn", "Rise of the Floodborn", "common", 8, 2],
  ["into-the-inklands", "Into the Inklands", "common", 9, 3],
  ["ursulas-return", "Ursula's Return", "common", 10, 4],
  ["shimmering-skies", "Shimmering Skies", "common", 11, 5],
  ["azurite-sea", "Azurite Sea", "common", 8, 6],
  ["archazias-island", "Archazia's Island", "common", 12, 7],
  ["reign-of-jafar", "Reign of Jafar", "common", 10, 8],
  ["fabled", "Fabled", "epic", 78, 9],
  ["winterspell", "Winterspell", "rare", 28, 11],
  ["whispers-in-the-well", "Whispers in the Well", "rare", 30, 10],
  ["wilds-unknown", "Wilds Unknown", "rare", 32, 12],
  ["attack-of-the-vine", "Attack of the Vine!", "rare", 34, 13],
  ["hyperia-city", "Hyperia City", "rare", 35, 14],
] as const;

export const setCatalog = sourceRows
  .map(([id, name, , , number]) => ({ id, name, number }))
  .sort((a, b) => a.number - b.number);

/** Exact former fixtures are retained solely for strict v3/v4 session migration. */
export const legacyStockCatalog: Prize[] = sourceRows.map(
  ([id, name, machineId, value]) => ({
    id,
    name,
    machineId,
    value,
    startingQuantity: 100,
    detail: "1 sealed Lorcana booster pack",
    kind: "pack",
  }),
);

const metadata = {
  startingQuantity: 100,
  language: "EN" as const,
  cardmarketUrl: null,
  marketPriceEur: null,
  marketCheckedAt: null,
};

/** Quantities count reward units: one bundle or box is one unit and one draw ticket. */
export const stockCatalog: StockPrize[] = [
  ...sourceRows.map(([id, name, machineId, value]): StockPrize => ({
    ...metadata,
    id,
    name,
    machineIds: [machineId],
    value,
    detail: "1 sealed Lorcana booster pack · EN",
    kind: "pack",
    packCount: 1,
    setId: id,
  })),
  ...sourceRows.flatMap(([id, name, , value]): StockPrize[] => [
    ...([2, 3] as const).map((packCount): StockPrize => ({
      ...metadata,
      id: `${id}-${packCount}-packs`,
      name: `${name} · ${packCount} packs`,
      machineIds: ["common", "rare"],
      value: value * packCount,
      setId: id,
      kind: "pack",
      packCount,
      detail: `${packCount} sealed Lorcana booster packs · EN`,
    })),
    {
      ...metadata,
      id: `${id}-booster-box`,
      name: `${name} · Booster box`,
      machineIds: ["common", "rare", "epic"],
      value: value * 24,
      setId: id,
      kind: "box",
      detail: "Sealed Lorcana booster box · EN",
    },
  ]),
  {
    ...metadata,
    id: "d23-collection-2026",
    name: "D23 Collection 2026",
    kind: "collection",
    machineIds: ["common", "epic"],
    setId: null,
    value: 150,
    detail: "Limited foil collector box · EN · fictional reward",
  },
  ...(["PSA 9", "PSA 10"] as const).map((grade): StockPrize => ({
    ...metadata,
    id: grade === "PSA 9" ? "sample-psa-9" : "sample-psa-10",
    name: `Lorcana graded card · ${grade}`,
    kind: "graded",
    grade,
    machineIds: ["common", "rare", "epic"],
    setId: null,
    value: grade === "PSA 9" ? 50 : 100,
    detail: "Fictional sample graded card · EN",
  })),
  {
    ...metadata,
    id: "sample-mystery",
    name: "Lorcana mystery reward",
    kind: "mystery",
    machineIds: ["common", "rare", "epic"],
    setId: null,
    value: 20,
    detail: "Fictional mystery reward · EN",
  },
];

export const totalStartingStock = stockCatalog.reduce(
  (total, prize) => total + prize.startingQuantity,
  0,
);

export const machines: Machine[] = [
  {
    id: "common",
    name: "Common",
    level: "Common",
    price: 10,
    tagline: "A little of everything.",
    description:
      "Packs, bundles, boxes and collector rewards from shared fictional stock.",
    prizes: [],
  },
  {
    id: "rare",
    name: "Rare",
    level: "Rare",
    price: 25,
    tagline: "More ways to find a favorite.",
    description: "A mixed reward pool with shared fictional stock.",
    prizes: [],
  },
  {
    id: "epic",
    name: "Epic",
    level: "Epic",
    price: 60,
    tagline: "Collector favorites and bigger finds.",
    description:
      "Sealed boxes and collector rewards from shared fictional stock.",
    prizes: [],
  },
].map((machine) => ({
  ...machine,
  id: machine.id as MachineId,
  prizes: stockCatalog.filter((prize) =>
    prize.machineIds.includes(machine.id as MachineId),
  ),
}));
