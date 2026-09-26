import type { PersonSearchRowVM } from "@lasso/spec";
import type { DataProvider } from "./provider.js";

/** Navn uden store bogstaver, tegnsætning og dobbelte mellemrum. */
export function normalizePersonName(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
}

function score(query: string, row: PersonSearchRowVM): number {
  const q = normalizePersonName(query);
  const n = normalizePersonName(row.name);
  if (!q) return 0;
  if (n === q) return 3;
  // "Mette Holm" matcher "Mette Holm Jensen" og "Mette Jensen Holm" bedre end blot et fornavn.
  const words = q.split(" ");
  if (words.every((w) => n.split(" ").includes(w))) return 2;
  if (n.includes(q)) return 1;
  return 0;
}

export interface PersonPick {
  pick: PersonSearchRowVM;
  alternatives: PersonSearchRowVM[];
}

/** Bedste match: præcist navn > alle ord i navnet > indeholder søgeordet; ellers Lassos rækkefølge. */
export function pickPerson(query: string, rows: readonly PersonSearchRowVM[]): PersonPick | null {
  if (rows.length === 0) return null;
  const ranked = rows.map((row, index) => ({ row, index, s: score(query, row) })).sort((a, b) => b.s - a.s || a.index - b.index);
  return { pick: ranked[0]!.row, alternatives: ranked.slice(1, 5).map((r) => r.row) };
}

export async function findPerson(provider: DataProvider, name: string): Promise<PersonPick | null> {
  return pickPerson(name, await provider.findPersons(name, 20));
}
