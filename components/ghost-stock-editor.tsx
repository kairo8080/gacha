"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import ProductImage from "@/components/product-image";
import { setCatalog, type StockPrize } from "@/lib/catalog";
import {
  demoReducer,
  getStockCatalog,
  remainingStock,
  type DemoState,
  type MachineId,
} from "@/lib/demo";
import {
  copyStockPrize,
  isCardmarketReference,
  isProductImagePath,
} from "@/lib/ghost-stock";
import { expectedProductImagePath } from "@/lib/product-images";

const tiers: MachineId[] = ["common", "rare", "epic"];
const formats = [
  ["pack-1", "1× PACK"],
  ["pack-2", "2× PACKS"],
  ["pack-3", "3× PACKS"],
  ["box", "SEALED BOX"],
  ["collection", "COLLECTION BOX"],
  ["PSA 9", "PSA 9"],
  ["PSA 10", "PSA 10"],
  ["mystery", "MYSTERY BOX"],
] as const;
type Format = (typeof formats)[number][0];
type Availability = "active" | "paused" | "retired";
type EditorPrize = StockPrize & {
  specialEvent?: boolean;
  availability?: Availability;
  imagePath?: string | null;
};
type Draft = {
  prize: EditorPrize;
  base: string | null;
  quantity: string;
  value: string;
  marketPrice: string;
  confirmedEnglish: boolean;
};
type SortKey =
  "name" | "set" | "type" | "amount" | "total" | "available" | "value";
const number = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
const setNumber = (prize: StockPrize) =>
  setCatalog.find((set) => set.id === prize.setId)?.number;
const formatOf = (prize: StockPrize): Format =>
  prize.kind === "pack"
    ? `pack-${prize.packCount ?? 1}`
    : prize.kind === "graded"
      ? prize.grade!
      : prize.kind;
const labelOf = (prize: StockPrize) =>
  formats.find(([id]) => id === formatOf(prize))?.[1] ?? "UNKNOWN";
const availabilityOf = (prize: EditorPrize): Availability =>
  prize.availability ?? "active";
const eventOf = (prize: EditorPrize) => prize.specialEvent ?? false;
const reservedFor = (state: DemoState, id: string) =>
  state.items.filter((item) => item.prize.id === id && item.status !== "sold")
    .length;
const statusOf = (state: DemoState, prize: EditorPrize) =>
  availabilityOf(prize) === "retired"
    ? "RETIRED"
    : availabilityOf(prize) === "paused"
      ? "PAUSED"
      : remainingStock(state, prize.id) === 0
        ? "OUT OF STOCK"
        : !prize.machineIds.length && !eventOf(prize)
          ? "UNASSIGNED"
          : !prize.machineIds.length
            ? "EVENT ONLY"
            : "AVAILABLE";
const amountOf = (prize: StockPrize) =>
  prize.kind === "pack"
    ? `${prize.packCount} PACK${prize.packCount === 1 ? "" : "S"}`
    : prize.kind === "box"
      ? "1 BOX"
      : prize.kind === "graded"
        ? "1 CARD"
        : "1 ITEM";
function draftOf(prize: StockPrize, base: string | null): Draft {
  const editor = prize as EditorPrize;
  return {
    prize: {
      ...editor,
      machineIds: [...prize.machineIds],
      specialEvent: eventOf(editor),
      availability: availabilityOf(editor),
      imagePath: editor.imagePath ?? null,
    },
    base,
    quantity: String(prize.startingQuantity),
    value: String(prize.value),
    marketPrice:
      prize.marketPriceEur === null ? "" : String(prize.marketPriceEur),
    confirmedEnglish: false,
  };
}

