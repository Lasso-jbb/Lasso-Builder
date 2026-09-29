import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from "react";
import {
  formatAmount,
  formatDate,
  formatShare,
  type OwnershipEdgeVM,
  type OwnershipGraphVM,
  type OwnershipNodeVM,
} from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { printElement } from "../print.js";
import { downloadPng, svgForExport } from "../ownershipExport.js";
import { Menu } from "./Menu.js";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";
import {
  DEFAULT_MAX_NODES,
  beneficialGraph,
  entitySubtitle,
  graphOnDate,
  minimapFrame,
  refocusGraph,
  indirectShare,
  labelHeight,
  labelWidth,
  layoutOwnership,
  ownershipTree,
  roundedPath,
  type Direction,
  type LayoutEdge,
  type LayoutNode,
  type TreeItem,
} from "../ownershipLayout.js";

/** Under denne bredde bliver diagrammet en indrykket liste (26c). */
const LIST_BELOW = 560;
/** Detaljepanelet står til højre, når der er plads; ellers under lærredet. */
const PANEL_BESIDE_FROM = 900;
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2];
const CANVAS_MIN = 360;
const CANVAS_MAX = 720;
/** 26f.4: tablet indlejrer diagrammet i 340 px højde og samler over 4 noder pr. lag i "+N". */
const TABLET_CANVAS_H = 340;
const TABLET_LAYER_CAP = 4;
/** Luft i bunden af lærredet til legende og zoomknapper. */
const CANVAS_FOOT = 88;

export interface OwnershipDiagramProps {
  graph?: OwnershipGraphVM;
  error?: string;
  title?: string;
  onAction?: (a: ViewAction) => void;
  canDrillDown?: boolean;
  canPrompt?: boolean;
  canFullscreen?: boolean;
}

/* ---------- Tekstmåling til afkortning af navne i SVG ---------- */

let measureCtx: CanvasRenderingContext2D | null | undefined;
function textWidth(text: string, size: number, weight: number): number {
  if (measureCtx === undefined) {
    try {
      measureCtx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
    } catch {
      measureCtx = null;
    }
  }
  if (measureCtx) {
    measureCtx.font = `${weight} ${size}px Poppins, system-ui, sans-serif`;
    return measureCtx.measureText(text).width;
  }
  return text.length * size * (weight >= 600 ? 0.58 : 0.54);
}

