import { z } from "zod";

/**
 * Den ene fælles operatorliste. De danske tekster er kun labels; logikken
 * bruger altid nøglerne. `gt` er strengt større end (>), `gte` er større end
 * eller lig med (≥). Samme for `lt`/`lte`.
 */
export const OPERATORS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "in",
  "not_in",
  "contains",
  "starts_with",
  "before",
  "after",
] as const;

export type Operator = (typeof OPERATORS)[number];

export const OPERATOR_LABELS: Record<Operator, string> = {
  eq: "er lig med",
  neq: "er ikke",
  gt: "er større end",
  gte: "er mindst",
  lt: "er mindre end",
  lte: "er højst",
  between: "er mellem",
  in: "er en af",
  not_in: "er ikke en af",
  contains: "indeholder",
  starts_with: "begynder med",
  before: "før den",
  after: "efter den",
};

/** Label for en operator på en bestemt felttype (datoer siger "præcis den"/"mellem"). */
export function operatorLabel(op: Operator, fieldType?: string): string {
  if (fieldType === "date") {
    if (op === "eq") return "præcis den";
    if (op === "between") return "mellem";
  }
  return OPERATOR_LABELS[op];
}

export const OPERATOR_SYMBOLS: Record<Operator, string> = {
  eq: "=",
  neq: "≠",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  between: "–",
  in: "∈",
  not_in: "∉",
  contains: "∋",
  starts_with: "^",
  before: "<",
  after: ">",
};

const scalar = z.union([z.string(), z.number(), z.boolean()]);

export const criterionValueSchema = z.union([
  scalar,
  z.array(z.union([z.string(), z.number()])).min(1).max(50),
]);

export const criterionSchema = z
  .object({
    field: z
      .string()
      .min(1)
      .describe("Feltnøgle fra feltkataloget, fx 'omsaetning', 'region', 'ansatte'."),
    operator: z
      .enum(OPERATORS)
      .describe(
        "eq, neq, gt (>), gte (≥), lt (<), lte (≤), between ([fra, til]), in/not_in (liste), contains, starts_with, before/after (datoer ÅÅÅÅ-MM-DD).",
      ),
    value: criterionValueSchema.describe(
      "Beløb i hele kroner (10 mio. = 10000000). between tager [fra, til]. in/not_in tager en liste.",
    ),
  })
  .describe("Ét søgekriterium. Rendereren vælger selv kontroltypen ud fra feltet.");

export type CriterionValue = z.infer<typeof criterionValueSchema>;
export type Criterion = z.infer<typeof criterionSchema>;
