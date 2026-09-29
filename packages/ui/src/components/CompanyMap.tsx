import { useEffect, useState } from "react";
import { moreText, formatNumber, type MapPointVM, type MapVM } from "@lasso/spec";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";
import { isCompact } from "../chartPick.js";
import type { ViewAction } from "../types.js";

/** Et samlet punkt på skærmen: én adresse eller en klynge af relaterede adresser tæt på hinanden. */
export interface MapMarker {
  key: string;
  kind: "focus" | "related" | "cluster";
  x: number;
  y: number;
  points: MapPointVM[];
}

const CLUSTER_PX = 28;
/** Markeringen "hovedadressen" (før markørerne er lagt ud). */
const FOCUS = "__focus__";

/**
 * Projektion og klynger (ren funktion, testbar): punkterne passes ind i W×H med `pad` luft (lige-
 * afstands-projektion med cos(breddegrad), fint på Danmarks skala). Hovedadressen (focus) klynges
 * aldrig; relaterede adresser nærmere end 28 px slås sammen til en koral klynge med antal.
 */
export function layoutMap(points: readonly MapPointVM[], W: number, H: number, pad = 34, zoom = 1): MapMarker[] {
  if (points.length === 0 || W <= 0 || H <= 0) return [];
  const meanLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const kx = Math.cos((meanLat * Math.PI) / 180);
  const xs = points.map((p) => p.lon * kx);
  const ys = points.map((p) => p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  // Mindst ca. 1 km på tværs, så ét punkt ikke zoomes uendeligt ind.
  const spanX = Math.max(maxX - minX, 0.012);
  const spanY = Math.max(maxY - minY, 0.008);
  const s = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY) * zoom;
  // Zoomet ind centreres om hovedadressen, så den bliver på kortet.
  const f = zoom > 1 ? points.find((p) => p.kind === "focus") : undefined;
  const cx = f ? f.lon * kx : (minX + maxX) / 2;
  const cy = f ? f.lat : (minY + maxY) / 2;
  const proj = (p: MapPointVM) => ({ x: W / 2 + (p.lon * kx - cx) * s, y: H / 2 + 8 - (p.lat - cy) * s });
  const markers: MapMarker[] = [];
  for (const p of points) {
    const { x, y } = proj(p);
    if (p.kind === "focus") {
      markers.push({ key: p.id, kind: "focus", x, y, points: [p] });
      continue;
    }
    const near = markers.find((m) => m.kind !== "focus" && Math.hypot(m.x - x, m.y - y) < CLUSTER_PX);
    if (near) {
      const n = near.points.length;
      near.x = (near.x * n + x) / (n + 1);
      near.y = (near.y * n + y) / (n + 1);
      near.points.push(p);
      near.kind = "cluster";
      near.key = `${near.key}+${p.id}`;
    } else {
      markers.push({ key: p.id, kind: "related", x, y, points: [p] });
    }
  }
  return markers;
}

function Pin({ m, active, onPick }: { m: MapMarker; active: boolean; onPick: (m: MapMarker) => void }) {
  const label = m.kind === "cluster" ? `${m.points.length} adresser` : m.points[0]!.name;
  const common = {
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    "aria-pressed": active,
    className: `lasso-map__marker lasso-map__marker--${m.kind}${active ? " is-active" : ""}`,
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onPick(m);
    },
    onKeyDown: (e: { key: string; preventDefault: () => void }) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPick(m);
      }
    },
  } as const;
  if (m.kind === "focus") {
    // Ink-nål = fokus (virksomhedens adresse).
    return (
      <g {...common} transform={`translate(${m.x} ${m.y})`}>
        <path className="lasso-map__pin" d="M0 0c-1.2-4.6-8-8.4-8-14.2a8 8 0 1116 0c0 5.8-6.8 9.6-8 14.2z" />
        <circle className="lasso-map__pin-dot" cx="0" cy="-14" r="3" />
      </g>
    );
  }
  if (m.kind === "cluster") {
    const r = m.points.length >= 10 ? 15 : 13;
    return (
      <g {...common} transform={`translate(${m.x} ${m.y})`}>
        <circle className="lasso-map__cluster" r={r} />
        <text className="lasso-map__cluster-n" y="4.5" textAnchor="middle">
          {formatNumber(m.points.length)}
        </text>
      </g>
    );
  }
  return (
    <g {...common} transform={`translate(${m.x} ${m.y})`}>
      <circle className="lasso-map__ring" r="6.5" />
    </g>
  );
}

