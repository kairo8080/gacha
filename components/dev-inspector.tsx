"use client";

import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Annotation = {
  id: string;
  name: string;
  left: number;
  top: number;
  cueLeft: number;
  cueDirection: "up" | "down";
};

const UI_REGIONS = [
  ["A01", "Header"],
  ["A02", "Brand"],
  ["A03", "Navigation"],
  ["A04", "Wallet"],
  ["A05", "Demo note"],
  ["A06", "Reset"],
  ["A07", "Main"],
  ["A08", "Arcade panel"],
  ["A09", "Toolbar"],
  ["A10", "Scene"],
  ["A11", "Scene sign"],
  ["A12", "Machine group"],
  ["A13", "Common"],
  ["A14", "Rare"],
  ["A15", "Epic"],
  ["A16", "Character"],
  ["A17", "Machine tabs"],
  ["A18", "Machine details"],
  ["A19", "Pull"],
  ["A20", "Stock"],
  ["A21", "Inline panel"],
  ["A22", "Feedback"],
  ["A23", "Collection"],
  ["A24", "Claw animation"],
] as const;

const BADGE_WIDTH = 38;
const BADGE_HEIGHT = 21;
const BADGE_GAP = 4;
const BADGE_SLOTS = [
  [0, 0],
  [42, 0],
  [-42, 0],
  [0, -25],
  [0, 25],
  [42, -25],
  [-42, -25],
  [42, 25],
  [-42, 25],
] as const;

function isRendered(element: HTMLElement, root: HTMLElement) {
  for (
    let current: HTMLElement | null = element;
    current;
    current = current.parentElement
  ) {
    const style = window.getComputedStyle(current);
    if (
      current.hidden ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse"
    ) {
      return false;
    }
    if (current === root) return true;
  }
  return false;
}

function overlaps(left: number, top: number, annotations: Annotation[]) {
  return annotations.some(
    (annotation) =>
      left < annotation.left + BADGE_WIDTH + BADGE_GAP &&
      left + BADGE_WIDTH + BADGE_GAP > annotation.left &&
      top < annotation.top + BADGE_HEIGHT + BADGE_GAP &&
      top + BADGE_HEIGHT + BADGE_GAP > annotation.top,
  );
}

