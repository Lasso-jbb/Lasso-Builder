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
  /** Entitetens navn: det fjernes fra titel og undertitel, og siden afvises, hvis det står andre steder. */
  name?: string;
  /** Entitetens metadata (by, vejnavn og husnummer, CVR-nummer): fjernes som tekst og må ikke stå andre steder. */
  city?: string;
  street?: string;
  zip?: string;
  cvr?: string;
}

/** Komponenter, der er entitetens egne (navn, kontakt, opfølgende spørgsmål): de tages ikke med i en skabelon. */
const ENTITY_ONLY = new Set(["LassoFollowUps", "LassoCompanyHead", "LassoPersonHead"]);

export const NAME_REMAINS = "Siden indeholder stadig navnet; omdøb den først.";

const LEGAL_FORM = /\s+(A\/S|ApS|I\/S|K\/S|P\/S|IVS|ENK|A\.m\.b\.a\.?|F\.m\.b\.a\.?)$/i;
const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** Skrivemåderne af navnet, længste først: det fulde og uden selskabsform (A/S, ApS …), mindst 3 tegn. */
export function nameForms(name: string | undefined): string[] {
  const full = (name ?? "").trim().replace(/\s+/g, " ");
  if (!full) return [];
  const short = full.replace(LEGAL_FORM, "").trim();
  return [...new Set([full, short])].filter((f) => f.length >= 3).sort((a, b) => b.length - a.length);
}

const wordRe = (form: string, flags: string) => new RegExp(`(?<![\\p{L}])${escapeRe(form)}s?(?![\\p{L}])`, flags);

const PREPOSITIONS = /\s+(for|over|om|af|i|til|hos|på)$/iu;
const TRAILING = /[\s,;:–—-]+$/u;
const LEADING = /^[\s,;:–—-]+/u;

/** Oprydning efter en fjernelse: dobbelte mellemrum, tegnsætning og en præposition, der stod lige før det fjernede ("KYC-overblik for"). */
function tidy(text: string): string {
  let out = text.replace(/\s+/g, " ").replace(LEADING, "").replace(TRAILING, "");
  for (let prev = ""; prev !== out; ) {
    prev = out;
    out = out.replace(PREPOSITIONS, "").replace(TRAILING, "");
  }
  return out;
}

/** CVR-nummeret som tekst: "CVR 99000001", "CVR-nr. 99000001", "99 00 00 01" (med eller uden præfiks). */
function cvrRe(cvr: string, flags: string): RegExp {
  const digits = cvr.split("").join("\\s?");
  return new RegExp(`(?:(?<![\\p{L}])CVR(?:[-\\s]?(?:nr|nummer)\\.?)?[\\s:-]*)?(?<!\\d)${digits}(?!\\d)`, flags);
}

/** Entitetens CVR-nummer: fra entity.cvr eller Lasso-ID'et (CVR-1-…). */
function cvrOf(entity: TemplateEntity): string | undefined {
  const c = (entity.cvr ?? /^CVR-1-(\d{8})$/i.exec(entity.id.trim())?.[1] ?? "").replace(/\D/g, "");
  return /^\d{8}$/.test(c) ? c : undefined;
}

/** Alt, der identificerer entiteten som tekst: CVR (også formateret), Lasso-ID, gade, by og navn. */
function leakRes(entity: TemplateEntity): RegExp[] {
  const res: RegExp[] = [];
  const cvr = cvrOf(entity);
  // Lasso-id'et først, så "CVR-1-99000001" ikke efterlader "CVR-1" når nummeret klippes.
  if (entity.id.trim()) res.push(new RegExp(`(?<![\\p{L}\\d])${escapeRe(entity.id.trim())}(?![\\p{L}\\d])`, "giu"));
  if (cvr) res.push(cvrRe(cvr, "giu"));
  // Postnummeret: kun præcis det (et andet firecifret tal røres ikke).
  const zip = entity.zip?.trim();
  if (zip && /^\d{4}$/.test(zip)) res.push(new RegExp(`(?<!\\d)${zip}(?!\\d)`, "g"));
  for (const f of [entity.street, entity.city]) {
    const t = f?.trim().replace(/\s+/g, " ");
    if (t && t.length >= 3) res.push(wordRe(t, "giu"));
  }
  for (const f of nameForms(entity.name)) res.push(wordRe(f, "giu"));
  return res;
}

/** Teksten uden entitetens navn og metadata (CVR, Lasso-ID, by, gade) og uden den præposition eller tegnsætning, der blev tilbage. */
export function stripEntityName(text: string, entity: string | undefined | TemplateEntity): string {
  const e: TemplateEntity = typeof entity === "object" ? entity : { kind: "company", id: "", name: entity };
  let out = text;
  // Et efterstillet ", Navn" / " – Navn" først, så tegnsætningen går med.
  for (const f of nameForms(e.name)) out = out.replace(new RegExp(`\\s*[,–—:-]\\s*${escapeRe(f)}s?(?![\\p{L}])\\s*$`, "iu"), "");
  let changed = out !== text;
  for (const r of leakRes(e)) {
    const next = out.replace(r, "");
    if (next !== out) changed = true;
    out = next;
  }
  return changed ? tidy(out) : out.replace(/\s+/g, " ").trim();
}

/** Titlen, når den er tom efter fjernelsen af navnet: første komponents titel, ellers "Side". */
export function titleFallback(title: string, spec: ViewSpec): string {
  if (title.trim()) return title;
  const first = (spec.components[0] as { title?: unknown } | undefined)?.title;
  return typeof first === "string" && first.trim() ? first.trim() : "Side";
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
  // Entitetens egne komponenter (hoved, opfølgende spørgsmål) bærer navnet og hører ikke til en skabelon.
  const kept = parsed.data.components.filter((c) => !ENTITY_ONLY.has(c.type));
  if (!kept.length) return { error: "Siden består kun af entitetens hoved; tilføj noget andet først." };
  const forms = new Set(entityForms(entity).map((f) => f.toLowerCase()));
  const replaced = mapStrings({ ...parsed.data, components: kept }, (s) => (forms.has(s.trim().toLowerCase()) ? ENTITY_PLACEHOLDER : undefined));
  if (replaced.changed === 0) return { error: `Siden handler ikke om én ${noun(entity.kind)}.` };
  const base = replaced.value as ViewSpec;
  const title = titleFallback(stripEntityName(base.title, entity), base);
  // Undertitlen er entitetens metadata ("CVR …, by"): den gemmes ikke i specen; skabelonen bærer en egen, hvis brugeren gav en.
  const { subtitle: _old, ...rest } = base;
  const value = { ...rest, title };
  // Står navnet, CVR-nummeret, Lasso-id'et, byen eller gaden stadig et sted i specen, er siden ikke entitetsuafhængig.
  const test = leakRes(entity).map((r) => new RegExp(r.source, "iu"));
  if (mapStrings(value, (s) => (s !== ENTITY_PLACEHOLDER && test.some((r) => r.test(s)) ? "" : undefined)).changed > 0) return { error: NAME_REMAINS };
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
