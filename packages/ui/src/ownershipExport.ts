/**
 * Eksport af ejerdiagrammet (14.1, layoutregel 3): hele grafen, ikke kun udsnittet på lærredet,
 * med legende og dato, som selvstændig SVG. PNG tegnes derfra på et lærred; PDF er browserens
 * udskrift af samme SVG (print.ts). Kun i browseren; uden document gør funktionerne ingenting.
 */

/** Egenskaber, der kopieres fra de beregnede stilarter, så SVG'en ser ens ud uden styles.css. */
const PROPS = ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-opacity", "opacity", "font-size", "font-weight", "font-family", "letter-spacing"] as const;

export interface ExportMeta {
  title: string;
  /** "Pr. 25.09.2026" eller "Pr. i dag, 29.09.2026". */
  dateLine: string;
  /** Legendens punkter som tekst (ikon + ord, regel 7). */
  legend: readonly string[];
  source: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Kopi af diagrammets <g> i fuld størrelse (skala 1) med stilarterne skrevet ind. */
export function svgForExport(svg: SVGSVGElement, size: { width: number; height: number }, meta: ExportMeta): string | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const group = svg.querySelector<SVGGElement>("g[data-od-graph]");
  if (!group) return null;
  const clone = group.cloneNode(true) as SVGGElement;
  const src = [group, ...Array.from(group.querySelectorAll<SVGElement>("*"))];
  const dst = [clone, ...Array.from(clone.querySelectorAll<SVGElement>("*"))];
  src.forEach((el, i) => {
    const cs = window.getComputedStyle(el);
    const target = dst[i]!;
    const style = PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";");
    target.setAttribute("style", style);
    target.removeAttribute("class");
    target.removeAttribute("tabindex");
    target.removeAttribute("role");
    if (cs.getPropertyValue("filter") !== "none") target.style.filter = "none";
  });
  clone.setAttribute("transform", "translate(0,56)");
  const defsEl = svg.querySelector("defs");
  let defs = "";
  if (defsEl) {
    const copy = defsEl.cloneNode(true) as SVGDefsElement;
    const from = Array.from(defsEl.querySelectorAll<SVGElement>("path"));
    Array.from(copy.querySelectorAll<SVGElement>("path")).forEach((el, i) => {
      const cs = window.getComputedStyle(from[i]!);
      el.setAttribute("style", `fill:${cs.getPropertyValue("fill")};stroke:none`);
      el.removeAttribute("class");
    });
    defs = copy.outerHTML;
  }
  const ink = window.getComputedStyle(svg).getPropertyValue("--lasso-text").trim() || "#16181d";
  const muted = window.getComputedStyle(svg).getPropertyValue("--lasso-muted").trim() || "#5b6068";
  const bg = window.getComputedStyle(svg).getPropertyValue("--lasso-surface").trim() || "#ffffff";
  const legendTop = size.height + 56 + 16;
  const legend = meta.legend
    .map((t, i) => `<text x="${24 + (i % 3) * 260}" y="${legendTop + 16 + Math.floor(i / 3) * 18}" style="font-size:11px;fill:${muted};font-family:Poppins,system-ui,sans-serif">${esc(t)}</text>`)
    .join("");
  const rows = Math.ceil(meta.legend.length / 3);
  const W = Math.max(size.width, 800);
  const H = legendTop + rows * 18 + 36;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="100%" height="100%" fill="${bg}"/>`,
    defs,
    `<text x="24" y="28" style="font-size:16px;font-weight:600;fill:${ink};font-family:Poppins,system-ui,sans-serif">${esc(meta.title)}</text>`,
    `<text x="24" y="46" style="font-size:12px;fill:${muted};font-family:Poppins,system-ui,sans-serif">${esc(meta.dateLine)}</text>`,
    clone.outerHTML,
    legend,
    `<text x="24" y="${H - 14}" style="font-size:11px;fill:${muted};font-family:Poppins,system-ui,sans-serif">${esc(meta.source)}</text>`,
    `</svg>`,
  ].join("");
}

/** SVG → PNG (2× opløsning) → download. Svarer false, hvis browseren ikke kan. */
export async function downloadPng(svgText: string, filename: string): Promise<boolean> {
  if (typeof document === "undefined" || typeof Image === "undefined") return false;
  const m = /width="(\d+)" height="(\d+)"/.exec(svgText);
  const w = Number(m?.[1] ?? 800);
  const h = Number(m?.[2] ?? 600);
  const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG kunne ikke tegnes"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    const a = document.createElement("a");
    a.download = filename;
    a.href = canvas.toDataURL("image/png");
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}
