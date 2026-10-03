import { statusLabel } from "@lasso/spec";
import {
  isPersonId,
  longestPeriodYears,
  networkRole,
  roleKind,
  totalPeriodMonths,
  type PeriodInput,
  type PersonNetworkCompanyVM,
  type PersonNetworkRowVM,
  type PersonNetworkVM,
  type PersonRoleVM,
  type PersonSearchRowVM,
  type PersonVM,
} from "@lasso/spec";
import type { OwnershipEdgeVM, OwnershipGraphVM, OwnershipNodeVM } from "@lasso/spec";
import { arr, at, dateStr, isObj, items, num, shareRange, shareText, statusKind, str, titleCase, type Json } from "./adapters.js";

/**
 * Personsiden (katalog 16). Svarformerne er læst i docs.lassox.com (api/people/people og
 * api/people/cvrnetwork, 26.09.2026), men IKKE set mod en rigtig nøgle. Alle felter læses
 * defensivt; se docs/lasso-endpoints.md under "Ubekræftet: personer".
 *
 * GET /{lassoId} (nu) og GET /{lassoId}/history (med fra–til): grupperne management, board,
 * founder, owner, trueOwner, stakeholder og otherRoles. Hvert element er et selskab med
 * { lassoId, cvr, name, status, form, lifeTime: { from, to }, role: { mainType, type, originalType } }
 * (ejere også { ownership: { from, to } }). I historikken er selskabet pakket ind:
 * { value: { … }, from, to, current }.
 */

const GROUPS: [string, string][] = [
  ["management", "Direktion"],
  ["board", "Bestyrelse"],
  ["founder", "Stifter"],
  ["founders", "Stifter"],
  ["owner", "Ejer"],
  ["owners", "Ejer"],
  ["trueOwner", "Reel ejer"],
  ["trueOwners", "Reel ejer"],
  ["stakeholder", "Deltager"],
  ["stakeholders", "Deltager"],
  ["otherRoles", "Anden rolle"],
  ["roles", "Deltager"],
];

/** En gruppe kan være en liste, ét element eller et objekt med lister (fx { members: [] }). */
function groupItems(v: Json): Json[] {
  if (Array.isArray(v)) return v;
  if (!isObj(v)) return [];
  if (at(v, "value") !== undefined || at(v, "name") !== undefined || at(v, "lassoId") !== undefined) return [v];
  return Object.values(v).flatMap((x) => (Array.isArray(x) ? x : isObj(x) ? [x] : []));
}