/** "Prøvevej 1, 8600 Silkeborg" -> ["Prøvevej 1", "Silkeborg"]. */
function splitAddress(address: string | undefined): [string | undefined, string | undefined] {
  if (!address) return [undefined, undefined];
  const i = address.indexOf(",");
  if (i < 0) return [address, undefined];
  const rest = address.slice(i + 1).trim().replace(/^\d{4}\s+/, "");
  return [address.slice(0, i).trim(), rest || undefined];
}

/**
 * Hovedadressens kort (13.12 popup, 26b.11 markørkort): desktop "Toldbodgade 37B" / "Hovedadresse,
 * København K"; mobil navnet 600 over "Hovedadresse, København K" med "Rute" i koral til højre.
 */
function FocusCard({ p, mobile, onRoute }: { p: MapPointVM; mobile?: boolean; onRoute?: (p: MapPointVM) => void }) {
  const [street, city] = splitAddress(p.address);
  const kind = p.meta ?? "Hovedadresse";
  return (
    <div className={`lasso-map__card lasso-map__card--focus${mobile ? " lasso-map__card--overlay" : ""}`}>
      <div className="lasso-map__card-item">
        <span className="lasso-map__card-name">{mobile ? p.name : (street ?? p.name)}</span>
        <span className="lasso-map__card-sub">{[kind, city].filter(Boolean).join(", ")}</span>
      </div>
      {mobile && onRoute ? (
        <button type="button" className="lasso-link lasso-map__route" onClick={(e) => { e.stopPropagation(); onRoute(p); }}>
          Rute
        </button>
      ) : null}
    </div>
  );
}

