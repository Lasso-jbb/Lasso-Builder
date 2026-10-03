import { isPersonId, toLassoId } from "@lasso/spec";
import { findCompany, isCompanyRef, normalizeCompanyName } from "../data/lookup.js";
import { normalizePersonName, pickPerson } from "../data/personLookup.js";
import type { UseCaseCtx } from "./context.js";

/**
 * Navneopslag til chattens valgmenu (docs/chat.md): hvem mener brugeren med "Jakob"? Giver kandidater
 * med id, navn og en undertitel, uden at bygge en visning (search_persons/search_companies viser en tabel).
 * De åbne faner fra konteksten tæller som præcise match og står først, så "vis alt om Jakob", mens Jakobs
 * fane er åben, finder ham uden at søge.
 */

export interface ResolveEntityInput {
  kind: "company" | "person";
  query: string;
  /** Højst så mange kandidater. Standard 5, højst 10. */
  limit?: number;
}

export interface EntityCandidate {
  kind: "company" | "person";
  id: string;
  name: string;
  /** Virksomhed: by, CVR og status; person: by. */
  subtitle: string;
}

/** En åben fane i chatten (chat/context.ts), som opslaget kan matche på navn eller id. */
export interface OpenEntity {
  kind: "company" | "person";
  id: string;
  name: string;
}

const MAX_LIMIT = 10;

function openMatches(open: readonly OpenEntity[], kind: ResolveEntityInput["kind"], query: string): EntityCandidate[] {
  const normalize = kind === "person" ? normalizePersonName : normalizeCompanyName;
  const q = normalize(query);
  if (!q) return [];
  const words = q.split(" ");
  return open
    .filter((o) => o.kind === kind)
    .filter((o) => {
      const n = normalize(o.name);
      return o.id === query.trim() || n === q || words.every((w) => n.split(" ").includes(w));
    })
    .map((o) => ({ kind, id: o.id, name: o.name, subtitle: "åben fane" }));
}

/** Kandidater til et navn (eller et id): de åbne faner først, så Lassos navnesøgning rangeret som i show_*. */
export async function resolveEntity(ctx: Pick<UseCaseCtx, "provider" | "config">, input: ResolveEntityInput, open: readonly OpenEntity[] = []): Promise<EntityCandidate[]> {
  const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit ?? 5));
  const query = input.query.trim();
  const found: EntityCandidate[] = [...openMatches(open, input.kind, query)];
  const seen = new Set(found.map((c) => c.id));
  const push = (c: EntityCandidate) => {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      found.push(c);
    }
  };

  if (input.kind === "person") {
    if (isPersonId(query)) {
      try {
        const p = await ctx.provider.person(query);
        push({ kind: "person", id: p.lassoId, name: p.name, subtitle: p.city ?? "" });
      } catch {
        // Ukendt id: ingen kandidat.
      }
    } else {
      // Bedste match og alternativerne som i show_person, derefter resten af søgningen i Lassos rækkefølge.
      const rows = await ctx.provider.findPersons(query, 20);
      const pick = pickPerson(query, rows);
      for (const r of pick ? [pick.pick, ...pick.alternatives, ...rows] : []) push({ kind: "person", id: r.lassoId, name: r.name, subtitle: r.city ?? "" });
    }
  } else if (isCompanyRef(query)) {
    try {
      const c = await ctx.provider.company(toLassoId(query, ctx.config.LASSO_COMPANY_ID_PREFIX));
      push({ kind: "company", id: c.lassoId, name: c.name, subtitle: [c.address?.city, c.cvr && `CVR ${c.cvr}`, c.status].filter(Boolean).join(", ") });
    } catch {
      // Ukendt id eller CVR-nummer: ingen kandidat.
    }
  } else {
    // Bedste match som i show_company (med selskabsform-opslaget), derefter resten af søgningen.
    const pick = await findCompany(ctx.provider, query);
    const rows = pick ? await ctx.provider.findCompanies(query, 20) : [];
    for (const r of pick ? [pick.pick, ...pick.alternatives, ...rows] : []) push({ kind: "company", id: r.lassoId, name: r.name, subtitle: [r.city, r.cvr && `CVR ${r.cvr}`, r.status].filter(Boolean).join(", ") });
  }
  return found.slice(0, limit);
}

/** Kandidaterne som tekst til modellen: "id | navn | undertitel" pr. linje. */
export function candidatesAsText(kind: ResolveEntityInput["kind"], query: string, candidates: readonly EntityCandidate[]): string {
  const noun = kind === "person" ? "personer" : "virksomheder";
  if (!candidates.length) return `Ingen ${noun} matcher "${query}". Spørg brugeren om et mere præcist navn, eller prøv en anden stavemåde.`;
  return [`${candidates.length} ${candidates.length === 1 ? (kind === "person" ? "person" : "virksomhed") : noun} for "${query}" (id | navn | detaljer):`, ...candidates.map((c) => `${c.id} | ${c.name} | ${c.subtitle || "-"}`)].join("\n");
}
