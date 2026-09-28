import { useState } from "react";
import { FOCUS_LABELS, formatDate, formatNumber, PERSON_FOCUS_LABELS, type SavedPageKind, type SavedPageVM, type SavedPagesVM } from "@lasso/spec";
import type { ActionResult, ViewAction } from "../types.js";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";
import { Tabs } from "./Tabs.js";
import { useToast } from "./Toast.js";
import { usePrintMode } from "../print.js";

/** Regel 9: over 8 gemte sider vises de 8 nyeste + "Se alle N". */
const COLLAPSED_ROWS = 8;

export const SAVED_PAGES_EMPTY =
  "Du har ingen gemte sider endnu. Gem en virksomhed eller person med Gem-knappen øverst på siden, eller sig 'gem den' til Claude.";

type Filter = "all" | SavedPageKind;

const count = (n: number) => `${formatNumber(n)} ${n === 1 ? "gemt side" : "gemte sider"}`;

/** "Virksomhed, CVR 34580820, fokus: Økonomi, sendt til Lasso". Manuelt gemte sider nævner ikke oprindelsen. */
function describe(p: SavedPageVM): string {
  const parts = [p.kind === "company" ? (p.cvr ? `Virksomhed, CVR ${p.cvr}` : "Virksomhed") : "Person"];
  // Overblik er standardvisningen og siger intet; ukendte fokusnavne udelades.
  const labels: Record<string, string> = p.kind === "person" ? PERSON_FOCUS_LABELS : FOCUS_LABELS;
  if (p.focus && p.focus !== "overblik" && Object.prototype.hasOwnProperty.call(labels, p.focus)) parts.push(`fokus: ${labels[p.focus]}`);
  if (p.origin === "send" || p.origin === "link") parts.push("sendt til Lasso");
  return parts.join(", ");
}

export interface SavedPagesProps {
  list?: SavedPagesVM;
  title?: string;
  error?: string;
  /** Værten åbner siden eller fjerner den. Et svar med ok: false ruller "fjernet" tilbage. */
  onAction?: (a: ViewAction) => Promise<ActionResult | void> | void;
  canDrillDown: boolean;
  canRemove: boolean;
}

/**
 * Gemte sider (gem-laget, docs/gem-lag.md). Samme rækkemønster som personlisten (11):
 * navn 14/500 alene, hvad siden er i en grå linje under, gemt-dato til højre. Filter
 * "Alle / Virksomheder / Personer" som niveau 3-faner, kun når listen har begge slags.
 * "Fjern" er en lille tekstknap; rækken vises straks som fjernet (dæmpet + ordet
 * "fjernet"), og værten opdaterer listen bagefter. Ingen ikoner, badges eller initialer.
 */
export function SavedPages({ list, title, error, onAction, canDrillDown, canRemove }: SavedPagesProps) {
  const heading = title ?? "Gemte sider";
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState(usePrintMode());
  // Optimistisk fjernet, bundet til den liste, klikket skete i: når værten sender en ny liste, gælder den.
  const [removed, setRemoved] = useState<{ list?: SavedPagesVM; ids: ReadonlySet<string> }>({ ids: new Set() });

  if (!list) {
    return (
      <Section title={heading}>
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={240} />}
      </Section>
    );
  }
  if (list.pages.length === 0) {
    return (
      <Section title={heading}>
        <DataState state="empty" reason={SAVED_PAGES_EMPTY} />
      </Section>
    );
  }

  const gone = removed.list === list ? removed.ids : new Set<string>();
  const mark = (id: string, on: boolean) =>
    setRemoved((prev) => {
      const ids = new Set(prev.list === list ? prev.ids : []);
      if (on) ids.add(id);
      else ids.delete(id);
      return { list, ids };
    });

  const remove = async (p: SavedPageVM) => {
    mark(p.lassoId, true);
    let res: ActionResult | void;
    try {
      res = await onAction?.({ kind: "remove-saved-page", lassoId: p.lassoId });
    } catch (e) {
      res = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    if (res && !res.ok) {
      mark(p.lassoId, false);
      toast.show({ text: res.error, tone: "error", action: { label: "Prøv igen", onClick: () => void remove(p) } });
    }
  };

  const hasBoth = list.pages.some((p) => p.kind === "company") && list.pages.some((p) => p.kind === "person");
  const active: Filter = hasBoth ? filter : "all";
  const rows = active === "all" ? list.pages : list.pages.filter((p) => p.kind === active);
  // Niveau 3-faner (29): skifter kun elementets egen visning.
  const toggle = hasBoth ? (
    <Tabs
      level={3}
      ariaLabel="Vis gemte sider"
      items={[
        { id: "all", label: "Alle" },
        { id: "company", label: "Virksomheder" },
        { id: "person", label: "Personer" },
      ]}
      value={active}
      onChange={(id) => setFilter(id as Filter)}
    />
  ) : null;
  const subtitle = list.pages.length < list.total ? `${count(list.total)}, de ${formatNumber(list.pages.length)} nyeste vises` : count(list.total);
  const foldable = rows.length > COLLAPSED_ROWS;
  const visible = foldable && !expanded ? rows.slice(0, COLLAPSED_ROWS) : rows;

  return (
    <Section title={heading} subtitle={subtitle} action={toggle} className="lasso-savedpages">
      <ul className="lasso-rows">
        {visible.map((p) => {
          const isGone = gone.has(p.lassoId);
          return (
            <li key={p.lassoId} className={`lasso-row ${isGone ? "lasso-row--ended" : ""}`}>
              <div className="lasso-row__main">
                <div className="lasso-row__name">
                  {canDrillDown && onAction && !isGone ? (
                    <button
                      type="button"
                      className="lasso-link lasso-row__open"
                      onClick={() => void onAction({ kind: p.kind === "person" ? "open-person" : "open-company", lassoId: p.lassoId, name: p.name })}
                    >
                      {p.name}
                    </button>
                  ) : (
                    p.name
                  )}
                </div>
                <div className="lasso-row__sub">{describe(p)}</div>
                {p.note ? <div className="lasso-row__sub lasso-savedpages__note">{p.note}</div> : null}
              </div>
              <div className="lasso-row__side lasso-savedpages__side">
                <span>gemt {formatDate(p.savedAt)}</span>
                {isGone ? (
                  <span className="lasso-savedpages__removed" role="status">
                    fjernet
                  </span>
                ) : canRemove && onAction ? (
                  <button type="button" className="lasso-link lasso-savedpages__remove" aria-label={`Fjern ${p.name} fra gemte`} onClick={() => void remove(p)}>
                    Fjern
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {foldable ? (
        <button type="button" className="lasso-link lasso-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Vis færre" : `Se alle ${formatNumber(rows.length)}`}
        </button>
      ) : null}
      <SourceLine source="Gemt i Lasso" />
    </Section>
  );
}
