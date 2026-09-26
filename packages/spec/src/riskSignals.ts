import { formatAmount, formatDate } from "./format.js";
import type { Dataset, ObservationRowVM, ObservationsVM, Severity } from "./models.js";

/**
 * Egne risikosignaler, afledt af data, serveren allerede har (status, regnskab, ledelse,
 * revisor). Lassos observations-endpoint kan være tomt (adgang eller data), og så må
 * visningen aldrig give grønt lys for et selskab under konkurs (review P0-3).
 *
 * Ren funktion: samme datasæt giver samme signaler; `now` kan sættes i tests.
 */
export interface RiskSignals {
  signals: ObservationRowVM[];
  /** Hvad der faktisk er tjekket, fx ["status", "regnskab", "ledelse", "revisor"]. */
  checked: string[];
}

const MONTH = 30.44 * 24 * 3600 * 1000;

function monthsBetween(from: string | undefined, now: Date): number | null {
  if (!from) return null;
  const t = Date.parse(from);
  return Number.isNaN(t) ? null : (now.getTime() - t) / MONTH;
}

/** Status-tekst -> signal. Konkurs og tvangsopløsning er vigtige; ophørte er mulige vigtige. */
function statusSignal(status: string | undefined): { severity: Severity; title: string } | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (/konkurs|bankrupt/.test(s)) return { severity: 100, title: `Status: ${status}` };
  if (/tvangsopl|compulsory/.test(s)) return { severity: 100, title: `Status: ${status}` };
  if (/likvidation|liquidat|rekonstruktion/.test(s)) return { severity: 50, title: `Status: ${status}` };
  if (/opløst|ophørt|slettet|dissolved|ceased|inactive/.test(s)) return { severity: 50, title: `Status: ${status}` };
  return null;
}

export function riskSignals(lassoId: string, ds: Dataset, now: Date = new Date()): RiskSignals {
  const signals: ObservationRowVM[] = [];
  const checked: string[] = [];
  const add = (id: string, severity: Severity, title: string, detail: string | undefined, source: string, date?: string) =>
    signals.push({ id: `afledt:${id}`, severity, title, detail, source, date });

  const company = ds.companies[lassoId];
  const status = statusSignal(company?.status);
  const ended = !!status;
  if (company) {
    checked.push("status");
    if (status) add("status", status.severity, status.title, undefined, "CVR");
  }

  const fin = ds.financials[lassoId];
  if (fin) {
    checked.push("regnskab");
    const years = fin.years;
    const last = years.at(-1);
    if (last && typeof last.equity === "number" && last.equity < 0) {
      add("egenkapital", 50, "Negativ egenkapital", `Egenkapital ${formatAmount(last.equity)} i regnskabet for ${last.year}.`, `Regnskab ${last.year}`);
    }
    // Underskud i træk, talt bagfra fra seneste regnskab.
    let losses = 0;
    for (let i = years.length - 1; i >= 0; i--) {
      const p = years[i]!.profit;
      if (typeof p === "number" && p < 0) losses++;
      else break;
    }
    if (losses >= 2 && last) {
      add("underskud", losses >= 3 ? 50 : 25, `Underskud ${losses} år i træk`, `Årets resultat har været negativt i ${years.at(-losses)!.year}–${last.year}.`, `Regnskab ${last.year}`);
    }
    // Manglende regnskab: kun for aktive selskaber, der er gamle nok til at skulle have aflagt ét.
    if (!ended) {
      const age = monthsBetween(company?.founded, now);
      const nowYear = now.getFullYear();
      if (!last && age !== null && age > 24) {
        add("regnskab", 50, "Intet offentliggjort regnskab", "Selskabet er over to år gammelt, men der findes intet regnskab.", "Regnskab");
      } else if (last && last.year < nowYear - 2) {
        add("regnskab", 50, "Regnskab mangler", `Seneste offentliggjorte regnskab er for ${last.year}.`, "Regnskab");
      }
    }
  }

  const auditor = ds.ownership[lassoId]?.auditor;
  if (ds.ownership[lassoId]) {
    checked.push("revisor");
    const since = monthsBetween(auditor?.from, now);
    if (auditor && since !== null && since >= 0 && since < 12) {
      add("revisor", 25, "Revisorskift for nylig", `${auditor.name} har været revisor siden ${formatDate(auditor.from)}.`, "CVR", auditor.from);
    }
  }

  const people = ds.people[lassoId];
  if (people) {
    checked.push("ledelse");
    // Ind- og udtrædelser i direktion og bestyrelse de seneste 24 måneder.
    const changes = people.flatMap((p) => [p.from, p.to]).filter((d) => {
      const m = monthsBetween(d, now);
      return m !== null && m >= 0 && m < 24;
    }).length;
    if (changes >= 4) add("ledelse", 25, "Mange ledelsesskift", `${changes} ind- og udtrædelser i ledelsen de seneste to år.`, "Ledelse");
    if (!ended && company && people.filter((p) => !p.to).length === 0) {
      add("ingen-ledelse", 50, "Ingen registreret ledelse", people.length ? "Alle registrerede personer i ledelsen er fratrådt." : "CVR har ingen direktion eller bestyrelse registreret.", "Ledelse");
    }
  }

  return { signals: signals.sort((a, b) => b.severity - a.severity), checked };
}

const TOPIC: Record<string, RegExp> = {
  "afledt:status": /konkurs|tvangsopl|likvid|opløst|ophørt|status/,
  "afledt:egenkapital": /egenkapital/,
  "afledt:underskud": /underskud|negativt resultat/,
  "afledt:revisor": /revisor/,
  "afledt:regnskab": /regnskab mangler|intet regnskab|manglende regnskab/,
  "afledt:ledelse": /ledelsesskift|udskiftning/,
  "afledt:ingen-ledelse": /ingen (registreret )?ledelse|ingen direktion/,
};

/** Afledte signaler, som Lassos egne observationer ikke allerede dækker (samme emne: Lasso vinder). */
export function extraSignals(own: readonly ObservationRowVM[], derived: readonly ObservationRowVM[]): ObservationRowVM[] {
  const text = own.map((o) => `${o.title} ${o.detail ?? ""}`.toLowerCase()).join(" | ");
  return derived.filter((s) => !TOPIC[s.id]?.test(text));
}

/**
 * Lassos observationer plus de afledte signaler, uden dubletter. Bruges af komponisten,
 * tekstkortet og resuméet; risikoboksen gør det samme med extraSignals.
 */
export function mergedObservations(lassoId: string, ds: Dataset, now: Date = new Date()): { observations: ObservationRowVM[]; lasso?: ObservationsVM; derived: RiskSignals; extra: ObservationRowVM[] } {
  const lasso = ds.observations[lassoId];
  const derived = riskSignals(lassoId, ds, now);
  const own = lasso?.observations ?? [];
  const extra = extraSignals(own, derived.signals);
  return { observations: [...own, ...extra].sort((a, b) => b.severity - a.severity), lasso, derived, extra };
}
