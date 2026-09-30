/**
 * Virksomhedens historik (GET /{lassoId}/history): relationer og stamdata over tid til portalens
 * Stamoplysninger (LassoRelationsTable, LassoCompanyHistory). UBEKRÆFTET for virksomheder: formen er
 * antaget som personhistorikken (docs.lassox.com, personAdapters.ts): grupper (management, board,
 * founder, owner, trueOwner, stakeholder, otherRoles) med elementer { value, from, to, current }, og
 * stamdata som lister af { value, from, to }. Alt læses defensivt; ukendte lister vises med nøglens navn.
 */
import { relationGroupsOf, type CompanyHistoryVM, type HistoryFieldVM, type RelationEntryVM } from "@lasso/spec";
import { at, dateStr, isObj, num, participantLassoId, shareText, str, type Json } from "./adapters.js";

const RELATION_KEYS = new Set(["management", "board", "founder", "founders", "owner", "owners", "trueowner", "trueowners", "stakeholder", "stakeholders", "otherroles", "roles", "participants", "relations"]);
const SKIP_KEYS = new Set(["lassoid", "id", "cvr", "entitytype", "type"]);

/** Kendte stamdatalister med portalens etiketter og rækkefølge. */
const FIELD_LABELS: [RegExp, string, string][] = [
  [/^(names?|companynames?)$/i, "navn", "Navn"],
  [/^(secondarynames?|alternativenames?|binavne)$/i, "binavne", "Binavne"],
  [/^(address(es)?)$/i, "adresse", "Adresse"],
  [/^(employees?monthly|monthlyemployees?|employeesmonth)$/i, "ansatte-maaned", "Ansatte - månedligt"],
  [/^(fulltimeequivalents?monthly|ftemonthly|monthlyfte)$/i, "aarsvaerk-maaned", "Årsværk - månedligt"],
  [/^(employeeintervalmonthly|employeesmonthlyinterval)$/i, "ansatte-interval-maaned", "Ansatte - månedligt interval"],
  [/^(employeeintervalquarterly|employeesquarterlyinterval|employeesquarterly)$/i, "ansatte-interval-kvartal", "Ansatte - kvartalsvis interval"],
  [/^(employees?|employment)$/i, "ansatte", "Ansatte"],
  [/^(industr(y|ies)|mainindustr(y|ies))$/i, "branche", "Branche"],
  [/^(status(es)?)$/i, "status", "Status"],
  [/^(forms?|companyforms?)$/i, "form", "Virksomhedsform"],
  [/^(capital|contributedcapital|registeredcapital)$/i, "kapital", "Selskabskapital"],
  [/^(phones?|phonenumbers?|telephones?)$/i, "telefon", "Telefon"],
  [/^(emails?|emailaddresses?)$/i, "email", "Email"],
  [/^(websites?|homepages?)$/i, "web", "Website"],
];
const ORDER = FIELD_LABELS.map(([, k]) => k);

/** Én værdi som tekst: adresse, branche, ansatte (antal eller interval), beløb, ellers tekst. */
function valueText(v: Json): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (!isObj(v)) return undefined;
  const street = str(v, "address1", "street", "streetAddress");
  if (street) {
    const zip = str(v, "postalCode", "zip", "zipCode");
    const city = str(v, "postalDistrict", "city");
    return [street, [zip, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  }
  const code = str(v, "code", "industryCode");
  const text = str(v, "text", "description", "name", "shortDescription", "longDescription");
  if (code && text) return `${code}: ${text}`;
  const low = num(v, "intervalLow", "from", "min");
  const high = num(v, "intervalHigh", "to", "max");
  const count = num(v, "count", "employees", "fullTimeEquivalentCount", "amount", "value");
  if (count !== undefined) {
    const cur = str(v, "currency", "currencyCode");
    return cur ? `${count.toLocaleString("da-DK")} ${cur}` : count.toLocaleString("da-DK");
  }
  if (low !== undefined && high !== undefined) return `${low}-${high}`;
  const interval = str(v, "interval", "intervalText");
  return interval ?? text ?? str(v, "value", "number", "email");
}

function relations(raw: Json): RelationEntryVM[] {
  const out: RelationEntryVM[] = [];
  for (const [key, v] of Object.entries(raw as Record<string, Json>)) {
    if (!RELATION_KEYS.has(key.toLowerCase())) continue;
    const list = Array.isArray(v) ? v : isObj(v) ? Object.values(v).flatMap((x) => (Array.isArray(x) ? x : isObj(x) ? [x] : [])) : [];
    for (const el of list) {
      const inner = isObj(el) && isObj(at(el, "value")) ? at(el, "value") : el;
      const name = str(inner, "name", "participant.name", "person.name");
      if (!name) continue;
      const roleText = str(inner, "role.type", "role.originalType", "role.mainType", "role", "title") ?? "";
      const { groups, role } = relationGroupsOf(roleText, key);
      const to = dateStr(el, "to") ?? dateStr(inner, "to", "role.to", "validTo", "ownership.to");
      const current = at(el, "current");
      const isOwner = groups.includes("legale-ejere");
      for (const group of groups) {
        out.push({
          group,
          name,
          lassoId: participantLassoId(inner),
          role,
          ...(isOwner ? { share: shareText(at(inner, "ownership") ?? at(inner, "share")), votes: shareText(at(inner, "voteRights") ?? at(inner, "votes") ?? at(inner, "ownership")) } : {}),
          from: dateStr(el, "from") ?? dateStr(inner, "from", "role.from", "validFrom", "ownership.from"),
          to,
          current: current === true ? true : current === false ? false : !to,
        });
      }
    }
  }
  return out;
}

function fields(raw: Json): HistoryFieldVM[] {
  const out: HistoryFieldVM[] = [];
  for (const [key, v] of Object.entries(raw as Record<string, Json>)) {
    if (RELATION_KEYS.has(key.toLowerCase()) || SKIP_KEYS.has(key.toLowerCase()) || !Array.isArray(v)) continue;
    const entries = v
      .map((el) => ({ value: valueText(isObj(el) && "value" in (el as object) ? at(el, "value") : el), from: dateStr(el, "from", "validFrom", "period.from"), to: dateStr(el, "to", "validTo", "period.to") }))
      .filter((e): e is { value: string; from: string | undefined; to: string | undefined } => Boolean(e.value))
      .map((e) => ({ value: e.value, ...(e.from ? { from: e.from } : {}), ...(e.to ? { to: e.to } : {}) }))
      .sort((a, b) => (b.from ?? "").localeCompare(a.from ?? ""));
    if (!entries.length) continue;
    const known = FIELD_LABELS.find(([re]) => re.test(key));
    out.push({ key: known?.[1] ?? key, label: known?.[2] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()), entries });
  }
  return out.sort((a, b) => (ORDER.indexOf(a.key) === -1 ? 99 : ORDER.indexOf(a.key)) - (ORDER.indexOf(b.key) === -1 ? 99 : ORDER.indexOf(b.key)));
}

export function adaptCompanyHistory(lassoId: string, raw: Json): CompanyHistoryVM {
  if (!isObj(raw)) return { lassoId, relations: [], fields: [], source: "history", note: "Historikken havde en ukendt form." };
  return { lassoId, relations: relations(raw), fields: fields(raw), source: "history" };
}