export default function DevInspector({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [labelsVisible, setLabelsVisible] = useState(true);

  const measure = useCallback(() => {
    const stage = stageRef.current;
    const arcadeRoot = stage?.querySelector<HTMLElement>(".app-shell");
    if (!stage || !arcadeRoot) return;

    const stageRect = stage.getBoundingClientRect();
    const visibleRegions = [
      arcadeRoot,
      ...Array.from(
        arcadeRoot.querySelectorAll<HTMLElement>("[data-ui][data-ui-name]"),
      ),
    ]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element,
          id: element.dataset.ui ?? "",
          name: element.dataset.uiName ?? "",
          rect,
        };
      })
      .filter(
        (region) =>
          region.id &&
          region.name &&
          region.rect.width > 0 &&
          region.rect.height > 0 &&
          isRendered(region.element, arcadeRoot),
      )
      .sort((first, second) =>
        first.id.localeCompare(second.id, undefined, { numeric: true }),
      );

    const stageWidth = Math.max(0, Math.round(stageRect.width));
    const stageHeight = Math.max(0, Math.round(stageRect.height));
    const next = visibleRegions.reduce<Annotation[]>((placed, region) => {
      const anchorLeft = Math.round(region.rect.left - stageRect.left);
      const anchorTop = Math.round(region.rect.top - stageRect.top);
      const baseLeft = Math.min(
        Math.max(BADGE_GAP, anchorLeft),
        Math.max(BADGE_GAP, stageWidth - BADGE_WIDTH - BADGE_GAP),
      );
      const baseTop = Math.min(
        Math.max(BADGE_GAP, anchorTop - BADGE_HEIGHT - 8),
        Math.max(BADGE_GAP, stageHeight - BADGE_HEIGHT - BADGE_GAP),
      );
      const slot = BADGE_SLOTS.map(([offsetLeft, offsetTop]) => ({
        left: Math.min(
          Math.max(BADGE_GAP, baseLeft + offsetLeft),
          Math.max(BADGE_GAP, stageWidth - BADGE_WIDTH - BADGE_GAP),
        ),
        top: Math.min(
          Math.max(BADGE_GAP, baseTop + offsetTop),
          Math.max(BADGE_GAP, stageHeight - BADGE_HEIGHT - BADGE_GAP),
        ),
      })).find(
        (candidate) => !overlaps(candidate.left, candidate.top, placed),
      ) ?? {
        left: baseLeft,
        top: Math.min(
          Math.max(
            BADGE_GAP,
            baseTop + placed.length * (BADGE_HEIGHT + BADGE_GAP),
          ),
          Math.max(BADGE_GAP, stageHeight - BADGE_HEIGHT - BADGE_GAP),
        ),
      };

      placed.push({
        id: region.id,
        name: region.name,
        left: slot.left,
        top: slot.top,
        cueLeft: Math.min(BADGE_WIDTH - 5, Math.max(5, anchorLeft - slot.left)),
        cueDirection: slot.top <= anchorTop ? "down" : "up",
      });
      return placed;
    }, []);

    setAnnotations(next);
  }, []);

  const scheduleMeasure = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      measure();
    });
  }, [measure]);

  useEffect(() => {
    const stage = stageRef.current;
    const arcadeRoot = stage?.querySelector<HTMLElement>(".app-shell");
    if (!stage || !arcadeRoot) return;

    const mutationObserver = new MutationObserver(scheduleMeasure);
    mutationObserver.observe(arcadeRoot, {
      attributes: true,
      attributeFilter: ["class", "style", "hidden"],
      childList: true,
      subtree: true,
    });

    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(arcadeRoot);
    window.addEventListener("resize", scheduleMeasure);
    stage.addEventListener("scroll", scheduleMeasure, true);
    const fonts = document.fonts;
    fonts?.ready.then(scheduleMeasure);
    fonts?.addEventListener("loadingdone", scheduleMeasure);
    scheduleMeasure();

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      stage.removeEventListener("scroll", scheduleMeasure, true);
      fonts?.removeEventListener("loadingdone", scheduleMeasure);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [scheduleMeasure]);

  return (
    <div className="dev-inspector">
      <div className="dev-inspector-stage" ref={stageRef}>
        {children}
        {labelsVisible && annotations.length > 0 && (
          <div className="dev-inspector-labels" aria-hidden="true">
            {annotations.map((annotation) => (
              <span
                className={`dev-inspector-label cue-${annotation.cueDirection}`}
                key={annotation.id}
                style={
                  {
                    left: annotation.left,
                    top: annotation.top,
                    "--dev-cue-left": `${annotation.cueLeft}px`,
                  } as CSSProperties
                }
              >
                {annotation.id}
              </span>
            ))}
          </div>
        )}
      </div>

      <section className="dev-inspector-legend" aria-labelledby="ui-map-title">
        <div className="dev-inspector-legend-heading">
          <div>
            <p className="dev-inspector-kicker">Development reference</p>
            <h1 id="ui-map-title">Arcade UI map</h1>
          </div>
          <button
            type="button"
            className="dev-inspector-toggle"
            aria-pressed={labelsVisible}
            onClick={() => setLabelsVisible((visible) => !visible)}
          >
            Labels: {labelsVisible ? "shown" : "hidden"}
          </button>
        </div>
        <p className="dev-inspector-copy">
          Use the labels on the working arcade to reference a region in review;
          for example, A16 identifies the character in the scene.
        </p>
        <ol className="dev-inspector-list">
          {UI_REGIONS.map(([id, name]) => (
            <li key={id}>
              <code>{id}</code>
              <span>{name}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
