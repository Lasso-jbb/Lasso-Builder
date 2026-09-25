import type { CompanyRowVM } from "@lasso/spec";
import type { DataProvider } from "./provider.js";

/**
 * Finder den virksomhed, brugeren mener, ud fra et navn. Lassos søgning sorterer
 * efter egen relevans, så "Novo Nordisk" giver fonden og personaleforeninger før
 * Novo Nordisk A/S. Her vinder et navn, der matcher præcist uden selskabsform.
 */

const LEGAL_FORMS = /\b(a\/s|aps|i\/s|p\/s|k\/s|ivs|a\.m\.b\.a|amba|f\.m\.b\.a|fmba|s\.m\.b\.a|smba)\.?$/;

export function normalizeCompanyName(name: string): string {
  const n = name.toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim().replace(LEGAL_FORMS, "").trim();
  return n.replace(/[^\p{L}\p{N}& ]/gu, " ").replace(/\s+/g, " ").trim();
}

function score(query: string, row: CompanyRowVM): number {
  const q = normalizeCompanyName(query);
  const n = normalizeCompanyName(row.name);
  if (!q) return 0;
  if (n === q) return 3;
  if (n.startsWith(`${q} `)) return 2;
  if (n.includes(q)) return 1;
  return 0;
}

export interface CompanyPick {
  pick: CompanyRowVM;
  alternatives: CompanyRowVM[];
}

/** Bedste match: præcist navn > navnet starter med søgeordet > indeholder det; aktive før ophørte; ellers Lassos rækkefølge. */
export function pickCompany(query: string, rows: readonly CompanyRowVM[]): CompanyPick | null {
  if (rows.length === 0) return null;
  const ranked = rows
    .map((row, index) => ({ row, index, s: score(query, row), inactive: row.statusKind === "inactive" ? 1 : 0 }))
    .sort((a, b) => b.s - a.s || a.inactive - b.inactive || a.index - b.index);
  return { pick: ranked[0]!.row, alternatives: ranked.slice(1, 5).map((r) => r.row) };
}

/**
 * Slår et navn op og vælger bedste match. Lasso rangerer ikke altid selskabet selv
 * højt: "Novo Nordisk" gav 20 foreninger m.m. uden Novo Nordisk A/S (25.09.2026).
 * Uden præcist match søges der derfor også på navnet med selskabsform.
 */
export async function findCompany(provider: DataProvider, name: string): Promise<CompanyPick | null> {
  const wanted = normalizeCompanyName(name);
  let rows = await provider.findCompanies(name, 20);
  if (!rows.some((r) => normalizeCompanyName(r.name) === wanted) && !LEGAL_FORMS.test(name.toLowerCase().trim())) {
    const seen = new Set(rows.map((r) => r.lassoId));
    for (const form of ["A/S", "ApS"]) {
      const extra = await provider.findCompanies(`${name} ${form}`, 5);
      rows = [...rows, ...extra.filter((r) => !seen.has(r.lassoId) && seen.add(r.lassoId))];
      if (rows.some((r) => normalizeCompanyName(r.name) === wanted)) break;
    }
  }
  return pickCompany(name, rows);
}

/** CVR-nummer eller Lasso-ID (i modsætning til et navn). */
export function isCompanyRef(ref: string): boolean {
  const t = ref.trim();
  return /^\d{8}$/.test(t.replace(/[\s-]/g, "")) || /^[A-Z]+-\d+-\d+$/i.test(t);
}
