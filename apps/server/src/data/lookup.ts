import type { CompanyRowVM } from "@lasso/spec";

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

/** CVR-nummer eller Lasso-ID (i modsætning til et navn). */
export function isCompanyRef(ref: string): boolean {
  const t = ref.trim();
  return /^\d{8}$/.test(t.replace(/[\s-]/g, "")) || /^[A-Z]+-\d+-\d+$/i.test(t);
}
