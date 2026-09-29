import { roleKind, type PersonRowVM } from "@lasso/spec";
import type { BeneficialOwnerGapVM, BeneficialOwnershipSpecialVM, BeneficialOwnershipVM, BeneficialOwnerVM, OwnershipGraphVM, OwnershipVM, OwnerVM } from "@lasso/spec";
import { at, isObj, num, participantKind, participantLassoId, percentFormat, pick, shareFloor, shareText, str, type Json } from "./adapters.js";

/**
 * Oversætter de ejerskabssvar, Lassos egen dokumentation (docs/endpoints-ejerskab.md, "## Ownership")
 * beskriver ordret: reelle ejere (`/owners/beneficial`), legale ejere (`/owners/legal`) og
 * ejergrafens "{lassoId}_UNKNOWN"-knuder (`POST /modules/relations/graph`). Adapterne herfra kaldes
 * FØRST fra `apps/server/src/lasso/adapters.ts`, som derefter falder tilbage til de ældre,
 * ubekræftede gætteformer, hvis raw slet ikke ligner den dokumenterede form. Alt læses defensivt
 * (`at()`/`str()`/`num()`); en anden form giver `undefined`/tom tilstand, aldrig et kast.
 */

/**
 * Reelle ejere (GET /{lassoId}/owners/beneficial), dokumenteret form:
 * `{ couldNotIdentify, exemptionStatus, fallbackDescription, fallbackType,
 *    owners: [{ ownership: 0-1, voteRights: 0-1, throughRole, name, lassoId, type, unitNumber, role, from }] }`.
 *
 * Andele er PRÆCISE tal (ikke et interval - kataloget tillader det for reelle ejere, i modsætning
 * til legale ejere). `throughRole=true` betyder, at ejerskabet skyldes en rolle (fx direktion/
 * bestyrelse som fallback), ikke et direkte kapitalejerskab; det får sin egen kort forklaringstekst
 * i stedet for en egentlig ejerkæde (den dokumenterede form har ingen "paths" af mellemliggende
 * selskaber, modsat den gamle, ubekræftede "ultimate owners"-gætteform).
 *
 * Er `owners` tom, udledes forklaringen af de fire dokumenterede årsager
 * (`fallbackDescription` > `couldNotIdentify` > `exemptionStatus` > `fallbackType`) og lægges i
 * `gaps` (uden `share`), som `LassoBeneficialOwners` allerede viser som tom-tilstandens begrundelse.
 *
 * Returnerer `undefined`, når `raw` slet ikke ligner denne form (intet objekt med et owners-array),
 * så `adaptBeneficialOwnership` i adapters.ts kan falde tilbage til den ældre gætteform.
 */
export function adaptBeneficialOwnershipDocumented(lassoId: string, raw: Json): BeneficialOwnershipVM | undefined {
  if (!isObj(raw)) return undefined;
  const ownersRaw = at(raw, "owners");
  if (!Array.isArray(ownersRaw)) return undefined;

  const owners: BeneficialOwnerVM[] = [];
  for (const o of ownersRaw) {
    const name = str(o, "name");
    if (!name) continue;
    const throughRole = at(o, "throughRole") === true;
    owners.push({
      name,
      lassoId: participantLassoId(o),
      share: preciseShareText(num(o, "ownership")),
      // 28.9: vises som ", via rolle" i muted efter navnet.
      throughRole: throughRole || undefined,
    });
  }
  owners.sort((a, b) => shareFloor(b.share) - shareFloor(a.share));

  const gaps: BeneficialOwnerGapVM[] = [];
  if (owners.length === 0) {
    const reason = explainEmptyBeneficialOwners(raw);
    if (reason) gaps.push({ reason });
  }
  const special = owners.length === 0 ? specialBeneficialState(raw) : undefined;
  return { lassoId, owners, gaps: gaps.length ? gaps : undefined, ...(special ? { special } : {}) };
}

/**
 * Katalog 28.9 (1): ledelsen som reelle ejere. /owners/beneficial navngiver ikke de indsatte
 * personer, så de hentes fra virksomhedens aktive roller (direktion eller bestyrelse, efter
 * fallback-typen) og står som rækker med rollen til højre.
 */
