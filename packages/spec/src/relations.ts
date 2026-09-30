/**
 * Portalens relationsgrupper (Stamoplysninger, Jakob 30.09): nuværende og historiske relationer
 * grupperet som Adm. direktører, Direktion, Bestyrelse, Stiftere, Legale ejere og Reelle ejere.
 */
import type { OwnershipVM, PersonRowVM, RelationEntryVM, RelationGroup } from "./models.js";

export const RELATION_GROUP_LABELS: Record<RelationGroup, string> = {
  adm: "Adm. direktører",
  direktion: "Direktion",
  bestyrelse: "Bestyrelse",
  stiftere: "Stiftere",
  "legale-ejere": "Legale ejere",
  "reelle-ejere": "Reelle ejere",
  oevrige: "Øvrige",
};

export const RELATION_GROUP_ORDER: readonly RelationGroup[] = ["adm", "direktion", "bestyrelse", "stiftere", "legale-ejere", "reelle-ejere", "oevrige"];

/** Grupper og underrolle ud fra rolleteksten. En adm. direktør står både under Adm. direktører og Direktion (som i portalen). */
export function relationGroupsOf(roleText: string, groupHint?: string): { groups: RelationGroup[]; role?: string } {
  const t = `${groupHint ?? ""} ${roleText}`.toLowerCase();
  if (/reel|trueowner|beneficial/.test(t)) return { groups: ["reelle-ejere"] };
  if (/ejer|owner/.test(t)) return { groups: ["legale-ejere"] };
  if (/stift|founder/.test(t)) return { groups: ["stiftere"] };
  if (/adm|ceo|administrerende/.test(t)) return { groups: ["adm", "direktion"], role: "Adm. dir" };
  if (/n(æ|ae)stformand|vice/.test(t)) return { groups: ["bestyrelse"], role: "Næstformand" };
  if (/formand|chair/.test(t)) return { groups: ["bestyrelse"], role: "Formand" };
  if (/suppleant|alternate/.test(t)) return { groups: [/direkt|management/.test(t) ? "direktion" : "bestyrelse"], role: "Suppleant" };
  if (/bestyrels|board/.test(t)) return { groups: ["bestyrelse"] };
  if (/direkt|management|manager/.test(t)) return { groups: ["direktion"] };
  return { groups: ["oevrige"], role: roleText || undefined };
}

/** Relationerne ud fra de nuværende roller (inkl. fratrådte med til-dato) og de legale ejere, når historikken mangler. */
export function relationsFromCurrent(people: readonly PersonRowVM[], ownership: OwnershipVM | undefined): RelationEntryVM[] {
  const out: RelationEntryVM[] = [];
  for (const p of people) {
    const { groups, role } = relationGroupsOf(p.role);
    for (const group of groups) out.push({ group, name: p.name, lassoId: p.lassoId, role, from: p.from, to: p.to, current: !p.to });
  }
  for (const o of ownership?.owners ?? []) out.push({ group: "legale-ejere", name: o.name, lassoId: o.lassoId, share: o.share, votes: o.votes ?? o.share, current: true });
  return out;
}
