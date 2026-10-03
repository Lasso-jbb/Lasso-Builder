import { resolveEntity, type EntityCandidate } from "../usecases/index.js";
import type { McpContext } from "../mcp/server.js";
import type { ChatContext, ChatEntity } from "./context.js";
import { EXPLICIT_OPEN, fold, nameTokens } from "./place.js";

/**
 * Forhåndsopløsning af en udtrykkelig bøn om at åbne en fane (docs/chat.md): "vis alt om X", "åbn X", "tilføj X" afgøres på serveren,
 * før modellen kaldes. Én kandidat: placeringen er afgjort (modellen skal kun vise siden: to modelkald i stedet for fire).
 * Flere: valgmenuen bygges på serveren (intet modelkald). Ingen: modellen tager over som før.
 */

export type PreResolve = { kind: "one"; entity: ChatEntity } | { kind: "many"; candidates: EntityCandidate[] };

/** Ord, der peger på noget andet end et navn ("åbn den"): giver aldrig et opslag. */
const PRONOUNS = new Set(["den", "det", "dem", "ham", "hende", "siden", "side", "selskabet", "virksomheden", "personen", "firmaet", "mig", "alt", "hele", "venligst", "tak", "denne", "dette"]);

/**
 * Modulernes navne og bøjninger (foldet): "vis alt om risiko" og "tilføj regnskabet" handler om et modul, ikke om en virksomhed
 * ved navn (en virksomhed, der hedder "Risiko ApS", åbnes ikke uden modellen).
 */
export const MODULE_WORDS: ReadonlySet<string> = new Set([
  "overblik", "overblikket", "oekonomi", "okonomi", "okonomien", "regnskab", "regnskabet", "regnskaber", "ejerskab", "ejerskabet", "risiko", "risikoen",
  "historik", "historikken", "kontakt", "kontakten", "ledelse", "ledelsen", "roller", "rollerne", "netvaerk", "netvaerket",
]);

/** Navnet efter udløseren ("vis alt om Jakob Kjær" → "Jakob Kjær", "åbn Jakobs side" → "Jakobs"); undefined, hvis der ikke står et. */
export function extractName(message: string): string | undefined {
  const m = EXPLICIT_OPEN.exec(message);
  if (!m) return undefined;
  const rest = message
    .slice(m.index + m[0].length)
    .replace(/^\s*(?:(?:siden|side)\s+)?(?:om|for)\s+/i, "")
    .split(/[?.!,;:\n]/)[0]!;
  const words = rest.trim().split(/\s+/).filter(Boolean);
  while (words.length && /^(?:siden|side)$/i.test(words.at(-1)!)) words.pop();
  const name = words.slice(0, 5).join(" ");
  if (name.length < 2 || words.every((w) => PRONOUNS.has(w.toLowerCase()) || MODULE_WORDS.has(fold(w)))) return undefined;
  return name;
}

/** Om kandidatens navn indeholder alle de rigtige ord fra det, brugeren skrev (også "Jakobs" for "Jakob"). */
function fits(candidate: EntityCandidate, queryTokens: readonly string[]): boolean {
  const have = nameTokens(candidate.name);
  return queryTokens.length > 0 && queryTokens.every((t) => have.includes(t) || (t.endsWith("s") && have.includes(t.slice(0, -1))));
}

export async function preResolve(mcp: McpContext, context: ChatContext, message: string): Promise<PreResolve | null> {
  // Et valg i menuen er allerede afgjort, og kun en udtrykkelig bøn forhåndsafgøres.
  if (context.choice) return null;
  const name = extractName(message);
  if (!name) return null;
  // På en person eller virksomhed er et navn, der begynder med et modulnavn ("Risiko Nord ApS"), modellens sag, ikke en forhåndsafgørelse.
  if (context.active.kind !== "global" && MODULE_WORDS.has(fold(name.split(/\s+/)[0]!))) return null;
  const tokens = nameTokens(name);
  try {
    const [persons, companies] = await Promise.all([
      resolveEntity(mcp, { kind: "person", query: name, limit: 3 }, context.open),
      resolveEntity(mcp, { kind: "company", query: name, limit: 3 }, context.open),
    ]);
    const active = context.active.kind !== "global" ? context.active.id : undefined;
    const seen = new Set<string>();
    // Den aktive fane tæller ikke med (den åbnes ikke igen, og den står ikke i menuen): kun de andre afgør, om der er ét eller flere match.
    const found = [...persons, ...companies].filter((c) => c.id !== active && fits(c, tokens) && !seen.has(c.id) && seen.add(c.id));
    if (found.length === 1) {
      const c = found[0]!;
      return { kind: "one", entity: { kind: c.kind, id: c.id, name: c.name } };
    }
    return found.length >= 2 ? { kind: "many", candidates: found } : null;
  } catch {
    // Opslaget fejlede: modellen tager over.
    return null;
  }
}
