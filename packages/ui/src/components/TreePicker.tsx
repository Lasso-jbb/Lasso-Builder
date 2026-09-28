import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Dialog } from "./Dialog.js";
import { Icon } from "./Icon.js";

/**
 * Trævælger (katalog 07.7, node 9O5-0): hierarkiske valg som brancher (sektion → hovedgruppe →
 * kode), regioner eller koncerner. Søgefelt øverst, træet i en ramme (radius 10) med rækker på
 * 43 px: chevron, afkrydsning, kode, navn og antal højrestillet i muted. Valgt række får koral lys
 * flade; en gren med nogle valgte børn får en delvis markering (koral med streg). Under træet et
 * valgfrit afkrydsningsfelt ("Søg også i bibrancher").
 *
 * Værdien er de øverste helt valgte knuder: vælges alle koder under "01", gemmes "01".
 * Tastatur: pil op/ned flytter, højre folder ud (eller går til første barn), venstre folder ind
 * (eller går til forælderen), mellemrum/Enter vælger. Søgningen matcher kode (præfiks) og navn og
 * viser forfædrene udfoldet.
 *
 * `TreePickerDialog` er den færdige dialog (760 px, fod med effekt-linje til venstre og
 * Annuller + "Tilføj" til højre). Mobil (< 560 px): fuldskærmsside med søgefeltet fast i toppen.
 */
export interface TreeNode {
  id: string;
  /** Fx "A", "01", "01.1". */
  code?: string;
  label: string;
  /** Antal virksomheder o.l.; vises højrestillet. Formateres med formatNumber af værten, hvis det er en tekst. */
  count?: number | string;
  children?: readonly TreeNode[];
}

type Check = "on" | "off" | "mixed";

interface Indexed {
  node: TreeNode;
  parent?: string;
  level: number;
  leaves: string[];
}

function indexTree(nodes: readonly TreeNode[]): Map<string, Indexed> {
  const map = new Map<string, Indexed>();
  const walk = (n: TreeNode, level: number, parent?: string): string[] => {
    const leaves = n.children?.length ? n.children.flatMap((c) => walk(c, level + 1, n.id)) : [n.id];
    map.set(n.id, { node: n, parent, level, leaves });
    return leaves;
  };
  nodes.forEach((n) => walk(n, 1));
  return map;
}

/** Bladene under de valgte knuder. */
export function expandSelection(nodes: readonly TreeNode[], value: readonly string[]): Set<string> {
  const idx = indexTree(nodes);
  return new Set(value.flatMap((id) => idx.get(id)?.leaves ?? []));
}