/** Kort-popup: et almindeligt hvidt kort med radius 8 (13.12). */
function PointCard({ m, onOpen, onClose }: { m: MapMarker; onOpen?: (p: MapPointVM) => void; onClose?: () => void }) {
  const shown = m.points.slice(0, 3);
  return (
    <div className="lasso-map__card">
      {onClose ? (
        <button type="button" className="lasso-map__card-close" onClick={onClose} aria-label="Luk">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
      {m.kind === "cluster" ? <div className="lasso-map__card-kicker">{formatNumber(m.points.length)} adresser her</div> : null}
      {shown.map((p) => (
        <div className="lasso-map__card-item" key={p.id}>
          {onOpen && p.lassoId ? (
            <button type="button" className="lasso-link lasso-map__card-name" onClick={() => onOpen(p)}>
              {p.name}
            </button>
          ) : (
            <span className="lasso-map__card-name">{p.name}</span>
          )}
          {p.address ? <span className="lasso-map__card-sub">{p.address}</span> : null}
          {p.meta ? <span className="lasso-map__card-sub">{p.meta}</span> : null}
        </div>
      ))}
      {m.points.length > 3 ? <div className="lasso-map__card-more">og {moreText(m.points.length - 3)}</div> : null}
    </div>
  );
}

function MapCanvas({ markers, W, H, active, onPick }: { markers: readonly MapMarker[]; W: number; H: number; active: string | null; onPick: (m: MapMarker) => void }) {
  // Skematisk kortflade: kølig grå land og hvide "veje" (et roligt gitter), så koral kun bruges til markører.
  const roads: number[] = [];
  for (let v = 36; v < Math.max(W, H); v += 72) roads.push(v);
  return (
    <svg className="lasso-map__svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Kort over adresserne">
      <rect className="lasso-map__land" x="0" y="0" width={W} height={H} />
      {roads.map((v) => (
        <g key={v}>
          {v < W ? <line className="lasso-map__road" x1={v} x2={v - H * 0.18} y1={0} y2={H} /> : null}
          {v < H ? <line className="lasso-map__road" x1={0} x2={W} y1={v} y2={v + W * 0.06} /> : null}
        </g>
      ))}
      {[...markers].sort((a, b) => (a.kind === "focus" ? 1 : 0) - (b.kind === "focus" ? 1 : 0)).map((m) => (
        <Pin key={m.key} m={m} active={active === m.key} onPick={onPick} />
      ))}
    </svg>
  );
}

/** 13.12: zoom-knapper (+/−) øverst til højre på kortet. */
function ZoomControls({ zoom, onZoom }: { zoom: number; onZoom: (z: number) => void }) {
  return (
    <div className="lasso-map__zoom" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="lasso-map__zoom-btn" aria-label="Zoom ind" disabled={zoom >= MAX_ZOOM} onClick={() => onZoom(Math.min(MAX_ZOOM, zoom * 1.6))}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <button type="button" className="lasso-map__zoom-btn" aria-label="Zoom ud" disabled={zoom <= 1} onClick={() => onZoom(Math.max(1, zoom / 1.6))}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M1.5 6h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
const MAX_ZOOM = 1.6 ** 4;

function Legend() {
  return (
    <div className="lasso-map__legend">
      <span className="lasso-map__legend-item">
        <svg width="12" height="16" viewBox="-8 -24 16 26" aria-hidden="true">
          <path className="lasso-map__pin" d="M0 0c-1.2-4.6-8-8.4-8-14.2a8 8 0 1116 0c0 5.8-6.8 9.6-8 14.2z" />
        </svg>
        Hovedadresse
      </span>
      <span className="lasso-map__legend-item">
        <svg width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true">
          <circle className="lasso-map__ring" r="5.5" />
        </svg>
        P-enhed / ejendom
      </span>
      <span className="lasso-map__legend-item">
        <svg width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true">
          <circle className="lasso-map__cluster" r="7" />
        </svg>
        Klynge (tal = antal)
      </span>
    </div>
  );
}

/**
 * 13.12: hovedadressens popup (ca. 260 × 60) står til højre for nålen, men flyttes (venstre, under, over),
 * hvis den ellers dækker en anden markør, så klynger og P-enheder altid er synlige.
 */
export function focusPopupPos(f: MapMarker, markers: readonly MapMarker[], W: number, H: number): { left: number; top: number } {
  const PW = 260;
  const PH = 60;
  const clampX = (x: number) => Math.min(Math.max(8, x), Math.max(8, W - PW - 8));
  const clampY = (y: number) => Math.min(Math.max(8, y), Math.max(8, H - PH - 8));
  const candidates = [
    { left: clampX(f.x + 14), top: clampY(f.y - 40) },
    { left: clampX(f.x - 14 - PW), top: clampY(f.y - 40) },
    { left: clampX(f.x - PW / 2), top: clampY(f.y + 14) },
    { left: clampX(f.x - PW / 2), top: clampY(f.y - 40 - PH) },
  ];
  const others = markers.filter((m) => m.kind !== "focus");
  const hits = (c: { left: number; top: number }) => others.filter((m) => m.x > c.left - 14 && m.x < c.left + PW + 14 && m.y > c.top - 14 && m.y < c.top + PH + 14).length;
  return candidates.reduce((best, c) => (hits(c) < hits(best) ? c : best), candidates[0]!);
}

/**
 * Kort, adresse, P-enheder og klynger (katalog 13.12, node AMO-0). Kølige flader (land #EEF0F2, vand
 * #F7F7F8, hvide veje) så koral kun bruges til markører: ink-nål = fokus (hovedadressen), blå ring =
 * relaterede adresser (P-enheder), koral klynge med antal. Klik på en markør åbner en popup, som er et
 * almindeligt hvidt kort med radius 8.
 * Mobil (26b.11): kortet er 160 px højt med markørkortet nederst; tryk på kortet åbner fuld skærm.
 */
export function CompanyMap({ map, title, error, onAction }: { map?: MapVM; title?: string; error?: string; onAction?: (a: ViewAction) => void }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const compact = isCompact(W);
  // 13.12: hovedadressens popup står åben fra start; klik på kortet lukker den.
  const [active, setActive] = useState<string | null>(FOCUS);
  const [zoom, setZoom] = useState(1);
  const [full, setFull] = useState(false);
  const [fullW, setFullW] = useState(0);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    const measure = () => setFullW(typeof window !== "undefined" ? window.innerWidth : 390);
    measure();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", measure);
    };
  }, [full]);

  const heading = title ?? "Adresser på kort";
  if (!map) {
    return (
      <Section title={heading} span="half" className="lasso-map">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={280} />}
      </Section>
    );
  }
  if (map.points.length === 0) {
    return (
      <Section title={heading} span="half" className="lasso-map">
        <DataState state="empty" reason={map.emptyReason ?? "Adresserne har ingen koordinater, så de kan ikke vises på kort."} height={160} />
        {map.source ? <SourceLine source={map.source} updated={map.updated} /> : null}
      </Section>
    );
  }
  const H = compact ? 160 : 280;
  const markers = layoutMap(map.points, W, H, 34, compact ? 1 : zoom);
  const focus = markers.find((m) => m.kind === "focus") ?? markers[0]!;
  const current = markers.find((m) => m.key === (active === FOCUS ? focus.key : active)) ?? null;
  const onOpen = onAction ? (p: MapPointVM) => p.lassoId && onAction({ kind: "open-company", lassoId: p.lassoId, name: p.name }) : undefined;
  const onRoute = onAction ? (p: MapPointVM) => onAction({ kind: "open-link", url: `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}` }) : undefined;
  const related = map.points.filter((p) => p.kind === "related").length;
  const subtitle = `${related ? `Hovedadresse og ${formatNumber(related)} ${related === 1 ? "anden adresse" : "andre adresser"}` : "Hovedadresse"}${map.missing ? `, ${formatNumber(map.missing)} uden koordinater` : ""}`;

  if (compact) {
    const fullH = typeof window !== "undefined" ? Math.max(320, window.innerHeight - 120) : 640;
    const fullMarkers = full && fullW > 0 ? layoutMap(map.points, fullW, fullH, 40) : [];
    const fullCurrent = fullMarkers.find((m) => m.key === active) ?? fullMarkers.find((m) => m.kind === "focus") ?? fullMarkers[0];
    const focusPoint = focus.points[0]!;
    // 26b.11: kortet er 160 px med hovedadressens markørkort lagt oven på kortets bund; tryk åbner fuld skærm.
    return (
      <Section title={heading} subtitle={subtitle} span="half" className="lasso-map">
        <div ref={ref} className="lasso-map__frame lasso-map__frame--compact" role="button" tabIndex={0} aria-label="Åbn kortet i fuld skærm" onClick={() => setFull(true)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setFull(true)}>
          {W > 0 ? <MapCanvas markers={layoutMap(map.points, W, H - 56, 28)} W={W} H={H} active={focus.key} onPick={() => setFull(true)} /> : null}
          {focus.kind === "focus" ? <FocusCard p={focusPoint} mobile onRoute={onRoute} /> : null}
        </div>
        {full ? (
          <div className="lasso-map-full" role="dialog" aria-modal="true" aria-label={heading}>
            <div className="lasso-map-full__head">
              <span className="lasso-map-full__title">{heading}</span>
              <button type="button" className="lasso-btn lasso-btn--sm" onClick={() => setFull(false)}>
                Luk kort
              </button>
            </div>
            {fullW > 0 ? <MapCanvas markers={fullMarkers} W={fullW} H={fullH} active={fullCurrent?.key ?? null} onPick={(m) => setActive(m.key)} /> : null}
            {fullCurrent ? <PointCard m={fullCurrent} onOpen={onOpen} /> : null}
          </div>
        ) : null}
      </Section>
    );
  }

  return (
    <Section title={heading} subtitle={subtitle} span="half" className="lasso-map">
      <div ref={ref} className="lasso-map__frame" onClick={() => setActive(null)}>
        {W > 0 ? <MapCanvas markers={markers} W={W} H={H} active={current?.key ?? null} onPick={(m) => setActive(m.key === current?.key ? null : m.key)} /> : null}
        <ZoomControls zoom={zoom} onZoom={setZoom} />
        {current ? (
          <div
            className={`lasso-map__popup${current.kind === "focus" ? " lasso-map__popup--focus" : ""}`}
            style={
              current.kind === "focus"
                ? focusPopupPos(current, markers, W, H)
                : { left: Math.min(Math.max(8, current.x - 120), Math.max(8, W - 248)), top: current.y + (current.y > H / 2 ? -12 : 16), transform: current.y > H / 2 ? "translateY(-100%)" : undefined }
            }
            onClick={(e) => e.stopPropagation()}
          >
            {current.kind === "focus" ? <FocusCard p={current.points[0]!} /> : <PointCard m={current} onOpen={onOpen} onClose={() => setActive(null)} />}
          </div>
        ) : null}
      </div>
      <Legend />
      {map.source ? <SourceLine source={map.source} updated={map.updated} /> : null}
    </Section>
  );
}
