import {
  buildActivityHeatmap,
  CHANGE_TYPES,
  type ActivityHeatmapVM,
  type Address,
  type ChangeEntryVM,
  type ChangeType,
  type FinancialsVM,
  type IndustryBenchmarkVM,
  type MapPointVM,
  type MapVM,
  type ProductionUnitVM,
  type ScoreHistoryVM,
  type ScoreVM,
} from "@lasso/spec";

/**
 * Eksempeldata til graferne i katalog 10, 13 og 18, som ikke har en bekræftet live-kilde:
 * scoremålerens hente-tilstande (10.1), scorehistorik (18.2), branchetal (13.6/13.10),
 * heatmap (13.11) og kort (13.12). Alt er deterministisk og mærket "Eksempeldata".
 */

interface DemoLike {
  lassoId: string;
  cvr?: string;
  name: string;
  status?: string;
  address?: Address;
  industryCode?: string;
  industryText?: string;
  growth: number;
}

const seedOf = (c: DemoLike) => Number(c.cvr?.slice(-2) ?? "0");

/**
 * 10.1: eksempler på alle hente-tilstande. Eksempel Revision Nord: ikke hentet (koster 1 kredit);
 * Eksempel Tømrer: henter (60 %); Eksempel Holding: kan ikke hentes (holdingselskab uden drift).
 * De øvrige aktive har en score. Lassos risikoscore 0-100, hvor 100 = høj risiko (Jakob 29.09); ingen
 * Creditsafe-fakta (kreditmaksimum, international score) under måleren.
 */
export function demoScore(c: DemoLike): ScoreVM {
  const lassoId = c.lassoId;
  if (c.cvr === "99000003") return { lassoId, score: null, state: "notfetched", cost: "1 kredit", reason: "Scoren er ikke hentet for virksomheden endnu. Den beregnes, når du beder om den." };
  if (c.cvr === "99000006") return { lassoId, score: null, state: "fetching", progress: 0.6, reason: "Beregner scoren ud fra regnskabsnøgletal, status og observationer. Det tager 5-45 sekunder." };
  if (c.cvr === "99000010") return { lassoId, score: null, state: "unavailable", reason: "Holdingselskaber uden egen drift får ingen score, fordi der ikke er driftstal at vurdere." };
  if (c.status !== "Aktiv") return { lassoId, score: null, state: "unavailable", reason: `Virksomheden er ${c.status?.toLowerCase() ?? "ikke aktiv"}, og der beregnes ikke score for ophørte virksomheder.` };
  const seed = seedOf(c);
  const score = Math.max(5, Math.min(95, 22 + ((seed * 13) % 70)));
  return { lassoId, score, state: "ok", source: "Eksempeldata", updated: "2026-09-12" };
}

/**
 * 18.2: hentninger med uregelmæssige mellemrum (lange huller er pointen). Seneste punkt = den
 * aktuelle demoscore; historikken bevæger sig mod den. Ingen score = ingen historik.
 */
export function demoScoreHistory(c: DemoLike, score: ScoreVM): ScoreHistoryVM {
  if (score.score === null) return { lassoId: c.lassoId, points: [], reason: score.reason ?? "Scoren er ikke hentet endnu, så der er ingen historik." };
  const seed = seedOf(c);
  const dates = ["2024-02-12", "2024-06-03", "2024-06-24", "2025-01-15", "2025-09-08", "2026-03-02", "2026-09-12"];
  const final = score.score;
  const start = Math.max(4, Math.min(96, final + (c.growth < 0 ? -24 : 14) + (seed % 7)));
  const points = dates.map((date, i) => {
    const t = i / (dates.length - 1);
    const wobble = i === 0 || i === dates.length - 1 ? 0 : ((seed * (i + 2)) % 9) - 4;
    const v = Math.round(Math.max(1, Math.min(99, start + (final - start) * t + wobble)));
    return { date, score: i === dates.length - 1 ? final : v };
  });
  const word = (v: number) => (v < 60 ? "Lav risiko" : v < 80 ? "Moderat risiko" : "Høj risiko");
  return { lassoId: c.lassoId, points: points.map((p) => ({ ...p, label: word(p.score) })), source: "Eksempeldata", updated: "2026-09-12" };
}