export default function GhostStockEditor({
  state,
  setState,
  ready,
}: {
  state: DemoState;
  setState: Dispatch<SetStateAction<DemoState>>;
  ready: boolean;
}) {
  const catalog = getStockCatalog(state) as EditorPrize[];
  const [query, setQuery] = useState("");
  const [setFilter, setSetFilter] = useState("all");
  const [format, setFormat] = useState("all");
  const [machine, setMachine] = useState("all");
  const [stockStatus, setStockStatus] = useState("all");
  const [sort, setSort] = useState<{
    key: SortKey;
    direction: "ascending" | "descending";
  }>({ key: "set", direction: "ascending" });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<EditorPrize | null>(null);
  const tableViewport = useRef<HTMLDivElement>(null);
  const current = draft
    ? catalog.find((prize) => prize.id === draft.prize.id)
    : undefined;
  const changedElsewhere =
    !!draft &&
    (draft.base === null ? !!current : JSON.stringify(current) !== draft.base);
  const totalAvailable = catalog.reduce(
    (sum, prize) => sum + remainingStock(state, prize.id),
    0,
  );
  const matching = catalog
    .filter(
      (prize) =>
        prize.id === draft?.prize.id ||
        (`${prize.name} ${prize.detail} ${setNumber(prize) ?? "promo"} ${labelOf(prize)}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
          (setFilter === "all" || prize.setId === setFilter) &&
          (format === "all" || formatOf(prize) === format) &&
          (machine === "all" ||
            (machine === "event"
              ? eventOf(prize)
              : prize.machineIds.includes(machine as MachineId))) &&
          (stockStatus === "all" || statusOf(state, prize) === stockStatus)),
    )
    .sort((a, b) => {
      const value = (prize: EditorPrize): string | number =>
        ({
          name: prize.name.toLowerCase(),
          set: setNumber(prize) ?? 999,
          type: labelOf(prize),
          amount: prize.packCount ?? 1,
          total: prize.startingQuantity,
          available: remainingStock(state, prize.id),
          value: prize.value,
        })[sort.key];
      const aa = value(a);
      const bb = value(b);
      const result =
        typeof aa === "number" && typeof bb === "number"
          ? aa - bb
          : String(aa).localeCompare(String(bb));
      return sort.direction === "ascending" ? result : -result;
    });
  useEffect(() => {
    if (!pending) return;
    const saved = getStockCatalog(state).find(
      (prize) => prize.id === pending.id,
    ) as EditorPrize | undefined;
    if (JSON.stringify(saved) === JSON.stringify(pending)) {
      setDraft(draftOf(saved!, JSON.stringify(saved)));
      setNotice("SAVED · Arcade updated in this browser.");
      setError("");
    } else
      setError("Stock changed while saving. Reload this prize and try again.");
    setPending(null);
  }, [state, pending]);
  function edit(prize: EditorPrize, isNew = false) {
    setDraft(draftOf(prize, isNew ? null : JSON.stringify(prize)));
    setError("");
    setNotice("");
  }
  function update(patch: Partial<EditorPrize>) {
    setDraft((value) =>
      value ? { ...value, prize: { ...value.prize, ...patch } } : value,
    );
    setNotice("");
    setError("");
  }
  function changeFormat(next: Format) {
    const { packCount: _packs, grade: _grade, ...prize } = draft!.prize;
    const kind = next.startsWith("pack-")
      ? "pack"
      : next.startsWith("PSA")
        ? "graded"
        : (next as "box" | "collection" | "mystery");
    setDraft({
      ...draft!,
      prize: {
        ...prize,
        kind,
        ...(kind === "pack"
          ? { packCount: Number(next.slice(-1)) as 1 | 2 | 3 }
          : {}),
        ...(kind === "graded" ? { grade: next as "PSA 9" | "PSA 10" } : {}),
      },
    });
  }
  function addPrize() {
    tableViewport.current?.scrollTo({ top: 0, left: 0 });
    edit(
      {
        id: `ghost-${crypto.randomUUID()}`,
        name: "",
        detail: "English edition · fictional reward",
        kind: "mystery",
        value: 0,
        startingQuantity: 100,
        machineIds: ["common"],
        setId: null,
        language: "EN",
        cardmarketUrl: null,
        marketPriceEur: null,
        marketCheckedAt: null,
        specialEvent: false,
        availability: "active",
        imagePath: null,
      },
      true,
    );
  }
  function quickToggle(id: string | EditorPrize, tier: MachineId) {
    if (!ready || pending) return;
    const prizeId = typeof id === "string" ? id : id.id;
    setState((latest) => {
      const row = getStockCatalog(latest).find(
        (prize) => prize.id === prizeId,
      ) as EditorPrize | undefined;
      if (!row) return latest;
      const prize = copyStockPrize({
        ...row,
        machineIds: row.machineIds.includes(tier)
          ? row.machineIds.filter((entry) => entry !== tier)
          : [...row.machineIds, tier],
      } as StockPrize) as EditorPrize;
      return demoReducer(latest, { type: "save-stock", prize });
    });
  }
  function quickEventToggle(id: string) {
    if (!ready || pending) return;
    setState((latest) => {
      const row = getStockCatalog(latest).find((prize) => prize.id === id) as
        EditorPrize | undefined;
      if (!row) return latest;
      const prize = copyStockPrize({
        ...row,
        specialEvent: !eventOf(row),
      } as StockPrize) as EditorPrize;
      return demoReducer(latest, { type: "save-stock", prize });
    });
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || !ready || pending) return;
    setNotice("");
    if (changedElsewhere)
      return setError(
        "This prize changed in another tab. Reload it before saving.",
      );
    const quantity = Number(draft.quantity),
      value = Number(draft.value),
      marketPriceEur =
        draft.marketPrice.trim() === "" ? null : Number(draft.marketPrice),
      cardmarketUrl = draft.prize.cardmarketUrl?.trim() || null,
      imagePath = draft.prize.imagePath?.trim() || null,
      reserved = reservedFor(state, draft.prize.id);
    if (!draft.prize.name.trim() || !draft.prize.detail.trim())
      return setError("Name and detail are required.");
    if (imagePath && !isProductImagePath(imagePath))
      return setError(
        "Use a local product image path such as /products/01-the-first-chapter-pack.webp.",
      );
    if (
      !draft.quantity.trim() ||
      !Number.isSafeInteger(quantity) ||
      quantity < reserved ||
      quantity > 1_000_000
    )
      return setError(`Use a whole quantity from ${reserved} to 1,000,000.`);
    if (
      !draft.value.trim() ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100_000
    )
      return setError("Demo value must be between 0 and 100,000 CR.");
    if (
      (draft.prize.kind === "pack" || draft.prize.kind === "box") &&
      !draft.prize.setId
    )
      return setError(
        "Choose a numbered set for booster packs or a sealed booster box.",
      );
    if (cardmarketUrl && !isCardmarketReference(cardmarketUrl))
      return setError(
        "Use an HTTPS www.cardmarket.com/en/Lorcana/Products/category/product link.",
      );
    const quoteChanged =
      marketPriceEur !== (current?.marketPriceEur ?? null) ||
      cardmarketUrl !== (current?.cardmarketUrl ?? null);
    if (
      marketPriceEur !== null &&
      (!Number.isFinite(marketPriceEur) ||
        marketPriceEur < 0 ||
        marketPriceEur > 100_000)
    )
      return setError(
        "Enter a EUR reference price from 0 to 100,000, or leave it blank.",
      );
    if (
      marketPriceEur !== null &&
      (!cardmarketUrl ||
        ((quoteChanged || !current?.marketCheckedAt) &&
          !draft.confirmedEnglish))
    )
      return setError(
        "Add the product link and confirm you checked English listings before recording a EUR price.",
      );
    const prize = copyStockPrize({
      ...draft.prize,
      name: draft.prize.name.trim(),
      detail: draft.prize.detail.trim(),
      imagePath,
      startingQuantity: quantity,
      value,
      cardmarketUrl,
      marketPriceEur,
      marketCheckedAt:
        marketPriceEur === null
          ? null
          : draft.confirmedEnglish
            ? new Date().toISOString()
            : (current?.marketCheckedAt ?? null),
    } as StockPrize) as EditorPrize;
    if (demoReducer(state, { type: "save-stock", prize }) === state)
      return setError(
        "Check the prize fields. Stock cannot be lower than reserved rewards.",
      );
    setPending(prize);
    setState((latest) => {
      const row = getStockCatalog(latest).find(
        (entry) => entry.id === prize.id,
      );
      if (
        (draft.base === null && row) ||
        (draft.base !== null && JSON.stringify(row) !== draft.base)
      )
        return latest;
      return demoReducer(latest, { type: "save-stock", prize });
    });
  }
  const sortHeader = (id: SortKey, children: string) => (
    <th aria-sort={sort.key === id ? sort.direction : "none"}>
      <button
        type="button"
        className="ghost-sort"
        onClick={() =>
          setSort((previous) =>
            previous.key === id
              ? {
                  key: id,
                  direction:
                    previous.direction === "ascending"
                      ? "descending"
                      : "ascending",
                }
              : { key: id, direction: "ascending" },
          )
        }
      >
        {children}
        <span aria-hidden="true">
          {sort.key === id
            ? sort.direction === "ascending"
              ? " ▲"
              : " ▼"
            : " ↕"}
        </span>
      </button>
    </th>
  );
  function renderFormRow() {
    return !draft ? null : (
      <tr className="ghost-editor-row">
        <td colSpan={16}>
          <form className="ghost-inline-form" onSubmit={save}>
            <div className="ghost-edit-heading">
              <h3>
                {draft.base === null
                  ? "NEW PRIZE"
                  : `EDIT · ${draft.prize.name || "UNTITLED"}`}
              </h3>
              <span className="ghost-en">EN ONLY</span>
            </div>
            <div className="ghost-form-fields">
              <label>
                NAME
                <input
                  aria-label="Prize name"
                  value={draft.prize.name}
                  maxLength={160}
                  required
                  onChange={(event) => update({ name: event.target.value })}
                />
              </label>
              <label>
                SET
                <select
                  aria-label="Prize set"
                  value={draft.prize.setId ?? ""}
                  onChange={(event) =>
                    update({ setId: event.target.value || null })
                  }
                >
                  <option value="">PROMO / CUSTOM</option>
                  {setCatalog.map((set) => (
                    <option key={set.id} value={set.id}>
                      #{String(set.number).padStart(2, "0")} {set.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                TYPE
                <select
                  aria-label="Prize type"
                  value={formatOf(draft.prize)}
                  onChange={(event) =>
                    changeFormat(event.target.value as Format)
                  }
                >
                  {formats.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                DETAIL
                <input
                  aria-label="Prize detail"
                  value={draft.prize.detail}
                  maxLength={240}
                  required
                  onChange={(event) => update({ detail: event.target.value })}
                />
              </label>
              <label>
                TOTAL REWARD UNITS
                <input
                  aria-label="Total reward units"
                  type="number"
                  min={reservedFor(state, draft.prize.id)}
                  max="1000000"
                  step="1"
                  required
                  value={draft.quantity}
                  onChange={(event) =>
                    setDraft({ ...draft, quantity: event.target.value })
                  }
                />
              </label>
              <label>
                DEMO VALUE · CR
                <input
                  aria-label="Demo value in credits"
                  type="number"
                  min="0"
                  max="100000"
                  step="0.01"
                  required
                  value={draft.value}
                  onChange={(event) =>
                    setDraft({ ...draft, value: event.target.value })
                  }
                />
              </label>
              <fieldset className="ghost-tier-picker">
                <legend>MACHINES · SELECT ANY</legend>
                {tiers.map((id) => (
                  <label key={id} className={`admin-tier ${id}`}>
                    <input
                      type="checkbox"
                      checked={draft.prize.machineIds.includes(id)}
                      onChange={(event) =>
                        update({
                          machineIds: tiers.filter((tierId) =>
                            tierId === id
                              ? event.target.checked
                              : draft.prize.machineIds.includes(tierId),
                          ),
                        })
                      }
                    />
                    {id}
                  </label>
                ))}
              </fieldset>
              <label>
                AVAILABILITY
                <select
                  value={availabilityOf(draft.prize)}
                  onChange={(event) =>
                    update({ availability: event.target.value as Availability })
                  }
                >
                  <option value="active">ACTIVE</option>
                  <option value="paused">PAUSED</option>
                  <option value="retired">RETIRED</option>
                </select>
              </label>
              <label className="ghost-event-check">
                <input
                  type="checkbox"
                  checked={eventOf(draft.prize)}
                  onChange={(event) =>
                    update({ specialEvent: event.target.checked })
                  }
                />{" "}
                EVENT REWARD
              </label>
              <label className="ghost-span-2">
                IMAGE PATH
                <input
                  aria-label="Product image path"
                  placeholder={expectedProductImagePath(draft.prize)}
                  value={draft.prize.imagePath ?? ""}
                  maxLength={240}
                  onChange={(event) =>
                    update({ imagePath: event.target.value || null })
                  }
                />
              </label>
              <details
                className="ghost-market-details ghost-span-2"
                key={draft.prize.id}
              >
                <summary>
                  CARDMARKET · EN ·{" "}
                  {draft.marketPrice ? `€${draft.marketPrice}` : "NOT SET"}
                </summary>
                <div className="ghost-market-grid">
                  <label className="ghost-span-2">
                    PRODUCT LINK
                    <input
                      aria-label="Cardmarket product link"
                      type="url"
                      placeholder="https://www.cardmarket.com/en/Lorcana/Products/…"
                      value={draft.prize.cardmarketUrl ?? ""}
                      onChange={(event) => {
                        update({ cardmarketUrl: event.target.value || null });
                        setDraft((value) =>
                          value ? { ...value, confirmedEnglish: false } : value,
                        );
                      }}
                    />
                  </label>
                  <label>
                    REFERENCE · EUR
                    <input
                      aria-label="Cardmarket reference in EUR"
                      type="number"
                      min="0"
                      max="100000"
                      step="0.01"
                      placeholder="Not set"
                      value={draft.marketPrice}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          marketPrice: event.target.value,
                          confirmedEnglish: false,
                        })
                      }
                    />
                  </label>
                  <p>
                    LAST CHECKED
                    <br />
                    <strong>
                      {draft.prize.marketCheckedAt
                        ? new Date(
                            draft.prize.marketCheckedAt,
                          ).toLocaleDateString("en-GB")
                        : "NOT CHECKED"}
                    </strong>
                  </p>
                  <label className="ghost-english-check ghost-span-2">
                    <input
                      type="checkbox"
                      checked={draft.confirmedEnglish}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          confirmedEnglish: event.target.checked,
                        })
                      }
                    />
                    I checked English listings only
                  </label>
                </div>
              </details>
            </div>
            {changedElsewhere && (
              <p className="admin-error">
                Updated in another tab.{" "}
                <button
                  type="button"
                  className="ghost-inline-button"
                  onClick={() => current && edit(current)}
                >
                  Reload prize
                </button>
              </p>
            )}
            {error && (
              <p className="admin-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="ghost-save-notice" role="status">
                {notice}
              </p>
            )}
            <div className="ghost-save-actions">
              <button
                className="admin-primary"
                disabled={!ready || !!pending || changedElsewhere}
              >
                {pending ? "SAVING…" : "SAVE PRIZE"}
              </button>
              <button
                className="admin-secondary"
                type="button"
                disabled={!!pending}
                onClick={() => {
                  setDraft(null);
                  setError("");
                  setNotice("");
                }}
              >
                CANCEL
              </button>
              <small>
                {reservedFor(state, draft.prize.id)} reserved · changes stay in
                this browser
              </small>
            </div>
          </form>
        </td>
      </tr>
    );
  }
  return (
    <section
      className="admin-panel ghost-panel"
      aria-label="Ghost stock editor"
    >
      <div className="admin-panel-title">
        <div>
          <h2>
            GHOST STOCK <span className="ghost-en">EN</span>
          </h2>
          <p>
            {catalog.length} PRIZES · {number(totalAvailable)} UNRESERVED ·
            FICTIONAL
          </p>
        </div>
        <button
          className="admin-primary"
          onClick={addPrize}
          disabled={!ready || !!pending || draft?.base === null}
        >
          + ADD PRIZE
        </button>
      </div>
      <div className="ghost-filters">
        <label>
          <span className="sr-only">Find ghost prize</span>
          <input
            type="search"
            placeholder="Search set, prize, detail…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>SET</span>
          <select
            value={setFilter}
            onChange={(event) => setSetFilter(event.target.value)}
          >
            <option value="all">ALL SETS</option>
            {setCatalog.map((set) => (
              <option key={set.id} value={set.id}>
                #{String(set.number).padStart(2, "0")}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>TYPE</span>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value)}
          >
            <option value="all">ALL TYPES</option>
            {formats.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>MACHINE</span>
          <select
            value={machine}
            onChange={(event) => setMachine(event.target.value)}
          >
            <option value="all">ALL</option>
            {tiers.map((id) => (
              <option key={id} value={id}>
                {id.toUpperCase()}
              </option>
            ))}
            <option value="event">EVENT</option>
          </select>
        </label>
        <label>
          <span>STATUS</span>
          <select
            value={stockStatus}
            onChange={(event) => setStockStatus(event.target.value)}
          >
            <option value="all">ALL</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="PAUSED">PAUSED</option>
            <option value="RETIRED">RETIRED</option>
            <option value="OUT OF STOCK">OUT OF STOCK</option>
            <option value="UNASSIGNED">UNASSIGNED</option>
            <option value="EVENT ONLY">EVENT ONLY</option>
          </select>
        </label>
      </div>
      <div ref={tableViewport} className="admin-table-wrap ghost-table-wrap">
        <table className="admin-table ghost-table">
          <thead>
            <tr>
              <th>PHOTO</th>
              {sortHeader("set", "SET #")}
              {sortHeader("name", "NAME")}
              {sortHeader("type", "ITEM TYPE")}
              {sortHeader("amount", "AMOUNT")}
              {sortHeader("total", "TOTAL")}
              <th>RESERVED</th>
              {sortHeader("available", "AVAILABLE")}
              {tiers.map((id) => (
                <th key={id}>{id.toUpperCase()}</th>
              ))}
              <th>EVENT</th>
              {sortHeader("value", "VALUE CR")}
              <th>EUR REF</th>
              <th>STATUS</th>
              <th>EDIT</th>
            </tr>
          </thead>
          <tbody>
            {draft?.base === null && renderFormRow()}
            {matching.map((prize) => (
              <Fragment key={prize.id}>
                <tr
                  className={
                    draft?.prize.id === prize.id ? "ghost-selected" : undefined
                  }
                >
                  <td>
                    <ProductImage prize={prize} className="ghost-thumb" />
                  </td>
                  <td>#{String(setNumber(prize) ?? 0).padStart(2, "0")}</td>
                  <th scope="row">
                    {prize.name}
                    <small>{prize.detail}</small>
                  </th>
                  <td>{labelOf(prize)}</td>
                  <td>{amountOf(prize)}</td>
                  <td>{number(prize.startingQuantity)}</td>
                  <td>{number(reservedFor(state, prize.id))}</td>
                  <td>{number(remainingStock(state, prize.id))}</td>
                  {tiers.map((id) => (
                    <td key={id}>
                      <input
                        aria-label={`${id} machine for ${prize.name}`}
                        className="ghost-quick-toggle"
                        type="checkbox"
                        checked={prize.machineIds.includes(id)}
                        disabled={
                          !ready || !!pending || draft?.prize.id === prize.id
                        }
                        onChange={() => quickToggle(prize.id, id)}
                      />
                    </td>
                  ))}
                  <td>
                    <input
                      aria-label={`Event assignment for ${prize.name}`}
                      className="ghost-quick-toggle"
                      type="checkbox"
                      checked={eventOf(prize)}
                      disabled={
                        !ready || !!pending || draft?.prize.id === prize.id
                      }
                      onChange={() => quickEventToggle(prize.id)}
                    />
                  </td>
                  <td>{number(prize.value)}</td>
                  <td>
                    {prize.marketPriceEur === null
                      ? "—"
                      : `€${number(prize.marketPriceEur)}`}
                  </td>
                  <td>
                    <span
                      className={`ghost-status ${statusOf(state, prize).toLowerCase().replaceAll(" ", "-")}`}
                    >
                      {statusOf(state, prize)}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="admin-secondary ghost-edit-button"
                      aria-expanded={draft?.prize.id === prize.id}
                      onClick={() =>
                        draft?.prize.id === prize.id
                          ? setDraft(null)
                          : edit(prize)
                      }
                      disabled={!!pending}
                    >
                      {draft?.prize.id === prize.id ? "CLOSE" : "EDIT"}
                    </button>
                  </td>
                </tr>
                {draft?.base !== null &&
                  draft?.prize.id === prize.id &&
                  renderFormRow()}
              </Fragment>
            ))}
          </tbody>
        </table>
        {matching.length === 0 && (
          <p className="admin-empty-result">No matching prizes.</p>
        )}
      </div>
      <div className="ghost-ledger-note">
        {matching.length} SHOWN · 1 BUNDLE = 1 REWARD UNIT · STOCK SHARED ACROSS
        MACHINES · THIS BROWSER ONLY
      </div>
    </section>
  );
}