function fit(text: string, max: number, size: number, weight: number): string {
  if (textWidth(text, size, weight) <= max) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (textWidth(`${text.slice(0, mid).trimEnd()}…`, size, weight) <= max) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo).trimEnd()}…`;
}

/* ---------- Ikoner (linjeikoner, aldrig fyldte ikonkasser) ---------- */

const BUILDING = "M3 21h18M5 21V5l8-2v18M13 9l6 2v10M8 8h2M8 12h2M8 16h2";
const BUILDING_CEASED = "M3 21h18M5 21V5l8-2v18M13 9l6 2v10";

/* ---------- Hovedkomponenten ---------- */

/**
 * Ejerdiagram (katalog 14, 14b; tablet 26f; mobil 26c). Koncernstruktur i flere lag:
 * ejere over, datterselskaber under, fokusvirksomheden fremhævet. Personer er piller,
 * selskaber kasser med et lille linjeikon. Kanter med andel som tekst; cirkulært ejerskab
 * føres udenom i koral stiplet. Under 560 px bliver strukturen en indrykket liste.
 */
export function OwnershipDiagram({ graph: sourceGraph, error, title, onAction, canDrillDown, canPrompt, canFullscreen }: OwnershipDiagramProps) {
  const [ref, W] = useWidth<HTMLDivElement>(900);
  const heading = title ?? "Ejerstruktur";
  const [direction, setDirection] = useState<Direction>("both");
  const [depthUp, setDepthUp] = useState<number | null>(null);
  const [depthDown, setDepthDown] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showHistoric, setShowHistoric] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const [pan, setPan] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  // Layoutregel 3 (14.4): legale/reelle ejere, dobbeltklik = nyt fokus, pr. dato, mini-kort og eksport.
  const [owners, setOwners] = useState<"legal" | "beneficial">("legal");
  const [focus, setFocus] = useState<string | null>(null);
  const [onDate, setOnDate] = useState<string | undefined>(undefined);
  const [printSvg, setPrintSvg] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const graph = useMemo(() => {
    if (!sourceGraph) return undefined;
    const dated = graphOnDate(focus ? refocusGraph(sourceGraph, focus) : sourceGraph, onDate ?? sourceGraph.onDate);
    return owners === "beneficial" ? beneficialGraph(dated, onDate) : dated;
  }, [sourceGraph, focus, onDate, owners]);
  const beneficial = owners === "beneficial";
  useEffect(() => {
    if (!printSvg) return;
    printElement(printRef.current);
    const t = setTimeout(() => setPrintSvg(null), 1500);
    return () => clearTimeout(t);
  }, [printSvg]);

  // 26f.4: på tablet (768–1023) højst 4 noder pr. lag før "+N", og diagrammet indlejres i 340 px højde.
  const tablet = W > 560 && W < 1024;
  const up = beneficial ? 1 : (depthUp ?? graph?.ingoingDepth ?? 2);
  const down = beneficial ? 0 : (depthDown ?? graph?.outgoingDepth ?? 1);
  const layout = useMemo(
    () =>
      graph
        ? layoutOwnership(graph, {
            direction: beneficial ? "up" : direction,
            depthUp: up,
            depthDown: down,
            expanded,
            expandAll,
            maxNodes: showAll || expandAll ? Infinity : DEFAULT_MAX_NODES,
            showHistoric,
            onDate,
            ...(tablet ? { layerCap: TABLET_LAYER_CAP } : {}),
          })
        : null,
    [graph, direction, up, down, expanded, expandAll, showAll, showHistoric, onDate, beneficial, tablet],
  );

  const panelBeside = W >= PANEL_BESIDE_FROM;
  const selectedNode = layout?.nodes.find((n) => n.id === selected && n.entity) ?? null;
  const canvasW = Math.max(200, selectedNode && panelBeside ? W - 336 - 16 : W);
  // Tilpas: hele bredden skal kunne ses; høje strukturer skaleres højst ned til 80 % og panoreres.
  // Der holdes 56 px fri i begge sider, så zoomknapperne i hjørnet ikke dækker noder eller baner.
  const canvasMax = tablet ? TABLET_CANVAS_H : CANVAS_MAX;
  const fitZoom = layout ? Math.max(0.25, Math.min(1, (canvasW - 112) / layout.width, Math.max(tablet ? 0.6 : 0.8, (canvasMax - CANVAS_FOOT) / layout.height))) : 1;
  const z = zoom ?? fitZoom;
  const canvasH = layout ? (tablet ? TABLET_CANVAS_H : Math.round(Math.min(CANVAS_MAX, Math.max(CANVAS_MIN, layout.height * fitZoom + CANVAS_FOOT)))) : CANVAS_MIN;
  const defaultPan = layout ? { x: Math.round((canvasW - layout.width * z) / 2), y: Math.round(Math.max(8, (canvasH - CANVAS_FOOT - layout.height * z) / 2)) } : { x: 0, y: 0 };
  const p = pan ?? defaultPan;

  // Ny struktur (dybde, retning, foldning): tilpas igen.
  useEffect(() => {
    setZoom(null);
    setPan(null);
  }, [layout]);

  if (!graph) {
    return (
      <Section title={heading} className="lasso-odiagram">
        <div ref={ref}>
          {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={5} height={480} />}
        </div>
      </Section>
    );
  }

  const root = graph.nodes.find((n) => n.id === graph.rootId);
  const origin = sourceGraph!.nodes.find((n) => n.id === sourceGraph!.rootId);
  const rootName = root?.name ?? graph.rootId;
  // Personsiden (katalog 16): roden er en person (pille); pilene går til de selskaber, personen ejer.
  const personRoot = root?.kind === "person";
  const open = (n: OwnershipNodeVM | undefined) =>
    onAction && canDrillDown && n && n.kind === "company" && n.id.startsWith("CVR-1-") ? () => onAction({ kind: "open-company", lassoId: n.id, name: n.name }) : undefined;
  const source = <SourceLine source="CVR via Lasso" updated={graph.fetchedAt} />;

  /* ---------- Mobil: indrykket liste ---------- */
  if (W < LIST_BELOW) {
    return (
      <Section title={heading} className="lasso-odiagram">
        <div ref={ref}>
          <OwnershipList graph={graph} depthUp={up} depthDown={down} open={open} personRoot={personRoot} />
          {canFullscreen && onAction && layout && layout.nodes.length > 1 ? (
            <button type="button" className="lasso-btn lasso-odiagram__full" onClick={() => onAction({ kind: "fullscreen" })}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              Åbn diagram i fuld skærm
            </button>
          ) : null}
          {graph.note ? <p className="lasso-odiagram__note">{graph.note}</p> : null}
          {source}
        </div>
      </Section>
    );
  }

  if (!layout) return null;
  const empty = layout.nodes.length === 1;
  const noData = graph.edges.length === 0;
  const hasHistoric = graph.edges.some((e) => e.until);
  const maxUp = Math.max(0, Math.min(graph.ingoingDepth, layout.availableUp));
  const maxDown = Math.max(0, Math.min(graph.outgoingDepth, layout.availableDown));

  const setZoomStep = (dir: 1 | -1) => {
    const i = ZOOM_STEPS.findIndex((s) => s >= z - 0.001);
    const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, (i === -1 ? ZOOM_STEPS.length - 1 : i) + dir))]!;
    // Zoom om lærredets midte.
    const cx = canvasW / 2;
    const cy = (canvasH - CANVAS_FOOT) / 2;
    setPan({ x: cx - ((cx - p.x) * next) / z, y: cy - ((cy - p.y) * next) / z });
    setZoom(next);
  };
  const fitView = () => {
    setZoom(null);
    setPan(null);
  };
  const onKey = (ev: KeyboardEvent<HTMLDivElement>) => {
    const step = 48;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[ev.key] && ev.target === ev.currentTarget) {
      ev.preventDefault();
      setPan({ x: p.x + moves[ev.key]![0], y: p.y + moves[ev.key]![1] });
    } else if (ev.key === "+" || ev.key === "=") setZoomStep(1);
    else if (ev.key === "-") setZoomStep(-1);
    else if (ev.key === "0") fitView();
    else if (ev.key === "Escape") setSelected(null);
  };
  const onPointerDown = (ev: ReactPointerEvent<HTMLDivElement>) => {
    if ((ev.target as Element).closest("button, .lasso-odiagram__node, .lasso-odiagram__legend")) return;
    drag.current = { x: ev.clientX, y: ev.clientY, px: p.x, py: p.y, moved: false };
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
  };
  const onPointerMove = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = ev.clientX - d.x;
    const dy = ev.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.moved) setPan({ x: d.px + dx, y: d.py + dy });
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) setSelected(null);
  };

  const clickNode = (n: LayoutNode) => {
    if (n.kind === "chain" || n.kind === "group") {
      const next = new Set(expanded);
      next.add(n.id);
      setExpanded(next);
      return;
    }
    setSelected(selected === n.id ? null : n.id);
  };

  const refocus = (n: LayoutNode) => {
    if (!n.entity || n.root || beneficial) return;
    setFocus(n.entity.id === sourceGraph!.rootId ? null : n.entity.id);
    setSelected(null);
    setHovered(null);
    setExpanded(new Set());
  };
  const today = new Date().toISOString().slice(0, 10);
  const dateText = onDate ? `Pr. ${formatDate(onDate)}` : graph.onDate ? `Pr. ${formatDate(graph.onDate)}` : `Pr. i dag, ${formatDate(today)}`;
  const legendLines = [
    personRoot ? "Fokusperson (koral kant)" : "Fokusvirksomhed (koral kant)",
    "Virksomhed (kasse)",
    "Person (pille)",
    "Ophørt (grå flade)",
    "Ukendt / sammenklappet (stiplet kasse)",
    "Ejerskab: pil mod det ejede",
    "Historisk / ukendt: stiplet linje",
    "Cirkulært ejerskab: koral stiplet",
    beneficial ? "Reelle ejere: beregnet indirekte andel" : "Legale ejere: registreret andel",
  ];
  const exportFile = `ejerstruktur-${rootName.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-${(onDate ?? graph.onDate ?? today).slice(0, 10)}`;
  const exportSvg = () =>
    svgRef.current && layout
      ? svgForExport(svgRef.current, { width: layout.width, height: layout.height }, {
          title: `${beneficial ? "Reelle ejere" : "Ejerstruktur"}, ${rootName}`,
          dateLine: dateText,
          legend: legendLines,
          source: `Kilde: CVR via Lasso${graph.fetchedAt ? `, opdateret ${formatDate(graph.fetchedAt)}` : ""}`,
        })
      : null;

  const focusId = hovered ?? selected;
  const touches = (e: LayoutEdge) => focusId !== null && (e.from === focusId || e.to === focusId);

  const depthOptions: [number, number][] = [];
  for (let u = direction === "down" ? 0 : Math.min(1, maxUp); u <= (direction === "down" ? 0 : maxUp); u++)
    for (let d = direction === "up" ? 0 : Math.min(1, maxDown); d <= (direction === "up" ? 0 : maxDown); d++) depthOptions.push([u, d]);
  const curUp = direction === "down" ? 0 : Math.min(up, maxUp);
  const curDown = direction === "up" ? 0 : Math.min(down, maxDown);
  if (!depthOptions.some(([u, d]) => u === curUp && d === curDown)) depthOptions.push([curUp, curDown]);

  const notes: string[] = [];
  if (layout.cycles.length) {
    const names = layout.cycles[0]!.map((id) => graph.nodes.find((n) => n.id === id)?.name ?? id);
    notes.push(
      `Cirkulært ejerskab: ${names.length > 2 ? `${names.slice(0, -1).join(", ")} og ${names.at(-1)}` : names.join(" og ")} ejer hinanden i ring (${names.length} led). Reel ejer kan ikke beregnes for den cirkulære andel.`,
    );
  }
  if (layout.onlyPersons && !empty) notes.push(`Kun personer ejer ${rootName}, og selskabet ejer ingen andre selskaber.`);
  if (graph.note) notes.push(graph.note);
  if (beneficial) notes.push("Reelle ejere er beregnet ud fra de legale ejerandele gennem mellemliggende selskaber (indirekte andel). De registrerede reelle ejere i CVR kan afvige.");
  if (onDate) notes.push(`Viser ejerskab pr. ${formatDate(onDate)} ud fra registreringsdatoerne; ejerskaber registreret senere er udeladt, og ophørte er stiplede.`);
  if (focus && !empty) notes.push(`Fokus er flyttet til ${rootName}. Dobbeltklik på en anden node for at flytte fokus igen.`);

  const toolbar = (
    <div className="lasso-odiagram__toolbar lasso-noprint" role="toolbar" aria-label="Ejerdiagram">
      {personRoot ? null : (
        <div className="lasso-odiagram__seg" role="radiogroup" aria-label="Ejere">
          {(
            [
              ["legal", "Legale ejere"],
              ["beneficial", "Reelle ejere"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={owners === k}
              className={owners === k ? "is-on" : ""}
              onClick={() => {
                setOwners(k);
                setSelected(null);
              }}
              disabled={noData && k === "beneficial"}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {/* En person har ingen ejere, så retningsvalget giver kun mening for et selskab. */}
      {personRoot || beneficial ? null : (
        <div className="lasso-odiagram__seg" role="radiogroup" aria-label="Retning">
          {(
            [
              ["both", "Begge veje"],
              ["up", "Kun ejere"],
              ["down", "Kun datterselskaber"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={direction === k} className={direction === k ? "is-on" : ""} onClick={() => setDirection(k)} disabled={noData}>
              {label}
            </button>
          ))}
        </div>
      )}
      <label className="lasso-odiagram__chip lasso-odiagram__date">
        <span>Pr. dato:</span>
        <input
          type="date"
          value={onDate ?? graph.onDate ?? ""}
          max={today}
          aria-label="Vis ejerskab pr. dato"
          onChange={(ev) => setOnDate(ev.target.value || undefined)}
        />
        {onDate ? null : <span className="lasso-odiagram__today">i dag</span>}
      </label>
      {onDate ? (
        <button type="button" className="lasso-odiagram__chip" onClick={() => setOnDate(undefined)}>
          I dag
        </button>
      ) : null}
      {focus ? (
        <button type="button" className="lasso-odiagram__chip" onClick={() => setFocus(null)} title="Dobbeltklik på en node gør den til nyt fokus">
          Tilbage til {origin?.name ?? sourceGraph!.rootId}
        </button>
      ) : null}
      {beneficial ? null : (
      <label className={`lasso-odiagram__chip lasso-odiagram__select ${noData ? "is-dim" : ""}`}>
        <span className="lasso-odiagram__sr">Dybde</span>
        <select
          value={`${curUp}:${curDown}`}
          disabled={noData || depthOptions.length < 2}
          onChange={(ev) => {
            const [u, d] = ev.target.value.split(":").map(Number);
            setDepthUp(u!);
            setDepthDown(d!);
          }}
        >
          {depthOptions.map(([u, d]) => (
            <option key={`${u}:${d}`} value={`${u}:${d}`}>{`Dybde: ${u} op, ${d} ned`}</option>
          ))}
        </select>
        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </label>
      )}
      {hasHistoric ? (
        <button type="button" className={`lasso-odiagram__chip ${showHistoric ? "is-on" : ""}`} aria-pressed={showHistoric} onClick={() => setShowHistoric(!showHistoric)}>
          Vis historik
        </button>
      ) : null}
      <span className="lasso-odiagram__spacer" />
      <Menu
        trigger={
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
            </svg>
            Eksportér
          </>
        }
        triggerClassName="lasso-odiagram__chip"
        align="end"
        label="Eksportér ejerdiagram"
        context={{ title: "Eksportér ejerdiagram", subtitle: "Hele grafen med legende og dato" }}
        items={[
          {
            id: "png",
            label: "PNG-billede",
            disabled: empty,
            onSelect: () => {
              const svg = exportSvg();
              if (svg) void downloadPng(svg, `${exportFile}.png`);
            },
          },
          {
            id: "pdf",
            label: "PDF (udskriv)",
            disabled: empty,
            onSelect: () => setPrintSvg(exportSvg()),
          },
        ]}
      />
      <button type="button" className="lasso-odiagram__chip" aria-pressed={expandAll} onClick={() => setExpandAll(!expandAll)} disabled={empty}>
        {expandAll ? "Fold sammen" : "Udvid alle"}
      </button>
      {canFullscreen && onAction ? (
        <button type="button" className="lasso-odiagram__chip lasso-odiagram__icon" aria-label="Fuld skærm" onClick={() => onAction({ kind: "fullscreen" })}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />
          </svg>
        </button>
      ) : null}
    </div>
  );

  const canvas = (
    <div
      className="lasso-odiagram__canvas"
      style={{ height: canvasH }}
      tabIndex={0}
      aria-label={`Ejerdiagram for ${rootName}. Piletaster flytter, plus og minus zoomer, 0 tilpasser.`}
      onKeyDown={onKey}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
    >
      <svg ref={svgRef} className="lasso-odiagram__svg" width={canvasW} height={canvasH} role="img" aria-label={`Ejerstruktur for ${rootName}`}>
        <defs>
          <marker id="lasso-od-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
            <path d="M0,0 L8,4 L0,8 z" className="lasso-odiagram__arrow" />
          </marker>
          <marker id="lasso-od-arrow-cycle" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
            <path d="M0,0 L8,4 L0,8 z" className="lasso-odiagram__arrow lasso-odiagram__arrow--cycle" />
          </marker>
          <marker id="lasso-od-arrow-focus" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
            <path d="M0,0 L8,4 L0,8 z" className="lasso-odiagram__arrow lasso-odiagram__arrow--focus" />
          </marker>
        </defs>
        <g data-od-graph="" transform={`translate(${p.x},${p.y}) scale(${z})`}>
          {layout.edges.map((e) => (
            <EdgePath key={e.id} e={e} focus={touches(e)} dim={focusId !== null && !touches(e)} />
          ))}
          {layout.nodes.map((n) => (
            <NodeShape
              key={n.id}
              n={n}
              selected={n.id === selected}
              dim={false}
              onClick={() => clickNode(n)}
              onDoubleClick={() => refocus(n)}
              onHover={(on) => setHovered(on ? n.id : null)}
            />
          ))}
          {layout.edges.map((e) => (e.label ? <EdgeLabel key={`l-${e.id}`} e={e} dim={focusId !== null && !touches(e)} /> : null))}
        </g>
      </svg>
      {empty ? (
        <div className="lasso-odiagram__empty" style={{ top: p.y + (layout.nodes[0]!.y + layout.nodes[0]!.h) * z + 20 }}>
          {graph.edges.length === 0 ? (
            <>
              <p className="lasso-odiagram__empty-title">{personRoot ? "Ingen registrerede ejerskaber" : "Ingen registrerede ejere eller datterselskaber"}</p>
              <p className="lasso-odiagram__empty-text">
                {personRoot ? `${rootName} ejer ingen selskaber i CVR (legale ejerandele over 5 %).` : `${rootName} har ingen legale ejere over 5 % i CVR og ejer ikke andre selskaber.`} Sidst tjekket{" "}
                {formatDate(graph.fetchedAt ?? new Date().toISOString())}.
              </p>
            </>
          ) : (
            <>
              <p className="lasso-odiagram__empty-title">Intet at vise i det valgte udsnit</p>
              <p className="lasso-odiagram__empty-text">Der er ejere eller datterselskaber uden for den valgte retning eller dybde. Vælg &quot;Begge veje&quot; eller en større dybde.</p>
            </>
          )}
        </div>
      ) : null}
      {!empty && canvasW >= 720 ? <Legend personRoot={personRoot} /> : null}
      {!empty && canvasW >= 720 ? (
        <Minimap
          layout={layout}
          view={{ x: p.x, y: p.y, zoom: z, width: canvasW, height: canvasH }}
          onMove={(lx, ly) => setPan({ x: Math.round(canvasW / 2 - lx * z), y: Math.round((canvasH - CANVAS_FOOT) / 2 - ly * z) })}
        />
      ) : null}
      <div className="lasso-odiagram__zoom" role="group" aria-label="Zoom">
        <button type="button" aria-label="Zoom ind" onClick={() => setZoomStep(1)} disabled={z >= 2}>
          +
        </button>
        <span className="lasso-odiagram__zoomval" aria-live="polite">
          {Math.round(z * 100)}
        </span>
        <button type="button" aria-label="Zoom ud" onClick={() => setZoomStep(-1)} disabled={z <= 0.25}>
          −
        </button>
        <button type="button" aria-label="Tilpas" title="Tilpas" onClick={fitView}>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M8 12h8" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <Section title={heading} subtitle={rootName} className="lasso-odiagram">
      <div ref={ref}>
      <div ref={printRef}>
        {toolbar}
        {printSvg ? <div className="lasso-printonly lasso-odiagram__print" dangerouslySetInnerHTML={{ __html: printSvg }} /> : null}
        <div className={`lasso-odiagram__body lasso-noprint ${selectedNode && panelBeside ? "has-panel" : ""}`}>
          {canvas}
          {selectedNode ? (
            <DetailPanel
              node={selectedNode}
              graph={graph}
              rootName={rootName}
              personRoot={personRoot}
              onClose={() => setSelected(null)}
              open={open(selectedNode.entity)}
              fromHere={
                onAction && canPrompt && selectedNode.entity && !selectedNode.root && selectedNode.entity.kind === "company"
                  ? () => onAction({ kind: "prompt", prompt: `Vis ejerdiagrammet for ${selectedNode.entity!.name} (${selectedNode.entity!.id})` })
                  : undefined
              }
            />
          ) : null}
        </div>
        {layout.hiddenCount > 0 || showAll ? (
          <p className="lasso-odiagram__note">
            {layout.hiddenCount > 0 ? `Viser ${layout.nodes.filter((n) => n.entity).length} af ${layout.totalCount} enheder. ` : null}
            <button type="button" className="lasso-link lasso-odiagram__more" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Vis færre" : "Se hele strukturen"}
            </button>
          </p>
        ) : null}
        {notes.map((t) => (
          <p key={t} className="lasso-odiagram__note">
            {t}
          </p>
        ))}
        {source}
      </div>
      </div>
    </Section>
  );
}

/* ---------- Noder ---------- */

function NodeShape({ n, selected, onClick, onDoubleClick, onHover }: { n: LayoutNode; selected: boolean; dim: boolean; onClick: () => void; onDoubleClick?: () => void; onHover: (on: boolean) => void }) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const person = n.kind === "person";
  const folded = n.kind === "chain" || n.kind === "group";
  const foreign = n.entity?.country;
  const hasIcon = n.kind === "company" || folded;
  const padL = n.root ? 14 : person ? 16 : 10;
  const textX = n.x + padL + (hasIcon ? 28 : 0);
  const maxText = n.w - (textX - n.x) - 10;
  const nameSize = n.root ? 14 : 13;
  const cy = n.y + n.h / 2;
  const cls = [
    "lasso-odiagram__node",
    `lasso-odiagram__node--${n.kind}`,
    n.root ? "is-root" : "",
    n.ceased ? "is-ceased" : "",
    selected ? "is-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const subtitle = n.root && n.entity ? entitySubtitle(n.entity) : n.subtitle;
  const label = folded ? `${n.title}. ${n.subtitle ?? ""}. Klik for at folde ud.` : `${n.title}, ${subtitle ?? ""}`;
  return (
    <g
      className={cls}
      tabIndex={0}
      role="button"
      aria-label={label}
      aria-pressed={folded ? undefined : selected}
      onClick={(ev) => {
        ev.stopPropagation();
        // Enkeltklik venter kort, så et dobbeltklik (nyt fokus) ikke først åbner panelet og flytter noderne.
        if (!onDoubleClick) return onClick();
        if (clickTimer.current) clearTimeout(clickTimer.current);
        clickTimer.current = setTimeout(() => {
          clickTimer.current = null;
          onClick();
        }, 220);
      }}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          ev.stopPropagation();
          onClick();
        }
      }}
      onDoubleClick={(ev) => {
        ev.stopPropagation();
        if (clickTimer.current) clearTimeout(clickTimer.current);
        clickTimer.current = null;
        onDoubleClick?.();
      }}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
    >
      <title>{label}</title>
      <rect className="lasso-odiagram__box" x={n.x} y={n.y} width={n.w} height={n.h} rx={person ? n.h / 2 : 8} />
      {folded ? (
        <text className="lasso-odiagram__plus" x={n.x + padL + 9} y={cy + 4} textAnchor="middle">
          +{n.count}
        </text>
      ) : n.kind === "company" && foreign ? (
        <text className="lasso-odiagram__cc" x={n.x + padL + 9} y={cy + 4} textAnchor="middle">
          {foreign}
        </text>
      ) : n.kind === "company" ? (
        <g transform={`translate(${n.x + padL + 9 - (n.root ? 8 : 7)},${cy - (n.root ? 8 : 7)}) scale(${n.root ? 16 / 24 : 14 / 24})`}>
          <path className="lasso-odiagram__glyph" d={n.ceased ? BUILDING_CEASED : BUILDING} />
        </g>
      ) : null}
      <text className="lasso-odiagram__name" x={textX} y={cy - 3} style={{ fontSize: nameSize }}>
        {fit(n.kind === "group" && textWidth(n.title, nameSize, 600) > maxText ? n.title.replace("datterselskaber", "selskaber") : n.title, maxText, nameSize, 600)}
      </text>
      {subtitle ? (
        <text className="lasso-odiagram__sub" x={textX} y={cy + 12}>
          {fit(subtitle, maxText, 11, 400)}
        </text>
      ) : null}
    </g>
  );
}

/* ---------- Kanter og labels ---------- */

function EdgePath({ e, focus, dim }: { e: LayoutEdge; focus: boolean; dim: boolean }) {
  const cls = ["lasso-odiagram__edge", `lasso-odiagram__edge--${e.style}`, focus ? "is-focus" : "", dim ? "is-dim" : ""].filter(Boolean).join(" ");
  const marker = focus ? "lasso-od-arrow-focus" : e.style === "cycle" ? "lasso-od-arrow-cycle" : "lasso-od-arrow";
  return <path className={cls} d={roundedPath(e.points)} markerEnd={`url(#${marker})`} />;
}

function EdgeLabel({ e, dim }: { e: LayoutEdge; dim: boolean }) {
  const l = e.label!;
  const cycle = l.lines.some((x) => x.tone === "cycle");
  const muted = l.lines.every((x) => x.tone === "muted");
  const w = labelWidth(l.lines) + (cycle ? 16 : 0);
  const h = labelHeight(l.lines) + 2;
  const x = l.x - w / 2;
  const y = l.y - h / 2;
  return (
    <g className={`lasso-odiagram__label ${cycle ? "is-cycle" : ""} ${muted ? "is-muted" : ""} ${dim ? "is-dim" : ""}`}>
      <rect x={x} y={y} width={w} height={h} rx={10} />
      {cycle ? (
        <g transform={`translate(${x + 8},${l.y - 5.5}) scale(${11 / 24})`}>
          <path className="lasso-odiagram__loop" d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" />
        </g>
      ) : null}
      {l.lines.map((line, i) => (
        <text key={i} className={`lasso-odiagram__ltext lasso-odiagram__ltext--${line.tone}`} x={l.x + (cycle ? 8 : 0)} y={y + 4 + 11 + i * 14} textAnchor="middle">
          {line.text}
        </text>
      ))}
    </g>
  );
}

/** Mini-kort (14.1): hele grafen i lille målestok med viewport-rammen; klik flytter udsnittet dertil. */
function Minimap({ layout, view, onMove }: { layout: { width: number; height: number; nodes: LayoutNode[] }; view: { x: number; y: number; zoom: number; width: number; height: number }; onMove: (x: number, y: number) => void }) {
  const m = minimapFrame(layout, { ...view, height: view.height - CANVAS_FOOT });
  return (
    <div className="lasso-odiagram__minimap" aria-label="Mini-kort over hele strukturen">
      <svg
        width={m.width}
        height={m.height}
        onClick={(ev) => {
          const r = (ev.currentTarget as SVGSVGElement).getBoundingClientRect();
          onMove((ev.clientX - r.left) / m.scale, (ev.clientY - r.top) / m.scale);
        }}
      >
        {layout.nodes.map((n) => (
          <rect key={n.id} className={`lasso-odiagram__mininode ${n.root ? "is-root" : ""}`} x={n.x * m.scale} y={n.y * m.scale} width={Math.max(2, n.w * m.scale)} height={Math.max(2, n.h * m.scale)} rx={1.5} />
        ))}
        <rect className="lasso-odiagram__miniframe" x={m.frame.x} y={m.frame.y} width={m.frame.w} height={m.frame.h} />
      </svg>
    </div>
  );
}

function Legend({ personRoot = false }: { personRoot?: boolean }) {
  return (
    <div className="lasso-odiagram__legend" aria-label="Signaturforklaring">
      <div className="lasso-odiagram__legend-row">
        {personRoot ? <span><i className="lg-box lg-box--root lg-box--person" />Fokusperson</span> : <span><i className="lg-box lg-box--root" />Fokusvirksomhed</span>}
        <span><i className="lg-box" />Virksomhed</span>
        <span><i className="lg-box lg-box--person" />Person</span>
        <span><i className="lg-box lg-box--ceased" />Ophørt</span>
        <span><i className="lg-box lg-box--unknown" />Ukendt / sammenklappet</span>
      </div>
      <div className="lasso-odiagram__legend-row">
        <span><i className="lg-line" />Ejerskab (pil mod det ejede)</span>
        <span><i className="lg-line lg-line--dashed" />Historisk / ukendt</span>
        <span><i className="lg-line lg-line--cycle" />Cirkulært ejerskab</span>
        <span><b className="lg-votes">Stemmer</b> vises kun når de afviger fra ejerandelen</span>
      </div>
    </div>
  );
}

/* ---------- Detaljepanel ---------- */

function DetailPanel({
  node,
  graph,
  rootName,
  personRoot = false,
  onClose,
  open,
  fromHere,
}: {
  node: LayoutNode;
  graph: OwnershipGraphVM;
  rootName: string;
  /** Roden er en person (personsiden): selskaberne under er personens ejerskaber, ikke datterselskaber. */
  personRoot?: boolean;
  onClose: () => void;
  open?: () => void;
  fromHere?: () => void;
}) {
  const n = node.entity!;
  const rootId = graph.rootId;
  const shortRoot = rootName.replace(/\s+(A\/S|ApS|I\/S|K\/S|P\/S|IVS|AS|AB|GmbH)$/i, "");
  const direct: OwnershipEdgeVM | undefined = node.layer < 0 ? graph.edges.find((e) => e.from === n.id && e.to === rootId) : graph.edges.find((e) => e.from === rootId && e.to === n.id);
  const indirect = node.layer < 0 ? indirectShare(graph, n.id, rootId) : node.layer > 0 ? indirectShare(graph, rootId, n.id) : null;
  const role = node.root ? "Valgt, fokus" : node.layer < 0 ? "Valgt, ejer" : personRoot ? "Valgt, ejet selskab" : "Valgt, datterselskab";
  const sub = n.kind === "person" ? "Person" : [n.cvr ? `CVR ${n.cvr}` : n.registrationNo ? `Reg.nr. ${n.registrationNo}` : undefined, n.form, n.status].filter(Boolean).join(", ");

  const rows: [string, string, boolean?][] = [];
  if (node.root && personRoot) {
    rows.push(["Ejer direkte", String(graph.edges.filter((e) => e.from === rootId && !e.until).length)]);
  } else if (node.root) {
    rows.push(["Direkte ejere", String(graph.edges.filter((e) => e.to === rootId).length)]);
    rows.push(["Direkte datterselskaber", String(graph.edges.filter((e) => e.from === rootId).length)]);
  } else {
    const share = direct?.share ?? indirect ?? undefined;
    rows.push([node.layer < 0 ? `Ejerandel i ${shortRoot}` : `${shortRoot} ejer`, share ? formatShare(share) : "Ikke oplyst", !share]);
    if (direct?.votes || direct?.share) rows.push(["Stemmeandel", formatShare(direct.votes ?? direct.share)]);
    const below = personRoot ? (direct ? "Ejet direkte" : "Ejet indirekte, via et selskab") : direct ? "Datterselskab, direkte" : "Datterselskab, indirekte";
    rows.push(["Type", node.layer < 0 ? (direct ? "Legal ejer, direkte" : "Legal ejer, indirekte") : below]);
    if (direct?.since) rows.push(["Registreret siden", formatDate(direct.since)]);
    if (direct?.until) rows.push(["Ophørt", formatDate(direct.until)]);
  }
  if (typeof n.equity === "number") rows.push(["Egenkapital", formatAmount(n.equity)]);

  // Reel ejer bag: personer over den valgte node og deres indirekte andel i roden.
  const people: { name: string; inNode: [number, number] | null; inRoot: [number, number] | null }[] = [];
  if (node.layer <= 0) {
    const seen = new Set<string>();
    const stack = [n.id];
    while (stack.length) {
      const id = stack.pop()!;
      for (const e of graph.edges) {
        if (e.to !== id || seen.has(e.from)) continue;
        seen.add(e.from);
        const owner = graph.nodes.find((x) => x.id === e.from);
        if (!owner) continue;
        if (owner.kind === "person") people.push({ name: owner.name, inNode: indirectShare(graph, owner.id, n.id), inRoot: node.root ? null : indirectShare(graph, owner.id, rootId) });
        else stack.push(owner.id);
      }
    }
    people.sort((a, b) => (b.inNode?.[1] ?? 0) - (a.inNode?.[1] ?? 0) || a.name.localeCompare(b.name, "da"));
  }

  return (
    <aside className="lasso-odiagram__panel" aria-label={`Detaljer for ${n.name}`}>
      <div className="lasso-odiagram__panel-head">
        <div>
          <div className="lasso-odiagram__overline">{role}</div>
          <div className="lasso-odiagram__panel-name">{n.name}</div>
          <div className="lasso-odiagram__panel-sub">{sub}</div>
        </div>
        <button type="button" className="lasso-odiagram__close" aria-label="Luk" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <dl className="lasso-odiagram__kv">
        {rows.map(([k, v, faint]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className={faint ? "lasso-notreported" : ""}>{v}</dd>
          </div>
        ))}
      </dl>
      {people.length ? (
        <div className="lasso-odiagram__panel-sec">
          <div className="lasso-odiagram__overline">Reel ejer bag (kæde)</div>
          {people.slice(0, 3).map((x) => (
            <div key={x.name} className="lasso-odiagram__chain">
              <div className="lasso-odiagram__chain-row">
                <span>{x.name}</span>
                <b>{formatShare(x.inNode)}</b>
              </div>
              {x.inRoot ? (
                <div className="lasso-odiagram__chain-sub">
                  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 4v12M6 10l6 6 6-6" />
                  </svg>
                  indirekte {formatShare(x.inRoot)} af {rootName}
                </div>
              ) : null}
            </div>
          ))}
          {people.length > 3 ? <div className="lasso-odiagram__chain-sub">Se {people.length - 3} flere i listen</div> : null}
        </div>
      ) : null}
      {direct?.since || direct?.until ? (
        <div className="lasso-odiagram__panel-sec">
          <div className="lasso-odiagram__overline">Historik for ejerskabet</div>
          {direct.until ? (
            <div className="lasso-odiagram__hist">
              <span>Ejerskab ophørt</span>
              <span>{formatDate(direct.until)}</span>
            </div>
          ) : null}
          {direct.since ? (
            <div className="lasso-odiagram__hist">
              <span>{node.layer < 0 ? "Registreret som ejer" : personRoot ? "Ejerskab registreret" : "Registreret som datterselskab"}</span>
              <span>{formatDate(direct.since)}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="lasso-odiagram__panel-spacer" />
      {open || fromHere ? (
        <div className="lasso-odiagram__panel-actions">
          {open ? (
            <button type="button" className="lasso-btn lasso-btn--primary" onClick={open}>
              Åbn virksomhed
            </button>
          ) : null}
          {fromHere ? (
            <button type="button" className="lasso-btn" onClick={fromHere}>
              Diagram herfra
            </button>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

/* ---------- Mobil: indrykket liste (26c) ---------- */

const LIST_SHOW = 3;

function OwnershipList({
  graph,
  depthUp,
  depthDown,
  open,
  personRoot = false,
}: {
  graph: OwnershipGraphVM;
  depthUp: number;
  depthDown: number;
  open: (n: OwnershipNodeVM | undefined) => (() => void) | undefined;
  personRoot?: boolean;
}) {
  const [openRows, setOpenRows] = useState<ReadonlySet<string>>(new Set());
  const tree = useMemo(() => ownershipTree(graph, { depthUp, depthDown }), [graph, depthUp, depthDown]);
  const root = graph.nodes.find((n) => n.id === graph.rootId);
  const both = tree.owners.length > 0 && tree.subsidiaries.length > 0;
  const toggle = (key: string) => {
    const next = new Set(openRows);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpenRows(next);
  };

  const rows = (items: TreeItem[], level: number, parentKey: string, noun: string): ReactElement[] => {
    const all = openRows.has(parentKey);
    const shown = all || items.length <= LIST_SHOW + 1 ? items : items.slice(0, LIST_SHOW);
    const out: ReactElement[] = [];
    for (const it of shown) {
      const key = `${parentKey}/${it.id}`;
      const node = graph.nodes.find((n) => n.id === it.id);
      const click = it.repeat ? undefined : open(node);
      out.push(
        <li key={key} className={`lasso-odlist__row ${level > 1 ? "is-deep" : ""} ${it.ceased ? "is-ceased" : ""}`} style={{ paddingLeft: 8 + 20 * Math.min(level, 4) }}>
          <span className="lasso-odlist__dash" aria-hidden="true" />
          <span className="lasso-odlist__name">
            {click ? (
              <button type="button" className="lasso-link" onClick={click}>
                {it.name}
              </button>
            ) : (
              it.name
            )}
            {it.repeat === "cycle" ? <span className="lasso-odlist__tag">, cirkulært</span> : it.repeat === "shared" ? <span className="lasso-odlist__tag">, se ovenfor</span> : null}
          </span>
          <span className="lasso-odlist__share">{it.share ? formatShare(it.share) : <span className="lasso-notreported">Ikke oplyst</span>}</span>
        </li>,
      );
      // Under en ejer står dens ejere; under et selskab nedad dets datterselskaber.
      if (it.children.length) out.push(...rows(it.children, level + 1, key, noun === "ejere" ? "ejere" : "datterselskaber"));
    }
    if (shown.length < items.length) {
      out.push(
        <li key={`${parentKey}/more`} className="lasso-odlist__row lasso-odlist__row--more" style={{ paddingLeft: 8 + 20 * Math.min(level, 4) }}>
          <span className="lasso-odlist__dash" aria-hidden="true" />
          <button type="button" className="lasso-odlist__more" onClick={() => toggle(parentKey)} aria-expanded={false}>
            <span>+ {items.length - shown.length} {noun}</span>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 6l5 5 5-5" />
            </svg>
          </button>
        </li>,
      );
    }
    return out;
  };

  const emptyAll = tree.owners.length === 0 && tree.subsidiaries.length === 0;
  return (
    <>
      <ul className="lasso-odlist" aria-label="Ejerstruktur som liste">
        <li className="lasso-odlist__row lasso-odlist__row--root">
          <span className="lasso-odlist__name">{root?.name ?? graph.rootId}</span>
          <span className="lasso-odlist__tag">Emne</span>
        </li>
        {both && tree.owners.length ? <li className="lasso-odlist__group">Ejere</li> : null}
        {rows(tree.owners, 1, "o", "ejere")}
        {both && tree.subsidiaries.length ? <li className="lasso-odlist__group">Datterselskaber</li> : null}
        {rows(tree.subsidiaries, 1, "s", personRoot ? "selskaber" : "datterselskaber")}
      </ul>
      {emptyAll ? (
        <DataState
          state="empty"
          reason={personRoot ? `${root?.name ?? "Personen"} ejer ingen selskaber i CVR (legale ejerandele over 5 %).` : `${root?.name ?? "Selskabet"} har ingen legale ejere over 5 % i CVR og ejer ikke andre selskaber.`}
        />
      ) : null}
    </>
  );
}
