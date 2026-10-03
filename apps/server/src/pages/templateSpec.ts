import { viewSpecSchema, type ViewSpec } from "@lasso/spec";

/**
 * Sideskabeloner (docs/chat.md, "Tilføj som fane"): en side, chatten har sat sammen om én virksomhed eller person
 * (fx et KYC-overblik), gemmes uden den ene entitet og kan så vises om enhver anden af samme slags. Specen bærer
 * entitetens id i komponenternes props (company, person, companies, benchmark, resume …); de erstattes af
 * pladsholderen {{entity}} og sættes ind igen med den entitet, siden åbnes for. Rene funktioner uden I/O.
 */

export const ENTITY_PLACEHOLDER = "{{entity}}";

export type TemplateKind = "company" | "person";

export interface TemplateEntity {
  kind: TemplateKind;
  /** Lasso-ID: CVR-1-… (virksomhed) eller CVR-3-… (person). */
  id: string;
}

/** De skrivemåder af entiteten, en spec kan bære: Lasso-ID'et, og for en virksomhed også CVR-nummeret (de 8 cifre). */
export function entityForms(entity: TemplateEntity): string[] {
  const id = entity.id.trim();
  const forms = [id];
  const cvr = entity.kind === "company" ? /^CVR-1-(\d{8})$/i.exec(id)?.[1] : undefined;
  if (cvr) forms.push(cvr);
  return forms;
}

/** Alle strengværdier i et JSON-træ ændret (nøgler røres aldrig); giver det nye træ og antallet af ændringer. */
function mapStrings(node: unknown, fn: (s: string) => string | undefined): { value: unknown; changed: number } {
  if (typeof node === "string") {
    const next = fn(node);
    return next === undefined ? { value: node, changed: 0 } : { value: next, changed: 1 };
  }
  if (Array.isArray(node)) {
    let changed = 0;
    const value = node.map((n) => {
      const r = mapStrings(n, fn);
      changed += r.changed;
      return r.value;
    });
    return { value, changed };
  }
  if (node && typeof node === "object") {
    let changed = 0;
    const value = Object.fromEntries(
      Object.entries(node).map(([k, v]) => {
        const r = mapStrings(v, fn);
        changed += r.changed;
        return [k, r.value];
      }),
    );
    return { value, changed };
  }
  return { value: node, changed: 0 };
}

const noun = (kind: TemplateKind) => (kind === "company" ? "virksomhed" : "person");

/**
 * Specen uden entiteten: hver strengværdi, der er entitetens id (eller CVR-nummer), bliver {{entity}}. Er der ingen,
 * handler siden ikke om én entitet og kan ikke blive en skabelon. Specen valideres først (som resten af systemet).
 */
export function templateFromSpec(spec: unknown, entity: TemplateEntity): { spec: ViewSpec } | { error: string } {
  const parsed = viewSpecSchema.safeParse(spec);
  if (!parsed.success) return { error: `Specen er ugyldig: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}.` };
  const forms = new Set(entityForms(entity).map((f) => f.toLowerCase()));
  const { value, changed } = mapStrings(parsed.data, (s) => (forms.has(s.trim().toLowerCase()) ? ENTITY_PLACEHOLDER : undefined));
  if (changed === 0) return { error: `Siden handler ikke om én ${noun(entity.kind)}.` };
  const out = viewSpecSchema.safeParse(value);
  if (!out.success) return { error: "Specen kunne ikke gøres til en skabelon." };
  return { spec: out.data };
}

/** Skabelonen om en bestemt entitet: {{entity}} erstattes af Lasso-ID'et overalt. */
export function instantiate(template: ViewSpec, entityId: string): ViewSpec {
  const id = entityId.trim();
  const { value } = mapStrings(template, (s) => (s === ENTITY_PLACEHOLDER ? id : undefined));
  return value as ViewSpec;
}

/** Om specen er en skabelon (bærer pladsholderen mindst ét sted). */
export function hasPlaceholder(spec: unknown): boolean {
  return mapStrings(spec, (s) => (s === ENTITY_PLACEHOLDER ? "" : undefined)).changed > 0;
}
