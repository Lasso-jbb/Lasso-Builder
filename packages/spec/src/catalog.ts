import { OPERATORS, type Criterion } from "./criteria.js";
import { FIELDS, FIELD_BY_KEY, OPERATORS_BY_TYPE } from "./fields.js";
import { METRICS, TABLE_COLUMNS, type ComponentType } from "./spec.js";

/**
 * Komponentkataloget, som modellen læser. ChatGPT læser ikke resources, så
 * kataloget skal stå i tool-beskrivelser og serverinstruktioner. Beskrivelserne
 * er vigtigere end koden: det er dem, modellen vælger ud fra.
 */
export interface CatalogEntry {
  type: ComponentType;
  title: string;
  description: string;
  props: string;
}

export const COMPONENT_CATALOG: readonly CatalogEntry[] = [
  {
    type: "LassoCompanyHead",
    title: "Virksomhedsheader",
    description: "Navn, CVR, status, form, branche og adresse for én virksomhed. Står øverst, når en visning handler om én virksomhed.",
    props: "company",
  },
  {
    type: "LassoKeyFigureCards",
    title: "Nøgletal",
    description: "3–6 nøgletalskort fra seneste regnskab med ændring i forhold til året før.",
    props: `company, metrics? (${METRICS.join(" | ")})`,
  },
  {
    type: "LassoBarChart",
    title: "Regnskabsgraf",
    description: "Søjlegraf for ét nøgletal over flere år.",
    props: `company, metric (${METRICS.join(" | ")}), years (2–10, standard 5)`,
  },
  {
    type: "LassoPersonList",
    title: "Ledelse",
    description: "Direktion og bestyrelse med rolle og tiltrådt/fratrådt. show='all' viser også fratrådte.",
    props: "company, show? (current | all), title?",
  },
  {
    type: "LassoOwnerList",
    title: "Ejerskab og revisor",
    description: "Legale ejere med ejerandel samt revisor.",
    props: "company",
  },
  {
    type: "LassoCompanyTable",
    title: "Virksomhedstabel",
    description: "Resultatliste fra en søgning med kriterier. Brugeren kan sortere, fjerne kriterier og klikke sig ind på en virksomhed uden en ny model-tur.",
    props: `source='search', search { query, criteria[], sort?, limit? }, columns? (${TABLE_COLUMNS.join(" | ")}), title?`,
  },
  {
    type: "LassoCompareTable",
    title: "Sammenligning",
    description: "Sammenligner 2–6 virksomheder side om side på udvalgte nøgletal.",
    props: `companies[], metrics? (${METRICS.join(" | ")}), title?`,
  },
  {
    type: "LassoFollowUps",
    title: "Opfølgningsknapper",
    description: "1–4 knapper, der sender et opfølgende spørgsmål til dig (modellen) som brugerens næste besked. Brug til analysespørgsmål som 'Hvem er nye i bestyrelsen?'.",
    props: "prompts[] { label, prompt }",
  },
];

export function catalogAsText(): string {
  return COMPONENT_CATALOG.map((c) => `- ${c.type} (${c.title}): ${c.description} Props: ${c.props}.`).join("\n");
}

export function fieldsAsText(): string {
  return FIELDS.map((f) => {
    const ops = OPERATORS_BY_TYPE[f.type].join(", ");
    const opts = f.options ? ` Værdier: ${f.options.join(", ")}.` : "";
    const unit = f.type === "amount" ? " Hele kroner." : "";
    return `- ${f.key} (${f.label}, ${f.type}): ${f.description}${unit}${opts} Operatorer: ${ops}.`;
  }).join("\n");
}

export const OPERATORS_TEXT = `Operatorer: ${OPERATORS.join(", ")}. gt betyder > og gte betyder ≥.`;

export interface CriterionIssue {
  index: number;
  message: string;
}

/** Tjekker kriterier mod feltkataloget. Returnerer forståelige fejl til modellen. */
export function validateCriteria(criteria: readonly Criterion[]): CriterionIssue[] {
  const issues: CriterionIssue[] = [];
  criteria.forEach((c, index) => {
    const field = FIELD_BY_KEY.get(c.field);
    if (!field) {
      issues.push({ index, message: `Ukendt felt '${c.field}'. Brug et af: ${FIELDS.map((f) => f.key).join(", ")}.` });
      return;
    }
    const allowed = OPERATORS_BY_TYPE[field.type];
    if (!allowed.includes(c.operator)) {
      issues.push({ index, message: `Operator '${c.operator}' passer ikke til '${c.field}'. Tilladte: ${allowed.join(", ")}.` });
      return;
    }
    if (c.operator === "between" && !(Array.isArray(c.value) && c.value.length === 2)) {
      issues.push({ index, message: `'between' på '${c.field}' kræver value: [fra, til].` });
    }
    if ((c.operator === "in" || c.operator === "not_in") && !Array.isArray(c.value)) {
      issues.push({ index, message: `'${c.operator}' på '${c.field}' kræver en liste som value.` });
    }
    if (field.options && c.operator !== "between") {
      const values = Array.isArray(c.value) ? c.value : [c.value];
      const bad = values.filter((v) => !field.options!.some((o) => o.toLowerCase() === String(v).toLowerCase()));
      if (bad.length > 0) {
        issues.push({ index, message: `Ukendt værdi for '${c.field}': ${bad.join(", ")}. Brug: ${field.options.join(", ")}.` });
      }
    }
  });
  return issues;
}