export function withFallbackPeople(bo: BeneficialOwnershipVM, people: PersonRowVM[]): BeneficialOwnershipVM {
  if (bo.special?.kind !== "management" || bo.owners.length > 0) return bo;
  const want = bo.special.fallback === "board" ? "board" : "direction";
  const seen = new Set<string>();
  const owners: BeneficialOwnerVM[] = [];
  for (const p of people) {
    if (p.to || roleKind(p.role) !== want || /suppleant/i.test(p.role)) continue;
    const key = p.lassoId ?? p.name;
    if (seen.has(key)) continue;
    seen.add(key);
    owners.push({ name: p.name, lassoId: p.lassoId, role: p.role });
  }
  return owners.length ? { ...bo, owners } : bo;
}

/**
 * Katalog 28.9: de tre særlige tilstande, når owners er tom. Rækkefølge: kunne ikke identificere
 * (virksomhedens egen registrering) > fritaget (exemptionStatus "EXEMPT") > ledelsen indsat
 * (effectiveFallbackType/fallbackType). Ellers ingen særlig tilstand (gaps bærer forklaringen).
 */
function specialBeneficialState(raw: Json): BeneficialOwnershipSpecialVM | undefined {
  const description = str(raw, "effectiveFallbackDescription", "fallbackDescription");
  if (at(raw, "couldNotIdentify") === true) {
    return { kind: "unidentified", reason: description ?? "Virksomheden har registreret i CVR, at den ikke kan identificere sine reelle ejere." };
  }
  if (str(raw, "exemptionStatus") === "EXEMPT") {
    return {
      kind: "exempt",
      reason: "Virksomheden er undtaget kravet om at registrere reelle ejere.",
      caveat: "Undtagelsen er vurderet ud fra virksomhedsform, branche og øvrige forhold i CVR og kan i særlige tilfælde være forkert.",
    };
  }
  const type = str(raw, "effectiveFallbackType", "fallbackType")?.toUpperCase();
  const fallback = type === "MANAGEMENT" ? "management" : type === "DAILY MANAGEMENT" ? "daily-management" : type === "BOARD" ? "board" : undefined;
  if (fallback) {
    return { kind: "management", fallback, reason: description ?? `Virksomheden har ikke registreret reelle ejere, og ${fallback === "board" ? "bestyrelsen" : fallback === "daily-management" ? "den daglige ledelse" : "ledelsen"} er indsat som reelle ejere.` };
  }
  return undefined;
}

/**
 * "0.12" -> "12 %". Tallet er dokumenteret som en brøk (0–1); et procenttal (> 1) accepteres også,
 * defensivt, hvis Lasso mod forventning leverer det sådan.
 */
function preciseShareText(v: number | undefined): string | undefined {
  if (v === undefined) return undefined;
  const scale = v <= 1 ? 100 : 1;
  return `${percentFormat.format(v * scale)} %`;
}

/**
 * De fire dokumenterede årsager til en tom owners-liste (docs/endpoints-ejerskab.md): (1)
 * virksomheden er undtaget lovkravet, (2) ejerskabet er endnu ikke registreret, (3) virksomheden
 * har selv oplyst, at den ikke kan identificere sine reelle ejere, (4) ingen enkeltperson har over
 * 25 % ejerskab/stemmeret (CVR falder da tilbage til ledelsen/bestyrelsen som registreret "reel
 * ejer", uden at navngive dem her). Lassos egen `fallbackDescription` er allerede en færdig,
 * server-beregnet forklaringstekst og bruges derfor først, når den findes.
 */
