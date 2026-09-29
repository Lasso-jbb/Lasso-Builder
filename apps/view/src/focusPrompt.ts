import { FOCUS_LABELS, isFocusFor, PERSON_FOCUS_LABELS, shortCompanyName, type Dataset, type Focus, type PersonFocus, type ViewSpec } from "@lasso/spec";

/**
 * MCP-appen: open-focus (overblikkets "Se alle … i Historik") som besked til chatten, fx "Vis historik
 * for Novo Nordisk". Modellen svarer med show_company (eller show_person) med det fokus. null, når
 * siden ikke er en virksomheds- eller personside, eller fokus ikke passer til den.
 */
export function focusPrompt(spec: ViewSpec, ds: Dataset | null | undefined, focus: string): string | null {
  const kind = spec.kind;
  if (kind !== "company" && kind !== "person") return null;
  if (!isFocusFor(kind, focus)) return null;
  const id = spec.components
    .map((c) => (kind === "company" ? ("company" in c ? c.company : undefined) : "person" in c ? c.person : undefined))
    .find((v): v is string => typeof v === "string" && v.length > 0);
  const name = kind === "company" ? shortCompanyName((id && ds?.companies[id]?.name) || spec.title) : (id && ds?.persons[id]?.name) || spec.title;
  const label = kind === "company" ? FOCUS_LABELS[focus as Focus] : PERSON_FOCUS_LABELS[focus as PersonFocus];
  return `Vis ${label.toLowerCase()} for ${name}`;
}