/**
 * 13.6/13.10: branchens median pr. år. Afledt af virksomhedens egne nøgletal med en fast forskydning
 * pr. branche, så måleren viser både grøn, gul og rød på tværs af demovirksomhederne.
 */
export function demoIndustry(c: DemoLike, f: FinancialsVM): IndustryBenchmarkVM {
  if (!c.industryCode || f.years.length === 0) {
    return { lassoId: c.lassoId, state: "unavailable", reason: "Virksomheden har ingen regnskaber at sammenligne med branchen.", years: [] };
  }
  const seed = seedOf(c);
  // Branchens vækst er lavere end de hurtige og højere end de faldende virksomheders.
  const branchGrowth = 0.035 + (seed % 3) / 100;
  const first = f.years[0]!;
  const bias = [1.25, 0.8, 1.05, 1.6, 0.95, 1.35][seed % 6]!;
  const years = f.years.map((y, i) => {
    const grow = Math.pow(1 + branchGrowth, i);
    const m: IndustryBenchmarkVM["years"][number]["median"] = {
      bruttofortjeneste: typeof first.grossProfit === "number" ? Math.round(first.grossProfit * 0.92 * grow) : null,
      omsaetning: typeof first.revenue === "number" ? Math.round(first.revenue * 0.95 * grow) : null,
      resultat: typeof first.profit === "number" ? Math.round(Math.abs(first.profit) * 0.9 * grow) : null,
      egenkapital: typeof first.equity === "number" ? Math.round(first.equity * 0.9 * grow) : null,
      ansatte: typeof first.employees === "number" ? Math.max(1, Math.round(first.employees * grow)) : null,
      soliditetsgrad: typeof y.soliditetsgrad === "number" ? Math.round((y.soliditetsgrad / bias) * 10) / 10 : 32.5,
      overskudsgrad: typeof y.overskudsgrad === "number" ? Math.round((y.overskudsgrad * (bias > 1.2 ? 1.9 : 0.9)) * 10) / 10 : 6.2,
      // Branchens likviditetsgrad står fast (ikke afledt af virksomhedens), så måleren kan blive både grøn, gul og rød.
      likviditetsgrad: Math.round((118 + (seed % 5) * 9) * 10) / 10,
    };
    return { year: y.year, median: m };
  });
  return {
    lassoId: c.lassoId,
    state: "ok",
    industryCode: c.industryCode,
    industryText: c.industryText,
    peers: 180 + ((seed * 37) % 900),
    years,
    source: "Eksempeldata for branchen",
    updated: "2026-09-12",
  };
}

/** 13.11: ændringer i demolisten "Kunder" fordelt over de seneste 24 måneder, med en travl regnskabssæson. */
export function demoHeatmap(opts: { list?: string; months: number; types?: readonly ChangeType[] }, listName: string, now = new Date()): ActivityHeatmapVM {
  if (opts.list && opts.list.trim().toLowerCase() !== listName.toLowerCase()) {
    return { listName: opts.list, months: [], rows: [], total: 0, emptyReason: `Der er ingen overvågningsliste med navnet "${opts.list}" i demodata (kun "${listName}").` };
  }
  const entries: Pick<ChangeEntryVM, "type" | "at" | "count">[] = [];
  for (let back = 0; back < 24; back++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 10));
    const month = d.getUTCMonth(); // 0 = januar
    CHANGE_TYPES.forEach((type, ti) => {
      // Regnskaber klumper sig i april–juni, stamdata hver kvartalsskifte, resten spredt.
      const base =
        type === "regnskab" ? ([3, 4, 5].includes(month) ? 9 + ((back + ti) % 4) : month === 6 ? 3 : 0) :
        type === "stamdata" ? ([0, 3, 6, 9].includes(month) ? 7 : 1 + ((back * 3 + ti) % 3)) :
        type === "ledelse" ? (back * 7 + ti) % 4 :
        type === "ejerskab" ? ((back * 5) % 6 === 0 ? 2 : back % 4 === 1 ? 1 : 0) :
        type === "status" ? (back % 7 === 2 ? 1 : 0) :
        (back * 11 + 3) % 5 === 0 ? 3 : (back % 3 === 0 ? 1 : 0);
      if (base > 0) entries.push({ type, at: d.toISOString(), count: base });
    });
  }
  return buildActivityHeatmap(entries, { months: opts.months, now, types: opts.types, listName, source: "Eksempeldata", updated: now.toISOString().slice(0, 10) });
}

