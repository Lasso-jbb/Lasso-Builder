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
    type: "LassoGroupedBarChart",
    title: "Grupperede søjler",
    description: "2–3 nøgletal side om side pr. år, til at sammenligne udviklingen i flere størrelser samtidig.",
    props: `company, metrics? (2–3 af ${METRICS.join(" | ")}), years (2–10, standard 5)`,
  },
  {
    type: "LassoStackedBarChart",
    title: "Stablede søjler",
    description: "Egenkapital og gæld som dele af balancen, pr. år.",
    props: "company, years (2–10, standard 5)",
  },
  {
    type: "LassoLineChart",
    title: "Linjegraf med benchmark",
    description: "Ét nøgletal som linje med områdefyld over flere år, med en valgfri sammenligningsvirksomhed som stiplet benchmark-linje.",
    props: `company, metric (${METRICS.join(" | ")}), years (2–10, standard 5), benchmark? (virksomhed)`,
  },
  {
    type: "LassoWaterfallChart",
    title: "Vandfald",
    description: "Fra omsætning/bruttofortjeneste til årets resultat for seneste regnskabsår.",
    props: "company",
  },
  {
    type: "LassoShareBars",
    title: "Fordeling",
    description: "Egenkapital og gæld som andele af balancen for seneste regnskabsår.",
    props: "company",
  },
  {
    type: "LassoRanking",
    title: "Rangliste",
    description: "Vandrette søjler: virksomheden fremhævet i koral blandt lignende virksomheder på ét nøgletal.",
    props: `companies[] (2–10, første fremhæves), metric (${METRICS.join(" | ")}), title?`,
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
    type: "LassoKeyValueList",
    title: "Nøgle-værdi-liste",
    description: "Mange felter med én værdi hver. variant='company': revisor, regnskabsperiode, stiftet, form, branche og kontakt. variant='financials': regnskabstal for et valgt år med årsvælger, tal højrestillet.",
    props: "company, variant? (company | financials), title?",
  },
  {
    type: "LassoMultiYearTable",
    title: "Flerårstabel",
    description: "Sammenligner nøgletal på tværs af flere år i en tabel, med ændring og tendens pr. række. Brug frem for søjlegrafen, når flere nøgletal skal ses samtidig.",
    props: `company, metrics? (${METRICS.join(" | ")}), years (2–10, standard 5), title?`,
  },
  {
    type: "LassoScoreGauge",
    title: "Scoremåler",
    description: "Viser en score 0–100 som måler (0 lav risiko, 100 høj risiko). Der er endnu ingen live datakilde for scoren; brug kun i demovisninger, indtil en kilde er tilsluttet.",
    props: "company, title?",
  },
  {
    type: "LassoRiskObservations",
    title: "Risikoobservationer",
    description: "Lassos observationer om en virksomhed (fx negativ egenkapital, revisorskifte, ledelsesændringer), sorteret efter alvor på skalaen 0–100.",
    props: "company, title?",
  },
  {
    type: "LassoAuditorIndependence",
    title: "Revisoruafhængighed",
    description: "Sammenfatning og relationstabel mellem revisionshus, kunden og personer, med en vurdering pr. relation på alvorsskalaen.",
    props: "company, title?",
  },
  {
    type: "LassoFollowUps",
    title: "Opfølgningsknapper",
    description: "1–4 knapper, der sender et opfølgende spørgsmål til dig (modellen) som brugerens næste besked. Brug til analysespørgsmål som 'Hvem er nye i bestyrelsen?'.",
    props: "prompts[] { label, prompt }",
  },
  {
    type: "LassoRelations",
    title: "Rolleliste, kompakt",
    description: "Kompakt overblik til en skinne eller smal kolonne: direktion, bestyrelse (formand i parentes) og de tre største legale ejere. Brug i stedet for LassoPersonList/LassoOwnerList, når pladsen er smal.",
    props: "company, title?",
  },
  {
    type: "LassoBeneficialOwners",
    title: "Reelle ejere",
    description: "Personerne bag virksomheden med deres indirekte ejerandel og ejerkæden gennem mellemliggende selskaber. Vis kun, når spørgsmålet handler om, hvem der reelt ejer virksomheden, ikke de legale ejere (brug LassoOwnerList til dem).",
    props: "company",
  },
  {
    type: "LassoTextSections",
    title: "Tekstsektioner",
    description: "Branche, formål og tegningsregler fra CVR-stamdata som korte tekstafsnit.",
    props: "company, title?",
  },
  {
    type: "LassoSummary",
    title: "Resumé",
    description: "Et resumé skrevet af dig (modellen) ud fra virksomhedens tal og fakta, vist som en almindelig sektion med kildelinje. Du skriver selv teksten i 'text'; komponenten henter ikke data.",
    props: "text, title?, source?, updated?",
  },
  {
    type: "LassoTimeline",
    title: "Tidslinje",
    description: "Historik over tid: stiftelse, ledelsesskift og offentliggjorte regnskaber, nyeste øverst.",
    props: "company, title?",
  },
  {
    type: "LassoNews",
    title: "Nyheder",
    description: "Nyheder og omtale af virksomheden med kilde, tidspunkt og uddrag.",
    props: "company, limit? (1–10, standard 5)",
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
