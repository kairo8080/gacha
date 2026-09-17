"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Check, Package, RotateCcw, Truck } from "@/components/pixel-icons";
import {
  demoReducer,
  getShippingStage,
  resaleValue,
  SHIPPING_UNLOCK_DAY,
  type DemoState,
  type InventoryItem,
  type MachineId,
} from "@/lib/demo";

type InventoryFilter =
  "collection" | "sold" | "redeemed" | "shipping" | "history";

const accents: Record<MachineId, string> = {
  common: "#40c7f4",
  rare: "#c073f5",
  epic: "#ffd34d",
};

const credits = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

function statusLabel(item: InventoryItem, demoDay: number) {
  if (item.status === "queued")
    return getShippingStage(item, demoDay) === "ready"
      ? "READY TO SHIP"
      : "QUEUED";
  if (item.status === "shipping") return "SHIPPING · DEMO";
  if (item.status === "redeemed") return "REDEEMED";
  if (item.status === "sold") return "SOLD · DEMO";
  return "IN COLLECTION";
}

export function PlayerInventory({
  state,
  setState,
  demoDay,
  onBack,
}: {
  state: DemoState;
  setState: Dispatch<SetStateAction<DemoState>>;
  demoDay: number;
  onBack: () => void;
}) {
  const [filter, setFilter] = useState<InventoryFilter>("collection");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "value">("newest");
  const [confirm, setConfirm] = useState<{
    item: InventoryItem;
    action: "redeem" | "queue";
  } | null>(null);
  const confirmDialog = useRef<HTMLDialogElement>(null);
  const confirmTrigger = useRef<HTMLButtonElement | null>(null);

  const collection = state.items.filter((item) => item.status !== "sold");
  const best = state.items.reduce<InventoryItem | null>(
    (winner, item) =>
      !winner || item.prize.value > winner.prize.value ? item : winner,
    null,
  );
  const collectionValue = collection.reduce(
    (total, item) => total + item.prize.value,
    0,
  );
  const soldValue = state.items
    .filter((item) => item.status === "sold")
    .reduce((total, item) => total + resaleValue(item.prize), 0);

  const items = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return state.items
      .filter((item) => {
        if (filter === "collection") return item.status === "held";
        if (filter === "sold") return item.status === "sold";
        if (filter === "redeemed") return item.status === "redeemed";
        if (filter === "shipping")
          return item.status === "queued" || item.status === "shipping";
        return true;
      })
      .filter((item) =>
        normalizedQuery.length === 0
          ? true
          : `${item.prize.name} ${item.prize.detail} ${item.machineId}`
              .toLowerCase()
              .includes(normalizedQuery),
      )
      .slice()
      .sort((left, right) =>
        sort === "value"
          ? right.prize.value - left.prize.value
          : Date.parse(right.createdAt) - Date.parse(left.createdAt),
      );
  }, [filter, query, sort, state.items]);

  function act(action: Parameters<typeof demoReducer>[1]) {
    setState((current) => demoReducer(current, action));
  }

  function openConfirm(
    item: InventoryItem,
    action: "redeem" | "queue",
    trigger: HTMLButtonElement,
  ) {
    confirmTrigger.current = trigger;
    setConfirm({ item, action });
  }

  function closeConfirm() {
    setConfirm(null);
    requestAnimationFrame(() => confirmTrigger.current?.focus());
  }

  useEffect(() => {
    const dialog = confirmDialog.current;
    if (!dialog) return;
    if (confirm && !dialog.open) dialog.showModal();
    if (!confirm && dialog.open) dialog.close();
  }, [confirm]);

  const counts: Record<InventoryFilter, number> = {
    collection: state.items.filter((item) => item.status === "held").length,
    sold: state.items.filter((item) => item.status === "sold").length,
    redeemed: state.items.filter((item) => item.status === "redeemed").length,
    shipping: state.items.filter(
      (item) => item.status === "queued" || item.status === "shipping",
    ).length,
    history: state.items.length,
  };
  const clearFilters = () => {
    setFilter("history");
    setQuery("");
    setSort("newest");
  };

  return (
    <section className="player-collection" aria-label="Your collection">
      <div className="collection-scoreboard">
        <div>
          <span>PULLS</span>
          <strong>{state.pulls}</strong>
        </div>
        <div>
          <span>COLLECTION VALUE</span>
          <strong>
            {credits(collectionValue)} <small>CR</small>
          </strong>
        </div>
        <div>
          <span>SOLD</span>
          <strong>
            {credits(soldValue)} <small>CR</small>
          </strong>
        </div>
        {best && (
          <div className="best-pull">
            <span>BEST PULL</span>
            <strong>
              {credits(best.prize.value)} <small>CR</small>
            </strong>
            <b>{best.prize.name}</b>
          </div>
        )}
      </div>

      <div className="collection-controls">
        <div
          className="collection-tabs"
          role="tablist"
          aria-label="Collection filters"
        >
          {(
            [
              ["collection", "Collection"],
              ["sold", "Sold"],
              ["redeemed", "Redeemed"],
              ["shipping", "Shipping"],
              ["history", "History"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={filter === id ? "active" : ""}
              onClick={() => setFilter(id)}
              role="tab"
              aria-selected={filter === id}
            >
              {label}
              <span>{counts[id]}</span>
            </button>
          ))}
        </div>
        <label className="collection-search">
          SEARCH
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="set or tier"
          />
        </label>
        <label className="collection-sort">
          SORT
          <select
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as "newest" | "value")
            }
          >
            <option value="newest">Newest</option>
            <option value="value">Value</option>
          </select>
        </label>
      </div>

      {items.length === 0 ? (
        <div className="collection-empty">
          <Package size={34} />
          {state.items.length === 0 ? (
            <>
              <h2>YOUR COLLECTION IS EMPTY.</h2>
              <p>Your actual demo pulls appear here. Start in the arcade.</p>
              <button className="primary-button" onClick={onBack}>
                Back to arcade
              </button>
            </>
          ) : query.trim() ? (
            <>
              <h2>NO MATCHING PULLS.</h2>
              <p>Try another set or tier, or clear the current filters.</p>
              <button
                className="text-button collection-clear"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <h2>NO {filter.toUpperCase()} PULLS.</h2>
              <p>Choose another filter to see your actual demo history.</p>
              <button
                className="text-button collection-clear"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="collection-grid">
          {items.map((item) => {
            const shippingStage = getShippingStage(item, demoDay);
            return (
              <article
                className="collection-card"
                key={item.id}
                style={
                  { "--tier-color": accents[item.machineId] } as CSSProperties
                }
              >
                <header>
                  <span className="tier-badge">
                    {item.machineId.toUpperCase()}
                  </span>
                  <span className={`item-status ${item.status}`}>
                    {statusLabel(item, demoDay)}
                  </span>
                </header>
                <div
                  className={`collection-symbol ${item.prize.kind}`}
                  aria-hidden="true"
                >
                  <Package size={28} />
                  <span>
                    {item.prize.kind === "graded" ? "GRADED" : "SEALED"}
                  </span>
                </div>
                <span className="collection-value">
                  {credits(item.prize.value)} <small>CR</small>
                </span>
                <h3>{item.prize.name}</h3>
                <p>{item.prize.detail}</p>
                <div className="item-trail">
                  <span>PULLED · {dateLabel(item.createdAt)}</span>
                  <span>{statusLabel(item, demoDay)}</span>
                </div>
                {item.status === "held" && (
                  <div className="collection-actions">
                    <button
                      onClick={() => act({ type: "sell", itemId: item.id })}
                    >
                      <RotateCcw size={15} />
                      Sell {credits(resaleValue(item.prize))}
                    </button>
                    <button
                      onClick={(event) =>
                        openConfirm(item, "redeem", event.currentTarget)
                      }
                    >
                      <Check size={15} />
                      Redeem
                    </button>
                  </div>
                )}
                {item.status === "redeemed" && (
                  <button
                    className="queue-button"
                    onClick={(event) =>
                      openConfirm(item, "queue", event.currentTarget)
                    }
                  >
                    <Truck size={16} />
                    Queue shipping
                  </button>
                )}
                {item.status === "queued" && (
                  <div className="queue-status">
                    <Truck size={16} />
                    {shippingStage === "ready"
                      ? "Ready to ship"
                      : `Queued · ships after day ${SHIPPING_UNLOCK_DAY}`}
                  </div>
                )}
                {item.status === "shipping" && (
                  <div className="queue-status">
                    <Truck size={16} />
                    Shipping · demo
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <dialog
        ref={confirmDialog}
        className="collection-confirm"
        aria-label={
          confirm ? `${confirm.action} item` : "Confirm collection action"
        }
        onCancel={closeConfirm}
        onClose={() => {
          if (confirm) closeConfirm();
        }}
      >
        {confirm && (
          <div>
            <span className="eyebrow">DEMO ACTION</span>
            <h2>
              {confirm.action === "redeem"
                ? "Redeem this pull?"
                : "Queue shipping?"}
            </h2>
            <p>{confirm.item.prize.name}</p>
            <p className="dialog-note">
              {confirm.action === "redeem"
                ? `Redeem unlocks the shipping queue. Shipping opens ${SHIPPING_UNLOCK_DAY} days after launch; you can queue now.`
                : `Shipping opens ${SHIPPING_UNLOCK_DAY} days after launch. This only saves a demo queue; no address or shipment is created.`}
            </p>
            <div>
              <button className="text-button" onClick={closeConfirm}>
                Cancel
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  act({ type: confirm.action, itemId: confirm.item.id });
                  closeConfirm();
                }}
              >
                {confirm.action === "redeem" ? "Redeem" : "Queue shipping"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
