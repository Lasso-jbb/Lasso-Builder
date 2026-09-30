import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fontFaceCss } from "../fonts.js";
import { inspect, type Report } from "./inspect.js";

/**
 * En ramme med en rigtig skærmbredde: indholdet tegnes i en iframe på `vw` px, så modulets
 * container-queries (@container lasso) og media-queries (fx max-width 1199px) er præcis dem,
 * det får på skærmen. Rammen skaleres ned visuelt, hvis den ikke er plads, og kan beskæres til
 * modulets celle (`crop`), så en ¼-celle på 1200-gitteret ikke står i 1200 px tom flade.
 * React-roden lever i iframens dokument, så klik, faner og "Vis alle" virker.
 */
export function Frame({
  vw,
  children,
  crop,
  cropBox,
  cropContent = false,
  mark = false,
  onReport,
  minHeight = 120,
  maxScale = 1,
  eager = false,
  label,
  fit = true,
}: {
  vw: number;
  children: ReactNode;
  /** CSS-selektor for cellen, rammen beskæres til (fx ".lasso-cell"). */
  crop?: string;
  /** Fast beskæring i px (venstre kant og bredde), fx galleriets gitterbredde. */
  cropBox?: { left: number; width: number };
  /** Beskær til indholdets faktiske bredde (små UI-elementer, der ikke fylder hele skærmen). */
  cropContent?: boolean;
  /** Markér de elementer, valideringen fandt (rød kant). */
  mark?: boolean;
  onReport?: (r: Report) => void;
  minHeight?: number;
  maxScale?: number;
  /** Tegn med det samme (ellers først når rammen nærmer sig skærmen). */
  eager?: boolean;
  label?: string;
  /** Skalér ned, så rammen passer i bredden (standard); false = faktisk størrelse med vandret rulning. */
  fit?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const root = useRef<Root | null>(null);
  const [avail, setAvail] = useState(0);
  const [visible, setVisible] = useState(eager);
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState({ h: minHeight, left: 0, width: vw });
  const report = useRef<Report | null>(null);
  const markRef = useRef(mark);
  markRef.current = mark;
  const onReportRef = useRef(onReport);
  onReportRef.current = onReport;

  // Tilgængelig bredde og om rammen er i nærheden af skærmen.
  useEffect(() => {
    const el = host.current!;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    setAvail(el.clientWidth);
    let io: IntersectionObserver | undefined;
    if (!eager) {
      io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: "600px 0px" });
      io.observe(el);
    }
    return () => {
      ro.disconnect();
      io?.disconnect();
    };
  }, [eager]);

  // Iframens dokument: stilarkene fra designguiden (samme styles.css som appen) og Poppins.
  const onLoad = () => {
    const doc = frame.current?.contentDocument;
    if (!doc || root.current) return;
    for (const node of document.querySelectorAll('style, link[rel="stylesheet"]')) doc.head.appendChild(node.cloneNode(true));
    const base = doc.createElement("style");
    base.textContent = `${fontFaceCss(["400", "500", "600", "700"])}html,body{margin:0;padding:0;background:transparent;overflow:hidden;scrollbar-width:none}#r{display:flow-root}.dg-mark{outline:2px solid #e5484d!important;outline-offset:-1px;background-color:rgb(229 72 77 / 0.08)!important}.dg-mark-info{outline:2px dashed #d08700!important;outline-offset:-1px}`;
    doc.head.appendChild(base);
    root.current = createRoot(doc.getElementById("r")!);
    setReady(true);
  };

  useEffect(() => () => {
    const r = root.current;
    root.current = null;
    // Afmonteres efter React er færdig med denne gengivelse.
    if (r) setTimeout(() => r.unmount(), 0);
  }, []);

  useLayoutEffect(() => {
    if (ready) root.current?.render(<>{children}</>);
  });

  // Måling: højde, cellens placering (beskæring) og validering, når indholdet har sat sig.
  useEffect(() => {
    if (!ready) return;
    const doc = frame.current!.contentDocument!;
    const win = frame.current!.contentWindow as (Window & typeof globalThis) | null;
    if (!win) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      const cell = crop ? doc.querySelector(crop) : null;
      const h = Math.max(minHeight, Math.ceil(doc.getElementById("r")!.getBoundingClientRect().height));
      let left = cropBox?.left ?? 0;
      let width = cropBox ? Math.min(vw - left, cropBox.width) : vw;
      if (cropContent && !cell) {
        let right = 0;
        for (const el of doc.getElementById("r")!.querySelectorAll("*")) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.right > right && r.right <= vw) right = r.right;
        }
        if (right > 0 && right < vw - 40) width = Math.min(width, Math.ceil(right) + 24);
      }
      if (cell) {
        const r = cell.getBoundingClientRect();
        if (r.width > 0 && r.width < vw - 40) {
          left = Math.max(0, Math.floor(r.left) - 16);
          width = Math.min(vw - left, Math.ceil(r.width) + 32);
        }
      }
      setSize((s) => (s.h === h && s.left === left && s.width === width ? s : { h, left, width }));
      clearTimeout(t);
      t = setTimeout(() => {
        const rep = inspect(doc, cell ?? doc.querySelector(".lasso-cell") ?? doc.querySelector(".lasso-root"));
        report.current = rep;
        onReportRef.current?.(rep);
        applyMarks(doc, rep, markRef.current);
        // Markeringen ændrer klasser; de ændringer skal ikke udløse en ny måling.
        mo.takeRecords();
      }, 900);
    };
    const ro = new win.ResizeObserver(measure);
    ro.observe(doc.getElementById("r")!);
    const mo: MutationObserver = new win.MutationObserver((records) => {
      if (records.every((r) => r.type === "attributes" && r.attributeName === "class" && /dg-mark/.test(`${r.oldValue ?? ""} ${(r.target as Element).className}`))) return;
      measure();
    });
    mo.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "style"], attributeOldValue: true });
    measure();
    return () => {
      ro.disconnect();
      mo.disconnect();
      clearTimeout(t);
    };
  }, [ready, vw, crop, cropBox?.left, cropBox?.width, cropContent, minHeight]);

  useEffect(() => {
    const doc = frame.current?.contentDocument;
    if (doc && report.current) applyMarks(doc, report.current, mark);
  }, [mark]);

  const scale = fit && avail > 0 ? Math.min(maxScale, avail / size.width) : 1;
  return (
    <div ref={host} className={`dg-frame${fit ? "" : " dg-frame--actual"}`} aria-label={label}>
      <div className="dg-frame__clip" style={{ width: size.width * scale, height: size.h * scale }}>
        {visible ? (
          <iframe
            ref={frame}
            title={label ?? `Ramme ${vw} px`}
            srcDoc={'<!doctype html><html lang="da"><meta charset="utf-8"><body><div id="r"></div>'}
            onLoad={onLoad}
            style={{ width: vw, height: size.h, transform: `scale(${scale}) translateX(${-size.left}px)`, transformOrigin: "0 0" }}
          />
        ) : null}
      </div>
    </div>
  );
}

function applyMarks(doc: Document, rep: Report, on: boolean) {
  for (const el of doc.querySelectorAll(".dg-mark, .dg-mark-info")) el.classList.remove("dg-mark", "dg-mark-info");
  if (!on) return;
  for (const f of rep.findings) {
    for (const el of f.els ?? []) el.classList.add(f.kind === "overflow" ? "dg-mark" : "dg-mark-info");
  }
}
