/**
 * Eval-skema (plan A1, docs/plan-mcp.md): måler om et spørgsmål giver den rigtige modulside.
 *
 * Et eval-tilfælde er ét spørgsmål om én demo-virksomhed eller -person, med det svar-element vi
 * forventer først på siden. Træf = det første element efter hovedet og nøgletalskortene har den
 * forventede type, og de angivne props matcher (delmængde). Træfprocent = træf / tilfælde.
 *
 * To niveauer måles (A4):
 *  - "side": den komponerede side (composeCompany/composePerson med ask) — det brugeren får.
 *  - "plan": askPlan(...).lead[0] — hensigten, uafhængigt af om demodata har indhold.
 * Tilfælde med dataInDemo=false tæller kun på plan-niveau (demodata mangler kategorien; live har den).
 *
 * Mål (ejer, 29.09.2026): ≥ 90 % på side-niveau, og højere end baseline.
 */
import type { ComponentType, Metric } from "../spec.js";
import type { Focus } from "../compose.js";
import type { PersonFocus } from "../composePerson.js";

export type EvalKind = "company" | "person";

export interface EvalExpectation {
  /** Svar-elementet: første komponent efter hoved og nøgletalskort. */
  lead: ComponentType;
  /** Props der skal matche på svar-elementet (delmængde, dyb lighed pr. nøgle). */
  leadProps?: Record<string, unknown>;
  /** Skal også findes et sted på siden. */
  alsoPresent?: ComponentType[];
  /** Må ikke findes på siden. */
  absent?: ComponentType[];
  /** Ved generiske spørgsmål: fokus siden forventes at lande på. */
  focus?: Focus | PersonFocus;
}

export interface EvalCase {
  /** Stabil nøgle, fx "c-ejere-01". */
  id: string;
  kind: EvalKind;
  /** Demo-Lasso-ID (CVR-1-990000xx eller CVR-3-4000000001). */
  entity: string;
  /** Brugerens spørgsmål ordret, som det sendes i `question`. */
  question: string;
  /** Hints som den kaldende AI må sende med (svarer til show_company/show_person-felter). */
  hints?: { metrics?: Metric[]; topic?: string; focus?: Focus | PersonFocus; show_all?: boolean };
  expected: EvalExpectation;
  /** Hvilke komponenter tilfældet er sat i verden for at dække (dækningsrapport). */
  covers: ComponentType[];
  /** false = demodata har ikke kategorien; tæller kun på plan-niveau. */
  dataInDemo: boolean;
  /** Gruppe til rapporten: "eksisterende" (de 32 ask.ts kender i dag) eller "manglende" (de 21). */
  group: "eksisterende" | "manglende";
  note?: string;
}

export interface EvalFile {
  version: 1;
  /** Ejerens mål i procent. */
  target: number;
  cases: EvalCase[];
}

/** Delmængde-match: hver nøgle i `want` skal findes i `have` med dyb lighed. */
export function propsMatch(have: Record<string, unknown>, want: Record<string, unknown> | undefined): boolean {
  if (!want) return true;
  return Object.entries(want).every(([k, v]) => JSON.stringify((have as Record<string, unknown>)[k]) === JSON.stringify(v));
}

/** Første element efter hoved og nøgletalskort/persontal: det, der skal være svaret. */
export function leadOf<T extends { type: ComponentType }>(components: readonly T[]): T | undefined {
  const structural = new Set<ComponentType>(["LassoCompanyHead", "LassoPersonHead", "LassoKeyFigureCards", "LassoPersonStats"]);
  return components.find((c) => !structural.has(c.type));
}

export interface CaseResult {
  id: string;
  level: "side" | "plan";
  hit: boolean;
  got?: string;
  want: string;
  alsoMissing: ComponentType[];
  absentFound: ComponentType[];
}

/** Bedøm én side (liste af komponenter) mod forventningen. */
export function scoreComponents(c: EvalCase, level: "side" | "plan", components: readonly { type: ComponentType }[]): CaseResult {
  // Forventes et strukturelt element (fx LassoPersonStats under personhovedet) som svar, må det stå
  // blandt de første fire; ellers gælder det første ikke-strukturelle element.
  const structuralWanted = ["LassoCompanyHead", "LassoPersonHead", "LassoKeyFigureCards", "LassoPersonStats"].includes(c.expected.lead);
  const lead = structuralWanted ? components.slice(0, 4).find((x) => x.type === c.expected.lead) ?? leadOf(components) : leadOf(components);
  const hit = !!lead && lead.type === c.expected.lead && propsMatch(lead as Record<string, unknown>, c.expected.leadProps);
  const types = new Set(components.map((x) => x.type));
  return {
    id: c.id,
    level,
    hit,
    got: lead ? `${lead.type}${JSON.stringify(lead)}` : undefined,
    want: `${c.expected.lead}${c.expected.leadProps ? JSON.stringify(c.expected.leadProps) : ""}`,
    alsoMissing: (c.expected.alsoPresent ?? []).filter((t) => !types.has(t)),
    absentFound: (c.expected.absent ?? []).filter((t) => types.has(t)),
  };
}
