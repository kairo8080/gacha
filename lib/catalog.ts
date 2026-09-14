import type { Machine, MachineId, Prize } from "./demo.ts";

export type StockPrize = Prize & {
  startingQuantity: number;
  machineId: MachineId;
};

/** Fictional public fixtures: quantities are independent of warehouse inventory. */
const sourceRows = [
  ["the-first-chapter", "The First Chapter", "epic", 90],
  ["rise-of-the-floodborn", "Rise of the Floodborn", "common", 8],
  ["into-the-inklands", "Into the Inklands", "common", 9],
  ["ursulas-return", "Ursula's Return", "common", 10],
  ["shimmering-skies", "Shimmering Skies", "common", 11],
  ["azurite-sea", "Azurite Sea", "common", 8],
  ["archazias-island", "Archazia's Island", "common", 12],
  ["reign-of-jafar", "Reign of Jafar", "common", 10],
  ["fabled", "Fabled", "epic", 78],
  ["winterspell", "Winterspell", "rare", 28],
  ["whispers-in-the-well", "Whispers in the Well", "rare", 30],
  ["wilds-unknown", "Wilds Unknown", "rare", 32],
  ["attack-of-the-vine", "Attack of the Vine!", "rare", 34],
  ["hyperia-city", "Hyperia City", "rare", 35],
] as const;

/** Tier placement and credit values are provisional simulation settings, not market values. */
export const stockCatalog: StockPrize[] = sourceRows.map(
  ([id, name, machineId, value]) => ({
    id,
    name,
    startingQuantity: 100,
    machineId,
    value,
    detail: "1 sealed Lorcana booster pack",
    kind: "pack",
  }),
);

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
    tagline: "Seven sets. One new find.",
    description: "Explore seven sets with fictional sample stock.",
    prizes: stockCatalog.filter((prize) => prize.machineId === "common"),
  },
  {
    id: "rare",
    name: "Rare",
    level: "Rare",
    price: 25,
    tagline: "A smaller stack of new adventures.",
    description: "Five sets with 100 sample packs each.",
    prizes: stockCatalog.filter((prize) => prize.machineId === "rare"),
  },
  {
    id: "epic",
    name: "Epic",
    level: "Epic",
    price: 60,
    tagline: "The First Chapter meets Fabled.",
    description: "Two collector favorites with 100 sample packs each.",
    prizes: stockCatalog.filter((prize) => prize.machineId === "epic"),
  },
];
