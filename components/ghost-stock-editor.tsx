"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { setCatalog, type StockPrize } from "@/lib/catalog";
import {
  demoReducer,
  getStockCatalog,
  remainingStock,
  type DemoState,
  type MachineId,
} from "@/lib/demo";
import { copyStockPrize, isCardmarketReference } from "@/lib/ghost-stock";

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
type Draft = {
  prize: StockPrize;
  base: string | null;
  quantity: string;
  value: string;
  marketPrice: string;
  confirmedEnglish: boolean;
};
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
  formats.find(([id]) => id === formatOf(prize))?.[1];
function draftOf(prize: StockPrize, base: string | null): Draft {
  return {
    prize: { ...prize, machineIds: [...prize.machineIds] },
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
  const catalog = getStockCatalog(state);
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("all");
  const [format, setFormat] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<StockPrize | null>(null);
  const editorRef = useRef<HTMLFormElement>(null);
  const current = draft
    ? catalog.find((prize) => prize.id === draft.prize.id)
    : undefined;
  const changedElsewhere =
    !!draft &&
    (draft.base === null ? !!current : JSON.stringify(current) !== draft.base);
  const reserved = draft
    ? state.items.filter(
        (item) => item.prize.id === draft.prize.id && item.status !== "sold",
      ).length
    : 0;
  const available = catalog.reduce(
    (sum, prize) => sum + remainingStock(state, prize.id),
    0,
  );
  const matching = catalog
    .filter((prize) => {
      const text =
        `${prize.name} ${prize.detail} ${setNumber(prize) ?? "promo"} ${labelOf(prize)}`.toLowerCase();
      return (
        text.includes(query.toLowerCase()) &&
        (tier === "all" ||
          (tier === "paused"
            ? prize.machineIds.length === 0
            : prize.machineIds.includes(tier as MachineId))) &&
        (format === "all" || formatOf(prize) === format)
      );
    })
    .sort((a, b) => (setNumber(a) ?? 99) - (setNumber(b) ?? 99));

  useEffect(() => {
    if (!pending) return;
    const saved = getStockCatalog(state).find(
      (prize) => prize.id === pending.id,
    );
    if (JSON.stringify(saved) === JSON.stringify(pending)) {
      setDraft(draftOf(saved!, JSON.stringify(saved)));
      setNotice("SAVED · Arcade updated in this browser.");
      setError("");
    } else {
      setError("Stock changed while saving. Reload this prize and try again.");
    }
    setPending(null);
  }, [state, pending]);

  function edit(prize: StockPrize, isNew = false) {
    setDraft(draftOf(prize, isNew ? null : JSON.stringify(prize)));
    setError("");
    setNotice("");
    if (window.matchMedia("(max-width: 800px)").matches) {
      requestAnimationFrame(() =>
        editorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      );
    }
  }
  function update(patch: Partial<StockPrize>) {
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
    setNotice("");
  }
  function addPrize() {
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
      },
      true,
    );
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || !ready || pending) return;
    setNotice("");
    if (changedElsewhere)
      return setError(
        "This prize changed in another tab. Reload it before saving.",
      );
    const quantity = Number(draft.quantity);
    const value = Number(draft.value);
    const marketPriceEur =
      draft.marketPrice.trim() === "" ? null : Number(draft.marketPrice);
    const cardmarketUrl = draft.prize.cardmarketUrl?.trim() || null;
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
    });
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
            {catalog.length} PRIZES · {number(available)} AVAILABLE · FICTIONAL
          </p>
        </div>
        <button
          className="admin-primary"
          onClick={addPrize}
          disabled={!ready || !!pending}
        >
          + ADD PRIZE
        </button>
      </div>
      <div className="ghost-workspace">
        <div className="ghost-browser">
          <div className="ghost-filters">
            <label>
              <span className="sr-only">Find ghost prize</span>
              <input
                type="search"
                placeholder="Set # or prize…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label>
              <span className="sr-only">Filter machine</span>
              <select
                value={tier}
                onChange={(event) => setTier(event.target.value)}
              >
                <option value="all">ALL MACHINES</option>
                {tiers.map((id) => (
                  <option key={id} value={id}>
                    {id.toUpperCase()}
                  </option>
                ))}
                <option value="paused">PAUSED</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Filter prize type</span>
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
          </div>
          <div className="admin-table-wrap ghost-table-wrap">
            <table className="admin-table ghost-table">
              <thead>
                <tr>
                  <th># / PRIZE</th>
                  <th>MACHINES</th>
                  <th>LEFT</th>
                  <th>VALUE</th>
                </tr>
              </thead>
              <tbody>
                {matching.map((prize) => (
                  <tr
                    key={prize.id}
                    className={
                      draft?.prize.id === prize.id ? "ghost-selected" : ""
                    }
                  >
                    <th scope="row">
                      <button
                        className="ghost-row-button"
                        aria-pressed={draft?.prize.id === prize.id}
                        onClick={() => edit(prize)}
                        disabled={!!pending}
                      >
                        <span className="ghost-set-number">
                          {setNumber(prize)
                            ? `#${String(setNumber(prize)).padStart(2, "0")}`
                            : "—"}
                        </span>
                        <span>
                          {prize.name}
                          <small>{labelOf(prize)} · EN</small>
                        </span>
                      </button>
                    </th>
                    <td>
                      <div className="ghost-machine-tags">
                        {prize.machineIds.length ? (
                          prize.machineIds.map((id) => (
                            <span className={`admin-tier ${id}`} key={id}>
                              {id}
                            </span>
                          ))
                        ) : (
                          <span className="ghost-muted">PAUSED</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {number(remainingStock(state, prize.id))}
                      <small>
                        {prize.startingQuantity -
                          remainingStock(state, prize.id)}{" "}
                        reserved
                      </small>
                    </td>
                    <td>
                      {number(prize.value)} CR
                      <small>
                        {prize.marketPriceEur === null
                          ? "EUR not set"
                          : `€${number(prize.marketPriceEur)} ref.`}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {matching.length === 0 && (
              <p className="admin-empty-result">No matching prizes.</p>
            )}
          </div>
          <div className="ghost-ledger-note">
            {matching.length} SHOWN · 1 BUNDLE = 1 REWARD UNIT · STOCK SHARED
            ACROSS MACHINES
          </div>
        </div>
        <div className="ghost-edit-pane">
          {!draft ? (
            <div className="ghost-edit-empty">
              <span aria-hidden="true">✎</span>
              <h3>SELECT A PRIZE</h3>
              <p>Edit stock, value and machines.</p>
              <p>
                Changes stay in this browser.
                <br />
                Use fictional quantities only.
              </p>
            </div>
          ) : (
            <form className="ghost-form" ref={editorRef} onSubmit={save}>
              <div className="ghost-edit-heading">
                <h3>{draft.base === null ? "NEW PRIZE" : "EDIT PRIZE"}</h3>
                <span className="ghost-en">EN ONLY</span>
              </div>
              <div className="ghost-form-fields">
                <label className="ghost-full">
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
                <label className="ghost-full">
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
                    min={reserved}
                    max={1_000_000}
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
                    max={100_000}
                    step="0.01"
                    required
                    value={draft.value}
                    onChange={(event) =>
                      setDraft({ ...draft, value: event.target.value })
                    }
                  />
                </label>
                <p className="ghost-full ghost-muted">
                  {reserved} reserved · each bundle or box counts once
                </p>
                <fieldset className="ghost-full ghost-tier-picker">
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
                  <small>No machines selected = paused</small>
                </fieldset>
                <details
                  className="ghost-full ghost-market-details"
                  key={draft.prize.id}
                >
                  <summary>
                    CARDMARKET · EN ·{" "}
                    {draft.marketPrice ? `€${draft.marketPrice}` : "NOT SET"}
                  </summary>
                  <div className="ghost-form-fields">
                    <div className="ghost-full ghost-market-heading">
                      <strong>CARDMARKET · EN REFERENCE</strong>
                      <a
                        href={
                          isCardmarketReference(draft.prize.cardmarketUrl)
                            ? draft.prize.cardmarketUrl!
                            : "https://www.cardmarket.com/en/Lorcana/Products"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        CHECK ↗
                      </a>
                    </div>
                    <label className="ghost-full">
                      PRODUCT LINK
                      <input
                        aria-label="Cardmarket product link"
                        type="url"
                        placeholder="https://www.cardmarket.com/en/Lorcana/Products/…"
                        value={draft.prize.cardmarketUrl ?? ""}
                        onChange={(event) => {
                          update({ cardmarketUrl: event.target.value || null });
                          setDraft((value) =>
                            value
                              ? { ...value, confirmedEnglish: false }
                              : value,
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
                        max={100_000}
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
                    <div className="ghost-check-date">
                      <span>LAST CHECKED</span>
                      <strong>
                        {draft.prize.marketCheckedAt
                          ? new Date(
                              draft.prize.marketCheckedAt,
                            ).toLocaleDateString("en-GB")
                          : "NOT CHECKED"}
                      </strong>
                    </div>
                    <label className="ghost-full ghost-english-check">
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
                      <span>I checked English listings only</span>
                    </label>
                    <p className="ghost-full ghost-muted">
                      Manual reference · no live sync or EUR → CR conversion
                    </p>
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
                  CLOSE
                </button>
              </div>
              <p className="ghost-local-note">
                THIS BROWSER ONLY · FICTIONAL STOCK
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
