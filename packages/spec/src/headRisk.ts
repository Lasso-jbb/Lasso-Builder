import type { ObservationsVM } from "./models.js";
import { personRisk, type PersonVM } from "./person.js";

/** Én rolig linje under hovedet: ikon, sammenfatning og "Se risiko" til højre (katalog 08/16/24). */
export interface HeadRiskSummary {
  severity: 50 | 100;
  text: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Negativ egenkapital" -> "negativ egenkapital"; "PEP-match" og "EBITDA …" bevares. */
function lowerFirst(s: string): string {
  if (s.length > 1 && s[1] === s[1]!.toUpperCase() && /[A-ZÆØÅ]/.test(s[1]!)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function sentence(lead: string, what: string[], info: number, tail?: string): string {
  const head = what.length ? `${lead}: ${what.map(lowerFirst).join(", ").replace(/\.$/, "")}.` : `${lead}.`;
  const rest = [info > 0 ? `${info} til orientering` : null, tail ?? null].filter(Boolean).join(", ");
  return rest ? `${head} ${rest.charAt(0).toUpperCase()}${rest.slice(1)}.` : head;
}

function lead(n100: number, n50: number): string {
  if (n100 > 0) {
    const main = plural(n100, "vigtig observation", "vigtige observationer");
    return n50 > 0 ? `${main} og ${plural(n50, "mulig vigtig", "mulig vigtige")}` : main;
  }
  return plural(n50, "mulig vigtig observation", "mulig vigtige observationer");
}

/**
 * Virksomhedens observationer (katalog 17) som én linje, kun ved mindst én på 50+ (README: risiko kun
 * ved 50+). Højst to titler nævnes; resten tælles. Info (25) tælles som "til orientering".
 */
export function companyRiskSummary(obs: ObservationsVM | undefined): HeadRiskSummary | null {
  if (!obs) return null;
  const rows = obs.observations.filter((o) => !o.notAvailable);
  const n100 = rows.filter((o) => o.severity === 100).length;
  const n50 = rows.filter((o) => o.severity === 50).length;
  const n25 = rows.filter((o) => o.severity === 25).length;
  if (n100 + n50 === 0) return null;
  const top = [...rows].filter((o) => o.severity >= 50).sort((a, b) => b.severity - a.severity);
  const named = top.length <= 2 ? top.map((o) => o.title) : [];
  return { severity: n100 > 0 ? 100 : 50, text: sentence(lead(n100, n50), named, n25) };
}

/**
 * Personens risiko (16.4) som én linje: stråmandsindikator, PEP-match og konkurser/tvangsopløsninger,
 * personen var med i, er "mulig vigtig"; sager, personen havde forladt, er "til orientering".
 */
export function personRiskSummary(p: PersonVM | undefined): HeadRiskSummary | null {
  if (!p) return null;
  const r = personRisk(p);
  const what: string[] = [];
  if (p.strawman?.level === "possible") what.push("stråmandsindikator");
  if (p.pep?.match) what.push("PEP-match");
  const cases = [...r.bankruptcies.map((c) => ({ ...c, kind: "konkurs" })), ...r.dissolutions.map((c) => ({ ...c, kind: "tvangsopløsning" }))];
  const involved = cases.filter((c) => c.involved);
  involved.forEach((c) => what.push(`${c.kind} i ${c.companyName}`));
  const info = cases.length - involved.length;
  if (what.length === 0) return null;
  const tail = p.pep && !p.pep.match ? "ingen PEP-match" : undefined;
  return { severity: 50, text: sentence(lead(0, what.length), what.length <= 2 ? what : [], info, tail) };
}

