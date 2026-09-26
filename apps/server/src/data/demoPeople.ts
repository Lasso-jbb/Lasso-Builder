import {
  roleKind,
  type CompanyVM,
  type OwnerVM,
  type PersonNetworkCompanyVM,
  type PersonNetworkRowVM,
  type PersonNetworkVM,
  type PersonRoleVM,
  type PersonRowVM,
  type PersonSearchRowVM,
  type PersonVM,
} from "@lasso/spec";
import { NotFoundError } from "./provider.js";

/**
 * Demopersoner (katalog 16), bygget ud fra demovirksomhedernes ledelse og ejere, så
 * personsiden og virksomhedssiderne fortæller samme historie. Alle navne indeholder
 * "Eksempel" eller "Prøve". Lasso-ID'erne ("CVR-3-40000000NN") findes ikke i CVR.
 */

export interface DemoPersonSource extends CompanyVM {
  people: PersonRowVM[];
  owners: OwnerVM[];
}

const TODAY = "2026-09-26";

/** Hvornår en demovirksomhed ophørte eller gik konkurs (til markøren i tidsbåndet). */
const ENDED: Record<string, string> = { "CVR-1-99000011": "2026-02-02", "CVR-1-99000009": "2023-12-31" };

/** Personnavne i fast rækkefølge, så ID'erne er stabile. */
function names(companies: readonly DemoPersonSource[]): string[] {
  const all = new Set<string>();
  for (const c of companies) {
    c.people.forEach((p) => all.add(p.name));
    c.owners.filter((o) => o.kind === "person").forEach((o) => all.add(o.name));
  }
  return [...all];
}

export function demoPersonIds(companies: readonly DemoPersonSource[]): Map<string, string> {
  return new Map(names(companies).map((n, i) => [n, `CVR-3-${4000000001 + i}`]));
}

function nameFor(companies: readonly DemoPersonSource[], id: string): string {
  for (const [name, pid] of demoPersonIds(companies)) if (pid === id) return name;
  throw new NotFoundError(`Personen ${id}`);
}

function companyRole(c: DemoPersonSource, patch: Partial<PersonRoleVM> & Pick<PersonRoleVM, "role" | "kind" | "active">): PersonRoleVM {
  return {
    companyId: c.lassoId,
    companyName: c.name,
    cvr: c.cvr,
    companyForm: c.form,
    companyStatus: c.status,
    companyStatusKind: c.statusKind,
    companyEnded: ENDED[c.lassoId],
    ...patch,
  };
}

export function demoPerson(companies: readonly DemoPersonSource[], id: string): PersonVM {
  const name = nameFor(companies, id);
  const roles: PersonRoleVM[] = [];
  let city: string | undefined;
  for (const c of companies) {
    for (const p of c.people.filter((x) => x.name === name)) {
      roles.push(companyRole(c, { role: p.role, kind: roleKind(p.role), from: p.from, to: p.to, active: !p.to && c.statusKind !== "inactive" }));
      city ??= c.address?.city;
    }
    for (const o of c.owners.filter((x) => x.kind === "person" && x.name === name)) {
      roles.push(companyRole(c, { role: "Ejer", kind: "owner", share: o.share?.replace(/(\d)-(\d)/, "$1–$2"), from: c.founded, to: c.statusKind === "inactive" ? ENDED[c.lassoId] : undefined, active: c.statusKind !== "inactive" }));
      city ??= c.address?.city;
    }
  }
  return { lassoId: id, name, city, roles, updated: "2026-09-12" };
}

const later = (a?: string, b?: string) => (!a ? b : !b ? a : a > b ? a : b);
const earlier = (a?: string, b?: string) => (!a ? b : !b ? a : a < b ? a : b);

export function demoPersonNetwork(companies: readonly DemoPersonSource[], id: string): PersonNetworkVM {
  const name = nameFor(companies, id);
  const ids = demoPersonIds(companies);
  const byPerson = new Map<string, { companies: PersonNetworkCompanyVM[]; ms: number; active: boolean }>();
  for (const c of companies) {
    const mine = c.people.filter((p) => p.name === name);
    if (mine.length === 0) continue;
    for (const other of c.people.filter((p) => p.name !== name)) {
      for (const own of mine) {
        const from = later(own.from, other.from);
        const to = earlier(own.to, other.to);
        if (!from || (to && to <= from)) continue;
        const entry = byPerson.get(other.name) ?? { companies: [], ms: 0, active: false };
        entry.companies.push({ companyId: c.lassoId, companyName: c.name, role: other.role.toLowerCase(), from, to, status: c.status, statusKind: c.statusKind });
        entry.ms += Date.parse(to ?? TODAY) - Date.parse(from);
        entry.active ||= !to;
        byPerson.set(other.name, entry);
      }
    }
  }
  const people: PersonNetworkRowVM[] = [...byPerson].map(([n, e]) => ({
    lassoId: ids.get(n),
    name: n,
    companies: e.companies,
    overlapYears: Math.round(e.ms / (365.25 * 86_400_000)),
    since: e.companies.map((c) => c.from).filter((f): f is string => Boolean(f)).sort()[0],
    until: e.active ? undefined : e.companies.map((c) => c.to).filter((t): t is string => Boolean(t)).sort().at(-1),
    active: e.active,
  }));
  people.sort((a, b) => b.overlapYears - a.overlapYears || a.name.localeCompare(b.name, "da"));
  return { lassoId: id, people };
}

export function demoFindPersons(companies: readonly DemoPersonSource[], query: string, limit: number): PersonSearchRowVM[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const ids = demoPersonIds(companies);
  return [...ids]
    .filter(([n]) => words.every((w) => n.toLowerCase().includes(w)))
    .slice(0, limit)
    .map(([n, lassoId]) => ({ lassoId, name: n, city: demoPerson(companies, lassoId).city }));
}
