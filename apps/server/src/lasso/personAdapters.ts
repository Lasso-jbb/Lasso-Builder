import {
  isPersonId,
  roleKind,
  type PersonNetworkCompanyVM,
  type PersonNetworkRowVM,
  type PersonNetworkVM,
  type PersonRoleVM,
  type PersonSearchRowVM,
  type PersonVM,
} from "@lasso/spec";
import { arr, at, dateStr, isObj, items, num, shareText, statusKind, str, titleCase, type Json } from "./adapters.js";

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
  if (/^underkonkurs$/i.test(p)) return "Under konkurs";
  return p;
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
  const secret = at(current, "address.secret") === true;
  return {
    lassoId: str(current, "lassoId") ?? lassoId,
    name: str(current, "name") ?? str(history, "name") ?? lassoId,
    city: secret ? undefined : str(addr, "postalDistrict", "cityName", "city"),
    municipality: secret ? undefined : titleCase(str(addr, "municipality.name", "municipality")),
    roles: [...unique.values()],
    updated: dateStr(current, "lastUpdated", "updated", "updatedAt"),
  };
}

const YEAR_MS = 365.25 * 86_400_000;

/**
 * GET /modules/network/{lassoId}: [{ name, unitNo, companyRelation: [{ companyName, cvr, status,
 * currentRoles: [], overlaps: [{ from, to, theirRoles: [], ownRoles: [] }] }] }].
 */
export function adaptPersonNetwork(lassoId: string, raw: Json, today = new Date().toISOString().slice(0, 10)): PersonNetworkVM {
  const list = Array.isArray(raw) ? raw : arr(raw, "network", "people", "persons", "results", "items");
  const people: PersonNetworkRowVM[] = [];
  for (const e of list) {
    const name = str(e, "name");
    if (!name) continue;
    const unit = num(e, "unitNo", "unitNumber");
    const id = str(e, "lassoId", "id") ?? (unit !== undefined ? `CVR-3-${unit}` : undefined);
    if (id === lassoId) continue;
    let ms = 0;
    let active = false;
    const companies: PersonNetworkCompanyVM[] = [];
    for (const c of arr(e, "companyRelation", "companyRelations", "companies", "relations")) {
      const companyName = str(c, "companyName", "name");
      if (!companyName) continue;
      const overlaps = arr(c, "overlaps", "periods");
      const currentRoles = arr(c, "currentRoles").filter((r): r is string => typeof r === "string");
      let from: string | undefined;
      let to: string | undefined;
      let open = currentRoles.length > 0;
      let role: string | undefined = currentRoles[0];
      for (const o of overlaps) {
        const f = dateStr(o, "from");
        const t = dateStr(o, "to");
        if (f && (!from || f < from)) from = f;
        if (!t) open = true;
        else if (!to || t > to) to = t;
        if (f) ms += Math.max(0, Date.parse(t ?? today) - Date.parse(f));
        const theirs = arr(o, "theirRoles").find((r): r is string => typeof r === "string");
        if (theirs) role = theirs;
      }
      active ||= open;
      const cvr = str(c, "cvr");
      const status = companyStatusText(str(c, "status"));
      companies.push({
        companyId: str(c, "lassoId") ?? (cvr ? `CVR-1-${cvr}` : undefined),
        companyName,
        role: role ? role.toLowerCase() : undefined,
        from,
        to: open ? undefined : to,
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
      overlapYears: Math.round(ms / YEAR_MS),
      since: froms[0],
      until: active ? undefined : tos.at(-1),
      active,
    });
  }
  people.sort((a, b) => b.overlapYears - a.overlapYears || Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "da"));
  return { lassoId, people };
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
