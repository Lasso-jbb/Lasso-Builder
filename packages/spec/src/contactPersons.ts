import type { ContactPersonVM } from "./models.js";

/**
 * Katalog 08.7: grupperne i "Se alle"-panelet for kontaktpersoner, i den rækkefølge de vises
 * (Direktion først, Øvrige sidst). Blokken på siden sorteres på samme måde.
 */
export const CONTACT_PERSON_GROUPS = ["Direktion", "Ledelse", "Salg", "IT-udvikling", "Konsulenter", "Øvrige"] as const;

/** Rækkefølgen tæller: salg, IT og konsulenter før de brede ledelsesord ("Salgschef" er Salg, ikke Ledelse). */
const RULES: [RegExp, string][] = [
  // Ingen \b om "direktør": ø er ikke et ordtegn i JS-regex, så \b efter ø matcher aldrig.
  [/(\bceo\b|direktør|director|managing|founder|stifter|partner|\bejer\b)/i, "Direktion"],
  [/(salg|sales|account|kunde|marketing|business dev)/i, "Salg"],
  [/(\bcto\b|udvikl|developer|engineer|\bit\b|tech|software|data)/i, "IT-udvikling"],
  [/(konsulent|consultant|rådgiver|advisor)/i, "Konsulenter"],
  [/(økonomi|cfo|coo|chef|leder|manager|head of|bestyrelse|formand)/i, "Ledelse"],
];

/** Personens gruppe: `group`, når den er sat; ellers afledt af rollen; ellers "Øvrige". */
export function contactPersonGroup(p: Pick<ContactPersonVM, "group" | "role">): string {
  if (p.group) return p.group;
  const role = p.role ?? "";
  if (/\bcto\b/i.test(role)) return "IT-udvikling";
  for (const [re, group] of RULES) if (re.test(role)) return group;
  return "Øvrige";
}

/** Kontaktpersonerne grupperet i katalogets rækkefølge (ukendte grupper før "Øvrige"), stabil inden for gruppen. */
export function groupContactPersons<T extends Pick<ContactPersonVM, "group" | "role">>(people: readonly T[]): { group: string; people: T[] }[] {
  const order = (g: string) => {
    const i = (CONTACT_PERSON_GROUPS as readonly string[]).indexOf(g);
    return i >= 0 ? (g === "Øvrige" ? 99 : i) : 50;
  };
  const map = new Map<string, T[]>();
  for (const p of people) {
    const g = contactPersonGroup(p);
    map.set(g, [...(map.get(g) ?? []), p]);
  }
  return [...map.entries()].sort((a, b) => order(a[0]) - order(b[0])).map(([group, list]) => ({ group, people: list }));
}