/** "EJER" -> "Ejer", "UNDER KONKURS" -> "Under konkurs"; blandet skrift røres ikke. */
function pretty(s: string | undefined): string | undefined {
  if (!s) return s;
  const t = s.replace(/_/g, " ").trim();
  if (t !== t.toUpperCase()) return t;
  const lower = t.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function companyStatusText(s: string | undefined): string | undefined {
  const p = pretty(s);
  if (!p) return undefined;
  if (/^(normal|aktiv)$/i.test(p)) return "Aktiv";
  // CVR-koder (UNDERKONKURS, OPLØSTEFTERKONKURS …) -> danske navne (packages/spec/src/status.ts).
  return statusLabel(p);
}

function rolesFrom(raw: Json): PersonRoleVM[] {
  const out: PersonRoleVM[] = [];
  for (const [group, fallback] of GROUPS) {
    for (const el of groupItems(at(raw, group))) {
      const inner = isObj(el) && isObj(at(el, "value")) ? at(el, "value") : el;
      const companyName = str(inner, "name", "companyName", "company.name");
      if (!companyName) continue;
      const cvr = str(inner, "cvr", "company.cvr");
      const rawRole = str(inner, "role.type", "role.originalType", "role.mainType", "role", "title") ?? fallback;
      const role = group.toLowerCase().startsWith("trueowner") && !/reel/i.test(rawRole) ? "Reel ejer" : (pretty(rawRole) ?? fallback);
      const kind = roleKind(role, `${group} ${str(inner, "role.mainType") ?? ""} ${str(inner, "role.originalType") ?? ""}`);
      const to = dateStr(el, "to") ?? dateStr(inner, "to", "role.to", "validTo", "endDate");
      const current = at(el, "current");
      const status = companyStatusText(str(inner, "status", "companyStatus"));
      out.push({
        companyId: str(inner, "lassoId", "company.lassoId") ?? (cvr ? `CVR-1-${cvr}` : undefined),
        companyName,
        cvr,
        companyForm: str(inner, "form.shortDescription", "form"),
        companyStatus: status,
        companyStatusKind: statusKind(status),
        companyEnded: dateStr(inner, "lifeTime.to", "endDate", "ceased"),
        kind,
        role,
        share: kind === "owner" ? shareText(at(inner, "ownership") ?? at(inner, "share") ?? at(inner, "ownerPercentage")) : undefined,
        from: dateStr(el, "from") ?? dateStr(inner, "from", "role.from", "validFrom", "startDate"),
        to,
        active: current === true ? true : current === false ? false : !to,
      });
    }
  }
  return out;
}

const roleKey = (r: PersonRoleVM) => `${r.companyId ?? r.companyName.toLowerCase()}|${r.kind}|${r.role.toLowerCase()}`;

export function adaptPerson(lassoId: string, current: Json, history?: Json): PersonVM {
  const now = rolesFrom(current);
  const past = history === undefined ? [] : rolesFrom(history);
  // Historikken har fra–til på alle roller; nuværende roller, den mangler, lægges til.
  const seen = new Set(past.map(roleKey));
  const merged = [...past, ...now.filter((r) => !seen.has(roleKey(r)))];
  const unique = new Map<string, PersonRoleVM>();
  for (const r of merged) unique.set(`${roleKey(r)}|${r.from ?? ""}`, r);

  const addr = isObj(at(current, "address.value")) ? at(current, "address.value") : at(current, "address");
  const secret = at(current, "address.secret") === true || at(current, "addressProtected") === true;
  return {
    lassoId: str(current, "lassoId") ?? lassoId,
    name: str(current, "name") ?? str(history, "name") ?? lassoId,
    // Kun by, postnummer, kommune og land; gade og husnummer læses aldrig (personhovedets regel).
    city: secret ? undefined : str(addr, "postalDistrict", "cityName", "city"),
    municipality: secret ? undefined : titleCase(str(addr, "municipality.name", "municipality")),
    zip: secret ? undefined : str(addr, "postalCode", "zipCode", "zip"),
    country: secret ? undefined : foreignCountry(str(addr, "countryCode", "country")),
    ...(secret ? { addressProtected: true } : {}),
    unitNumber: str(current, "unitNumber", "unitNo"),
    roles: [...unique.values()],
    updated: dateStr(current, "lastUpdated", "updated", "updatedAt"),
  };
}

/** Landet som dansk navn, når bopælen er uden for Danmark ("SE" -> "Sverige"); Danmark udelades. */
function foreignCountry(raw: string | undefined): string | undefined {
  const v = raw?.trim();
  if (!v || /^(dk|dnk|danmark|denmark)$/i.test(v)) return undefined;
  if (/^[a-z]{2}$/i.test(v)) {
    try {
      return new Intl.DisplayNames(["da"], { type: "region" }).of(v.toUpperCase()) ?? v.toUpperCase();
    } catch {
      return v.toUpperCase();
    }
  }
  return titleCase(v) ?? v;
}

/**
 * GET /modules/network/{lassoId}: [{ name, unitNo, companyRelation: [{ companyName, cvr, status,
 * currentRoles: [], overlaps: [{ from, to, theirRoles: [], ownRoles: [] }] }] }].
 *
 * "År sammen" (overlapYears) er den LÆNGSTE SAMMENHÆNGENDE periode, de to har siddet sammen i
 * mindst ét selskab: alle overlap på tværs af selskaberne lægges sammen, hvor de overlapper eller
 * støder op til hinanden, og et hul bryder perioden (longestPeriodYears). Tidligere blev
 * overlappene summeret, så 13 fælles selskaber kunne give "105 år sammen".
 *
 * Stifter og revisor tæller ikke som at sidde sammen (Jakob 30.09): stifterrollen står i CVR uden
 * slutdato (et uendeligt bånd "siden 2012"), og revisoren sidder ikke i selskabet. Et overlap, hvor den
 * ene part kun har sådanne roller, udelades; et selskab uden andre overlap og en person uden andre
 * selskaber udelades også.
 */
const NOT_TOGETHER = /stift|revisor/i;
const togetherRoles = (roles: unknown[]): string[] => roles.filter((r): r is string => typeof r === "string" && !NOT_TOGETHER.test(r));

export function adaptPersonNetwork(lassoId: string, raw: Json, today = new Date().toISOString().slice(0, 10)): PersonNetworkVM {
  const list = Array.isArray(raw) ? raw : arr(raw, "network", "people", "persons", "results", "items");
  const people: PersonNetworkRowVM[] = [];
  for (const e of list) {
    const name = str(e, "name");
    if (!name) continue;
    const unit = num(e, "unitNo", "unitNumber");
    const id = str(e, "lassoId", "id") ?? (unit !== undefined ? `CVR-3-${unit}` : undefined);
    if (id === lassoId) continue;
    const periods: PeriodInput[] = [];
    let active = false;
    const companies: PersonNetworkCompanyVM[] = [];
    for (const c of arr(e, "companyRelation", "companyRelations", "companies", "relations")) {
      const companyName = str(c, "companyName", "name");
      if (!companyName) continue;
      const rawOverlaps = arr(c, "overlaps", "periods");
      // Overlap, hvor en af parterne kun er stifter eller revisor, tæller ikke.
      const overlaps = rawOverlaps.filter((o) => {
        const theirs = arr(o, "theirRoles");
        const own = arr(o, "ownRoles");
        return (theirs.length === 0 || togetherRoles(theirs).length > 0) && (own.length === 0 || togetherRoles(own).length > 0);
      });
      if (rawOverlaps.length > 0 && overlaps.length === 0) continue;
      const currentRoles = togetherRoles(arr(c, "currentRoles"));
      let from: string | undefined;
      let to: string | undefined;
      // "Sidder sammen nu" kræver et åbent overlap OG at den anden stadig har en rolle i selskabet
      // (Jakob 30.09: ophørte bestyrelsesmedlemmer stod som "siden 2017"). Uden overlap afgør currentRoles.
      const hasCurrentField = isObj(c) && "currentRoles" in (c as Record<string, unknown>);
      let openOverlap = false;
      let role: string | undefined = currentRoles[0];
      for (const o of overlaps) {
        const f = dateStr(o, "from");
        const t = dateStr(o, "to");
        if (f && (!from || f < from)) from = f;
        if (!t) openOverlap = true;
        else if (!to || t > to) to = t;
        if (f) periods.push({ from: f, to: t });
        const theirs = togetherRoles(arr(o, "theirRoles"))[0];
        if (theirs) role = theirs;
      }
      const open = overlaps.length > 0 ? openOverlap && (!hasCurrentField || currentRoles.length > 0) : currentRoles.length > 0;
      active ||= open;
      const cvr = str(c, "cvr");
      const status = companyStatusText(str(c, "status"));
      // 16.3: kun Ejer, Direktion, Bestyrelse og Andet; en stifter- eller revisorrolle står aldrig som rolle.
      const kind = role ? networkRole(role) : undefined;
      companies.push({
        companyId: str(c, "lassoId") ?? (cvr ? `CVR-1-${cvr}` : undefined),
        companyName,
        role: kind ? kind.toLowerCase() : undefined,
        from,
        to: open ? undefined : to,
        ...(!open && !to ? { ended: true } : {}),
        status,
        statusKind: statusKind(status),
      });
    }
    if (companies.length === 0) continue;
    const froms = companies.map((c) => c.from).filter((f): f is string => Boolean(f)).sort();
    const tos = companies.map((c) => c.to).filter((t): t is string => Boolean(t)).sort();
    people.push({
      lassoId: id,
      name,
      companies,
      overlapYears: longestPeriodYears(periods, today),
      overlapMonths: totalPeriodMonths(periods, today),
      since: froms[0],
      until: active ? undefined : tos.at(-1),
      active,
    });
  }
  people.sort((a, b) => b.overlapYears - a.overlapYears || Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "da"));
  return { lassoId, people };
}

