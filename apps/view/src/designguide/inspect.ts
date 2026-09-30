/**
 * Validering af et tegnet modul i sin ramme: løber noget ud over cellen, ruller noget vandret,
 * afkortes tekst, og hvilken tilstand står modulet i (fyldt, henter, tom, fejl, ikke tilgængelig).
 * Kører i rammens dokument (iframe), så container- og media-queries er dem, modulet får på skærmen.
 */

export type Verdict = "ok" | "info" | "problem";

export interface Finding {
  kind: "overflow" | "bleed" | "page-overflow" | "scroll" | "truncated" | "state" | "empty";
  text: string;
  /** Elementerne, der markeres i rammen. */
  els?: Element[];
}

export interface Report {
  verdict: Verdict;
  /** Kort etiket til chippen, fx "Overløb (2)". */
  label: string;
  state: "fyldt" | "henter" | "tom" | "fejl" | "ikke-tilgaengelig" | "intet";
  findings: Finding[];
  /** Cellens bredde i px, som den faktisk blev tegnet. */
  cellWidth: number;
}

const describe = (el: Element): string => {
  const cls = [...el.classList].filter((c) => c.startsWith("lasso")).slice(0, 2).join(".");
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}${text ? ` "${text}${text.length === 40 ? "…" : ""}"` : ""}`;
};

/** Klippes elementet af en forfader mellem det og cellen (overflow ≠ visible)? Så ses overløbet ikke. */
function clipped(el: Element, stop: Element, win: Window): boolean {
  for (let p = el.parentElement; p && p !== stop; p = p.parentElement) {
    const s = win.getComputedStyle(p);
    if (s.overflowX !== "visible" || s.clipPath !== "none" || s.contain.includes("paint")) return true;
  }
  return false;
}

const hidden = (el: Element, win: Window) => {
  const s = win.getComputedStyle(el);
  return s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0 || (s.position === "absolute" && s.clip !== "auto" && s.clip !== "");
};

export function inspect(doc: Document, cell: Element | null): Report {
  const win = doc.defaultView!;
  const root = cell ?? doc.querySelector(".lasso-root") ?? doc.body;
  const box = root.getBoundingClientRect();
  const findings: Finding[] = [];

  // 1. Overløb: synlige elementer, der rækker ud over cellen uden at blive klippet.
  const offenders: Element[] = [];
  for (const el of root.querySelectorAll("*")) {
    if (el instanceof win.SVGElement && el.ownerSVGElement) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right <= box.right + 1.5 && r.left >= box.left - 1.5) continue;
    if (offenders.some((o) => o.contains(el))) continue;
    if (hidden(el, win) || clipped(el, root, win)) continue;
    offenders.push(el);
  }
  // Til kanten: en rullende række (fx opfølgningsknapper og filtre på mobil) må gå ud over cellens luft til
  // skærmkanten, når cellen fylder hele rækken og intet går ud over skærmen. Det er bevidst, ikke overløb.
  const vw = doc.documentElement.clientWidth;
  const fullRow = box.width >= vw - 120;
  const isBleed = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (!fullRow || r.left < -1 || r.right > vw + 1) return false;
    const s = win.getComputedStyle(el);
    return s.overflowX === "auto" || s.overflowX === "scroll" || s.overflowX === "hidden";
  };
  const bleeds = offenders.filter(isBleed);
  if (bleeds.length) {
    offenders.splice(0, offenders.length, ...offenders.filter((o) => !bleeds.includes(o)));
    findings.push({ kind: "bleed", text: `${bleeds.length === 1 ? "Én rullende række går" : `${bleeds.length} rullende rækker går`} ud til skærmkanten (bevidst): ${bleeds.slice(0, 2).map(describe).join(", ")}`, els: bleeds });
  }
  if (offenders.length) {
    const worst = Math.max(...offenders.map((o) => Math.max(o.getBoundingClientRect().right - box.right, box.left - o.getBoundingClientRect().left)));
    findings.push({ kind: "overflow", text: `${offenders.length} ${offenders.length === 1 ? "element løber" : "elementer løber"} op til ${Math.round(worst)} px ud over cellen: ${offenders.slice(0, 3).map(describe).join(", ")}`, els: offenders });
  }

  // 2. Hele siden bliver bredere end skærmen (vandret rulning af siden).
  const page = doc.documentElement.scrollWidth - doc.documentElement.clientWidth;
  if (page > 1) findings.push({ kind: "page-overflow", text: `Siden bliver ${page} px bredere end skærmen og ruller vandret.` });

  // 3. Vandret rulning inde i modulet (tilladt i tabeller, men værd at se).
  const scrollers = [...root.querySelectorAll("*")].filter((el) => {
    if (!(el instanceof win.HTMLElement) || el.scrollWidth <= el.clientWidth + 1) return false;
    const s = win.getComputedStyle(el);
    return (s.overflowX === "auto" || s.overflowX === "scroll") && !hidden(el, win);
  });
  if (scrollers.length) findings.push({ kind: "scroll", text: `${scrollers.length === 1 ? "Ét område ruller" : `${scrollers.length} områder ruller`} vandret: ${scrollers.slice(0, 2).map(describe).join(", ")}`, els: scrollers });

  // 4. Afkortet tekst (ellipsis): læses ikke fuldt i denne bredde.
  const truncated = [...root.querySelectorAll("*")].filter((el) => {
    if (!(el instanceof win.HTMLElement) || el.scrollWidth <= el.clientWidth + 1 || !el.textContent?.trim()) return false;
    const s = win.getComputedStyle(el);
    return s.textOverflow === "ellipsis" && s.overflowX !== "visible" && !hidden(el, win);
  });
  if (truncated.length) findings.push({ kind: "truncated", text: `${truncated.length} ${truncated.length === 1 ? "tekst afkortes" : "tekster afkortes"} med …: ${truncated.slice(0, 3).map((e) => `"${(e.textContent ?? "").trim().slice(0, 30)}"`).join(", ")}`, els: truncated });

  // 5. Tilstand: fyldt, eller en af de fem tilstande (10b).
  const text = (root.textContent ?? "").replace(/\s+/g, " ").trim();
  let state: Report["state"] = "fyldt";
  const skel = root.querySelector(".lasso-skel, .lasso-skeleton, .lasso-state--loading");
  const st = root.querySelector<HTMLElement>(".lasso-state--unavailable, .lasso-state--error, .lasso-state--ondemand, .lasso-state-panel, .lasso-state:not(.lasso-state--positive)");
  if (text.length < 3 && !root.querySelector("svg,canvas,img")) state = "intet";
  else if (st && text.length - (st.textContent ?? "").length < 80) {
    state = st.className.includes("--error") ? "fejl" : st.className.includes("--unavailable") ? "ikke-tilgaengelig" : "tom";
    findings.push({ kind: "state", text: (st.textContent ?? "").replace(/\s+/g, " ").trim() || "Ingen data." });
  } else if (skel && text.length < 60) state = "henter";
  if (state === "intet") findings.push({ kind: "empty", text: "Modulet tegner intet med disse data (det udelades på siden)." });

  const problems = findings.filter((f) => f.kind === "overflow" || f.kind === "page-overflow");
  const verdict: Verdict = problems.length ? "problem" : findings.some((f) => f.kind === "truncated" || f.kind === "scroll" || f.kind === "bleed") ? "info" : "ok";
  const label = problems.length
    ? `Overløb${offenders.length ? ` (${offenders.length})` : ""}`
    : state !== "fyldt"
      ? { henter: "Henter", tom: "Tom tilstand", fejl: "Fejl", "ikke-tilgaengelig": "Ikke tilgængelig", intet: "Viser intet" }[state]
      : truncated.length
        ? `Afkortet (${truncated.length})`
        : scrollers.length
          ? "Ruller vandret"
          : "Passer";
  return { verdict, label, state, findings, cellWidth: Math.round(box.width) };
}
