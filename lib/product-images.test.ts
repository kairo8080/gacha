import assert from "node:assert/strict";
import test from "node:test";
import { legacyStockCatalog, stockCatalog } from "./catalog.ts";
import { resolveProductImagePath } from "./product-images.ts";

test("legacy pack awards resolve by their original set identity without current catalog metadata", () => {
  const oldPrize = legacyStockCatalog.find((prize) => prize.id === "the-first-chapter")!;
  assert.equal(resolveProductImagePath(oldPrize, ["/products/01-the-first-chapter-pack.png"]),
    "/products/01-the-first-chapter-pack.png");
});

test("bundles share pack art while boxes stay distinct and missing pack art stays missing", () => {
  const firstPack = stockCatalog.find((prize) => prize.id === "the-first-chapter")!;
  const available = ["/products/01-the-first-chapter-pack.png", "/products/01-the-first-chapter-box.png"];
  for (const prize of stockCatalog.filter((row) => row.setId === firstPack.setId)) {
    assert.equal(resolveProductImagePath(prize, available), `/products/01-the-first-chapter-${prize.kind}.png`);
  }
  assert.equal(resolveProductImagePath(firstPack, [available[1]]), null);
});

test("saved custom image identity wins and invalid or removed overrides never fall back to a different photo", () => {
  const prize = stockCatalog.find((row) => row.id === "the-first-chapter")!;
  const available = ["/products/saved-photo.png", "/products/01-the-first-chapter-pack.png"];
  assert.equal(resolveProductImagePath({ ...prize, imagePath: available[0] }, available), available[0]);
  for (const imagePath of ["/products/removed-photo.png", "https://example.com/photo.png", "/products/../secret.png"])
    assert.equal(resolveProductImagePath({ ...prize, imagePath }, available), null);
  assert.equal(resolveProductImagePath({ ...prize, setId: null }, available), null);
});