/**
 * Reserve for personsidens ejerdiagram, når ejergrafen ikke kan hentes for et person-ID: personen
 * som rod og ét lag med de selskaber, personen ejer legalt ifølge sine ejerroller (GET /{lassoId},
 * gruppen `owner`). Reelt ejerskab (`trueOwner`) er ikke en kant i ejergrafen og tages ikke med.
 */
export function graphFromPersonRoles(p: PersonVM, opts: { outgoingDepth: number; onDate?: string }): OwnershipGraphVM {
  const nodes: OwnershipNodeVM[] = [{ id: p.lassoId, name: p.name, kind: "person", root: true }];
  const edges: OwnershipEdgeVM[] = [];
  if (opts.outgoingDepth >= 1) {
    for (const r of p.roles) {
      if (r.kind !== "owner" || /reel/i.test(r.role) || !r.companyId) continue;
      if (!nodes.some((n) => n.id === r.companyId)) {
        nodes.push({ id: r.companyId, name: r.companyName, kind: "company", cvr: r.cvr, form: r.companyForm, status: r.companyStatus, statusKind: r.companyStatusKind });
      }
      edges.push({ from: p.lassoId, to: r.companyId, share: shareRange(r.share), since: r.from, ...(r.to ? { until: r.to } : {}) });
    }
  }
  return {
    rootId: p.lassoId,
    nodes,
    edges,
    ingoingDepth: 0,
    outgoingDepth: Math.min(1, opts.outgoingDepth),
    onDate: opts.onDate,
    fetchedAt: new Date().toISOString(),
    note: "Kun personens direkte ejerskaber; ejergrafen kunne ikke hentes.",
  };
}

/** Personer fra GET /data/cvr/search?type=person: { people: { results: [{ lassoId, name, city, … }] } }. */
export function adaptPersonSearch(raw: Json): PersonSearchRowVM[] {
  const container = isObj(raw) && at(raw, "people") !== undefined ? at(raw, "people") : raw;
  const rows: PersonSearchRowVM[] = [];
  for (const it of items(container)) {
    const lassoId = str(it, "lassoId", "id", "entityId");
    const name = str(it, "name", "navn");
    if (!lassoId || !name) continue;
    const type = (str(it, "type", "entityType", "kind") ?? "").toLowerCase();
    if (type ? !/person/.test(type) : !isPersonId(lassoId)) continue;
    rows.push({ lassoId, name, city: str(it, "postalDistrict", "city", "address.postalDistrict", "address.city") });
  }
  return rows;
}