/** Omtrentlige koordinater for demoadressernes postnumre (by-midte). */
const ZIP_COORDS: Record<string, [number, number]> = {
  "8600": [56.1697, 9.5452],
  "8000": [56.1567, 10.2108],
  "9000": [57.0488, 9.9217],
  "7100": [55.7093, 9.5357],
  "8200": [56.186, 10.173],
  "8800": [56.4532, 9.402],
  "1150": [55.6795, 12.578],
  "7400": [56.1393, 8.9738],
  "8660": [56.0395, 9.927],
  "6700": [55.4765, 8.4594],
  "8700": [55.8607, 9.8503],
  "7830": [56.483, 8.78],
  "9381": [57.16, 9.96],
};

/** Deterministisk lille forskydning pr. gade, så to adresser i samme by ikke ligger oven i hinanden. */
function coordsFor(a: Address | undefined): [number, number] | null {
  const base = a?.zip ? ZIP_COORDS[a.zip] : undefined;
  if (!base) return null;
  const h = [...(a?.street ?? "")].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) % 10007, 7);
  return [base[0] + ((h % 21) - 10) / 2500, base[1] + (((h >> 3) % 21) - 10) / 1500];
}

const addressText = (a?: Address) => [a?.street, [a?.zip, a?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || undefined;

/**
 * 13.12: hovedadressen (focus), P-enhederne og koncernens øvrige selskaber som relaterede adresser.
 * Ophørte P-enheder udelades. Koordinaterne er omtrentlige (postnummerets midte).
 */
export function demoMap(c: DemoLike, units: readonly ProductionUnitVM[], group: readonly DemoLike[]): MapVM {
  const points: MapPointVM[] = [];
  const focus = coordsFor(c.address);
  if (focus) points.push({ id: c.lassoId, kind: "focus", name: c.name, address: addressText(c.address), lat: focus[0], lon: focus[1], meta: "Hovedadresse" });
  let missing = 0;
  for (const u of units) {
    if (u.isMain || u.statusKind === "inactive") continue;
    const at = coordsFor(u.address);
    if (!at) {
      missing++;
      continue;
    }
    points.push({ id: `p-${u.pNumber ?? points.length}`, kind: "related", name: u.name ?? "Produktionsenhed", address: addressText(u.address), lat: at[0], lon: at[1], meta: `P-nr. ${u.pNumber ?? "ukendt"}${typeof u.employees === "number" ? `, ${u.employees} ansatte` : ""}` });
  }
  for (const g of group) {
    if (g.lassoId === c.lassoId) continue;
    const at = coordsFor(g.address);
    if (!at) continue;
    points.push({ id: g.lassoId, kind: "related", name: g.name, address: addressText(g.address), lat: at[0], lon: at[1], meta: "Samme koncern", lassoId: g.lassoId });
  }
  if (points.length === 0) return { lassoId: c.lassoId, points: [], emptyReason: "Adressen har ingen koordinater i eksempeldata." };
  return { lassoId: c.lassoId, points, ...(missing ? { missing } : {}), source: "Eksempeldata, koordinater omtrentlige", updated: "2026-09-12" };
}