/** De øverste helt valgte knuder, i træets rækkefølge. */
export function compactSelection(nodes: readonly TreeNode[], leaves: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const walk = (n: TreeNode) => {
    const idx = indexTree([n]).get(n.id)!;
    if (idx.leaves.every((l) => leaves.has(l))) out.push(n.id);
    else n.children?.forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}

function matches(n: TreeNode, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  return (n.code ?? "").toLowerCase().startsWith(s) || n.label.toLowerCase().includes(s);
}

export interface TreePickerProps {
  nodes: readonly TreeNode[];
  /** Valgte knude-id'er (de øverste helt valgte). */
  value: readonly string[];
  onChange?: (value: string[]) => void;
  /** Udfoldede grene fra start. */
  defaultExpanded?: readonly string[];
  searchPlaceholder?: string;
  /** Styret søgetekst (ellers intern). */
  query?: string;
  onQueryChange?: (q: string) => void;
  /** Afkrydsningsfelt under træet, fx "Søg også i bibrancher". */
  extra?: { label: string; checked: boolean; onChange?: (checked: boolean) => void };
  /** Tekst i træet, når søgningen intet finder. */
  emptyText?: string;
  label?: string;
}

function Box({ state }: { state: Check }) {
  return <span className={`lasso-check lasso-check--${state}`} aria-hidden="true">{state === "on" ? <Icon name="check" size={12} /> : state === "mixed" ? <Icon name="minus" size={12} /> : null}</span>;
}

export function TreePicker({ nodes, value, onChange, defaultExpanded = [], searchPlaceholder = "Søg", query: queryProp, onQueryChange, extra, emptyText = "Ingen match. Prøv en kode eller et andet ord.", label = "Vælg" }: TreePickerProps) {
  const idx = useMemo(() => indexTree(nodes), [nodes]);
  const selected = useMemo(() => expandSelection(nodes, value), [nodes, value]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(defaultExpanded));
  const [ownQuery, setOwnQuery] = useState("");
  const query = (queryProp ?? ownQuery).trim();
  const [focusId, setFocusId] = useState<string | null>(null);
  const tree = useRef<HTMLDivElement>(null);

  const stateOf = (id: string): Check => {
    const leaves = idx.get(id)?.leaves ?? [];
    const n = leaves.filter((l) => selected.has(l)).length;
    return n === 0 ? "off" : n === leaves.length ? "on" : "mixed";
  };

  // Synlige rækker: ved søgning matchende knuder + deres forfædre (udfoldet), ellers de udfoldede grene.
  const rows = useMemo(() => {
    const out: Indexed[] = [];
    const visible = new Set<string>();
    if (query) {
      for (const [id, e] of idx) {
        if (!matches(e.node, query)) continue;
        let cur: string | undefined = id;
        while (cur) {
          visible.add(cur);
          cur = idx.get(cur)?.parent;
        }
      }
    }
    const walk = (list: readonly TreeNode[]) => {
      for (const n of list) {
        if (query && !visible.has(n.id)) continue;
        out.push(idx.get(n.id)!);
        const open = query ? (n.children ?? []).some((c) => visible.has(c.id)) : expanded.has(n.id);
        if (open && n.children) walk(n.children);
      }
    };
    walk(nodes);
    return out;
  }, [nodes, idx, expanded, query]);

  const toggle = (id: string) => {
    const leaves = idx.get(id)?.leaves ?? [];
    const next = new Set(selected);
    if (stateOf(id) === "on") leaves.forEach((l) => next.delete(l));
    else leaves.forEach((l) => next.add(l));
    onChange?.(compactSelection(nodes, next));
  };
  const setOpen = (id: string, open: boolean) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (open) n.add(id);
      else n.delete(id);
      return n;
    });
  const isOpen = (e: Indexed) => (query ? rows.some((r) => r.parent === e.node.id) : expanded.has(e.node.id));

  const current = focusId && rows.some((r) => r.node.id === focusId) ? focusId : rows[0]?.node.id;
  const focusRow = (id: string | undefined) => {
    if (!id) return;
    setFocusId(id);
    tree.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`)?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = rows.findIndex((r) => r.node.id === current);
    const row = rows[i];
    if (!row) return;
    const hasKids = Boolean(row.node.children?.length);
    if (e.key === "ArrowDown") focusRow(rows[i + 1]?.node.id);
    else if (e.key === "ArrowUp") focusRow(rows[i - 1]?.node.id);
    else if (e.key === "Home") focusRow(rows[0]?.node.id);
    else if (e.key === "End") focusRow(rows[rows.length - 1]?.node.id);
    else if (e.key === "ArrowRight") {
      if (hasKids && !isOpen(row)) setOpen(row.node.id, true);
      else if (hasKids) focusRow(rows[i + 1]?.node.id);
    } else if (e.key === "ArrowLeft") {
      if (hasKids && isOpen(row) && !query) setOpen(row.node.id, false);
      else focusRow(row.parent);
    } else if (e.key === " " || e.key === "Enter") toggle(row.node.id);
    else return;
    e.preventDefault();
  };

  return (
    <div className="lasso-tree">
      <label className="lasso-tree__search">
        <Icon name="search" size={16} />
        <input
          type="search"
          className="lasso-tree__input"
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          value={queryProp ?? ownQuery}
          onChange={(e) => {
            setOwnQuery(e.target.value);
            onQueryChange?.(e.target.value);
          }}
        />
      </label>
      <div ref={tree} className="lasso-tree__box" role="tree" aria-label={label} aria-multiselectable="true" onKeyDown={onKey}>
        {rows.length === 0 ? (
          <p className="lasso-tree__empty">{emptyText}</p>
        ) : (
          rows.map((r) => {
            const id = r.node.id;
            const hasKids = Boolean(r.node.children?.length);
            const open = hasKids && isOpen(r);
            const st = stateOf(id);
            return (
              <div
                key={id}
                data-id={id}
                role="treeitem"
                aria-level={r.level}
                aria-expanded={hasKids ? open : undefined}
                aria-checked={st === "mixed" ? "mixed" : st === "on"}
                aria-selected={st === "on"}
                tabIndex={id === current ? 0 : -1}
                className={`lasso-tree__row lasso-tree__row--l${Math.min(r.level, 4)} ${st === "on" ? "is-on" : ""}`}
                style={{ paddingLeft: 12 + (r.level - 1) * 24 }}
                onFocus={() => setFocusId(id)}
                onClick={() => toggle(id)}
              >
                {hasKids ? (
                  <button
                    type="button"
                    className="lasso-tree__toggle"
                    tabIndex={-1}
                    aria-label={open ? "Fold ind" : "Fold ud"}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!query) setOpen(id, !open);
                    }}
                  >
                    <Icon name={open ? "chevron-down" : "chevron-right"} size={14} />
                  </button>
                ) : (
                  <span className="lasso-tree__toggle lasso-tree__toggle--none" aria-hidden="true" />
                )}
                <Box state={st} />
                {r.node.code ? <span className="lasso-tree__code">{r.node.code}</span> : null}
                <span className="lasso-tree__label">{r.node.label}</span>
                {r.node.count !== undefined ? <span className="lasso-tree__count">{r.node.count}</span> : null}
              </div>
            );
          })
        )}
      </div>
      {extra ? (
        <button type="button" role="checkbox" aria-checked={extra.checked} className="lasso-tree__extra" onClick={() => extra.onChange?.(!extra.checked)}>
          <Box state={extra.checked ? "on" : "off"} />
          <span>{extra.label}</span>
        </button>
      ) : null}
    </div>
  );
}

export interface TreePickerDialogProps extends Omit<TreePickerProps, "onChange"> {
  open: boolean;
  title: string;
  description?: ReactNode;
  onChange?: (value: string[]) => void;
  onClose: () => void;
  /** "Tilføj" med plus; deaktiveret, når intet er valgt. */
  onConfirm: () => void;
  confirmLabel?: string;
  /** Effekt-linje i foden, fx "Reducerer resultatet med 1.782" (koral tekst). */
  effect?: string;
}

export function TreePickerDialog({ open, title, description, onClose, onConfirm, confirmLabel = "Tilføj", effect, ...picker }: TreePickerDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      size="lg"
      className="lasso-dialog--tree"
      onClose={onClose}
      footNote={effect}
      actions={{
        secondary: { label: "Annuller", onClick: onClose },
        primary: { label: confirmLabel, icon: "plus", onClick: onConfirm, disabled: picker.value.length === 0 },
      }}
    >
      <TreePicker {...picker} />
    </Dialog>
  );
}