function explainEmptyBeneficialOwners(raw: Json): string | undefined {
  const description = str(raw, "fallbackDescription");
  if (description) return description;
  if (at(raw, "couldNotIdentify") === true) {
    return "Virksomheden har selv oplyst, at den ikke kan identificere sine reelle ejere.";
  }
  const exemptionStatus = str(raw, "exemptionStatus");
  if (exemptionStatus === "EXEMPT") {
    return "Virksomheden er undtaget lovkravet om at registrere reelle ejere.";
  }
  const fallbackType = str(raw, "fallbackType");
  if (fallbackType && fallbackType !== "UNKNOWN") {
    return `Ingen enkeltperson har over 25 % ejerskab eller stemmeret; den øverste ${fallbackTypeText(fallbackType)} er registreret som reel ejer i stedet, men er ikke navngivet her.`;
  }
  if (exemptionStatus === "UNKNOWN") {
    return "Det er uoplyst, om virksomheden er undtaget lovkravet om reelle ejere.";
  }
  return "Virksomheden har endnu ikke registreret reelle ejere i CVR.";
}

/** "DAILY MANAGEMENT" -> "daglige ledelse" osv., til brug i den udledte tomme-tilstandstekst. */
function fallbackTypeText(t: string): string {
  switch (t.toUpperCase()) {
    case "MANAGEMENT":
      return "direktion";
    case "DAILY MANAGEMENT":
      return "daglige ledelse";
    case "BOARD":
      return "bestyrelse";
    default:
      return "ledelse";
  }
}

/**
 * Legale ejere (GET /{lassoId}/owners/legal, historik: /{lassoId}/history/owners/legal),
 * dokumenteret form: `{ hasOwnersUnderFivePercent, owners: [{ ownership: {from,to},
 * voteRights: {from,to}, name, type, lassoId|cvr|unitNumber, address, role, from }] }`.
 *
 * Andele er brøk-INTERVALLER, aldrig ét tal (CVR-registeret kræver kun intervaller) - samme form
 * som `ownership.owners` i company-full, så `shareText` genbruges uændret. `hasOwnersUnderFivePercent`
 * lægges direkte i `OwnershipVM`, så `OwnerList` kan vise en linje om det.
 *
 * Returnerer `undefined`, når `raw` ikke har et owners-array, så `LiveProvider.ownership` kan falde
 * tilbage til de direkte ejere fra company-full (som i dag).
 */
export function adaptOwnershipLegal(lassoId: string, raw: Json): OwnershipVM | undefined {
  if (!isObj(raw)) return undefined;
  const ownersRaw = at(raw, "owners");
  if (!Array.isArray(ownersRaw)) return undefined;

  const owners: OwnerVM[] = [];
  for (const o of ownersRaw) {
    const name = str(o, "name");
    if (!name) continue;
    const share = shareText(pick(o, "ownership"));
    const votes = shareText(pick(o, "voteRights"));
    const type = str(o, "type");
    // Dokumenteret: lassoId|cvr|unitNumber; cvr -> CVR-1-…, unitNumber (person) -> CVR-3-… (participantLassoId).
    const id = participantLassoId(o);
    owners.push({
      name,
      lassoId: id,
      share,
      votes: share && votes && votes !== share ? votes : undefined,
      kind: participantKind(type, id, name),
    });
  }
  owners.sort((a, b) => shareFloor(b.share) - shareFloor(a.share));

  const flag = at(raw, "hasOwnersUnderFivePercent");
  return { lassoId, owners, hasOwnersUnderFivePercent: typeof flag === "boolean" ? flag : undefined };
}

/**
 * Ejergrafens syntetiske "{lassoId}_UNKNOWN"-knuder (docs/endpoints-ejerskab.md, unknownOwnership):
 * dækker den lovligt uregistrerede andel under 5 %. `adaptOwnershipGraph` i adapters.ts opretter i
 * forvejen en (navnløs) node for et ukendt id på en kant; denne funktion navngiver den bagefter og
 * sætter `unknown: true`, uanset om den kom fra en rigtig entity eller blev skabt implicit.
 */
export function markUnknownOwnershipNodes(g: OwnershipGraphVM): OwnershipGraphVM {
  let changed = false;
  const nodes = g.nodes.map((n) => {
    if (!/_unknown$/i.test(n.id)) return n;
    changed = true;
    return { ...n, name: "Ukendt ejerskab (< 5 %)", kind: "company" as const, unknown: true };
  });
  return changed ? { ...g, nodes } : g;
}
