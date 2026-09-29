import {
  askFocus,
  askPersonFocus,
  companyTemplate,
  composeCompany,
  composePerson,
  composePersonProbe,
  composeProbe,
  cvrFromLassoId,
  formatCriterion,
  isPersonId,
  listTemplate,
  mainMetric,
  parseAsk,
  shortCompanyName,
  toLassoId,
  validateCriteria,
  viewSpecSchema,
  type Ask,
  type CompanySection,
  type Dataset,
  type Focus,
  type Metric,
  type PersonFocus,
  type SearchQuery,
  type TableColumn,
  type ViewComponent,
  type ViewSpec,
} from "@lasso/spec";
import { findCompany, isCompanyRef, type CompanyPick } from "../data/lookup.js";
import { findPerson } from "../data/personLookup.js";
import type { DataProvider } from "../data/provider.js";
import { errorMessage, normalizeSpec, resolveSpec } from "../data/resolve.js";
import { SLUG_PATTERN, slugify, ViewConflictError, type Visibility } from "../views/store.js";
import { companyLink, personLink } from "../web/links.js";
import { extrasOf, fail, type UseCaseCtx, type UseCaseError, type ViewData } from "./context.js";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Kriteriefejl som én tekst, modellen/brugeren kan rette efter; null = kriterierne er gyldige. */
export function criteriaError(criteria: Parameters<typeof validateCriteria>[0]): UseCaseError | null {
  const issues = validateCriteria(criteria);
  if (issues.length === 0) return null;
  return fail(400, `Ret kriterierne og prøv igen:\n${issues.map((i) => `- kriterie ${i.index + 1}: ${i.message}`).join("\n")}`);
}

/**
 * Slår virksomhedsnavne i en render_view-spec op (company, companies[], benchmark) med samme
 * navneopslag som show_company. CVR-numre og Lasso-ID'er røres ikke. Valget står i noten.
 */
export async function lookupCompanyNames(spec: ViewSpec, provider: DataProvider): Promise<{ spec: ViewSpec; note?: string }> {
  const refs = new Set<string>();
  const collect = (ref: string | undefined) => {
    if (ref && !isCompanyRef(ref)) refs.add(ref);
  };
  for (const c of spec.components) {
    if ("company" in c && typeof c.company === "string") collect(c.company);
    if ("companies" in c && Array.isArray(c.companies)) c.companies.forEach((x: string) => collect(x));
    if (c.type === "LassoLineChart") collect(c.benchmark);
  }
  if (refs.size === 0) return { spec };
  const found = new Map<string, string>();
  const notes: string[] = [];
  await Promise.all(
    [...refs].map(async (ref) => {
      try {
        const hit = await findCompany(provider, ref);
        if (!hit) return void notes.push(`Fandt ingen virksomhed, der hedder "${ref}".`);
        found.set(ref, hit.pick.lassoId);
        const alt = hit.alternatives.slice(0, 2).map((r) => `${r.name} (${r.cvr ?? r.lassoId})`).join("; ");
        notes.push(`"${ref}" = ${hit.pick.name} (${hit.pick.cvr ?? hit.pick.lassoId})${alt ? `; andre match: ${alt}` : ""}.`);
      } catch (err) {
        notes.push(`Kunne ikke slå "${ref}" op: ${errorMessage(err)}.`);
      }
    }),
  );
  const fix = (ref: string) => found.get(ref) ?? ref;
  const components = spec.components.map((c) => {
    let out = c as ViewComponent & { company?: string; companies?: string[]; benchmark?: string };
    if (typeof out.company === "string") out = { ...out, company: fix(out.company) };
    if (Array.isArray(out.companies)) out = { ...out, companies: out.companies.map(fix) };
    if (typeof out.benchmark === "string") out = { ...out, benchmark: fix(out.benchmark) };
    return out as ViewComponent;
  });
  return { spec: { ...spec, components }, note: `Navneopslag: ${notes.join(" ")}` };
}

/* --- search_companies / GET /api/portal/search ------------------------------------------- */

export interface SearchInput extends SearchQuery {
  /** Overskrift på listen. Standard: Lassos fortolkning af friteksten eller kriterierne. */
  title?: string;
  columns?: readonly TableColumn[];
}

/**
 * Søgning som Lasso-tabel med udfyldt filterpanel. Lasso fortolker friteksten til filtre, som vises
 * i filterpanelet. Et navn kan ikke fortolkes og søges som navn. Kriterier, der allerede er sat,
 * vinder over Lassos for samme felt.
 */
export async function searchCompanies(ctx: UseCaseCtx, input: SearchInput): Promise<ViewData | UseCaseError> {
  const { title, columns, ...rest } = input;
  let search: SearchQuery = rest;
  const invalid = criteriaError(search.criteria);
  if (invalid) return invalid;
  let note: string | undefined;
  const text = search.query.trim();
  const interpreted = text && ctx.provider.interpret ? await ctx.provider.interpret(text) : null;
  if (interpreted) {
    const given = new Set(search.criteria.map((c) => c.field));
    search = { ...search, query: "", criteria: [...search.criteria, ...interpreted.criteria.filter((c) => !given.has(c.field))] };
    note = `Lasso fortolkede "${text}" som: ${interpreted.criteria.map(formatCriterion).join("; ")}.${interpreted.unknown.length ? ` Kunne ikke oversættes og indgår derfor IKKE i søgningen (nævn det for brugeren): ${interpreted.unknown.join("; ")}.` : ""}`;
  }
  const spec = listTemplate(search, { title: title ?? (interpreted ? capitalize(text) : undefined), columns });
  const dataset = await resolveSpec(spec, ctx.provider);
  return { spec, dataset, ...(note ? { note } : {}) };
}

/* --- show_company / GET /api/portal/company/:ref ------------------------------------------ */

export interface ShowCompanyInput {
  /** CVR-nummer, Lasso-ID eller navn. */
  company: string;
  focus?: Focus;
  years?: number;
  chart_metric?: Metric;
  /** Forældet: fast skabelon i stedet for komponisten. */
  sections?: CompanySection[];
  /** Brugerens spørgsmål ordret (højst 300 tegn): serveren vælger elementer og data efter det. */
  question?: string;
  /** Nøgletal, modellen har genkendt i spørgsmålet (lægges forrest i spørgsmålsprofilen). */
  metrics?: Metric[];
  /** "Vis alt om X" (brugervalg): alle elementer i fuld form, også ud over højdebudgettet (23.3). */
  show_all?: boolean;
}

export interface CompanyView extends ViewData {
  /** Virksomhedens Lasso-ID (CVR-1-…), også når den blev fundet ud fra et navn. */
  lassoId: string;
  /** Signeret link til /k/ med samme focus, hovednøgletal og spørgsmål (MCP-tools). Portalen bruger /e/. */
  link?: string;
  /** Spørgsmålsprofilen, når spørgsmålet har et emne (resuméets "Svar:" og tekstkortet svarer først). */
  ask?: Ask;
}

/** Navnet på en virksomhed i de stavemåder, der fjernes fra spørgsmålet, før det læses. */
export const companyNameHints = (name: string | undefined) => (name ? [name, shortCompanyName(name)] : undefined);

/**
 * Én virksomhed som ét skærmbillede, komponeret ud fra spørgsmålet (question: en hel side i
 * spørgsmålets kontekst), ellers hensigten (focus), og virksomhedens data.
 */
export async function showCompany(ctx: UseCaseCtx, input: ShowCompanyInput): Promise<CompanyView | UseCaseError> {
  const { config, provider } = ctx;
  const { company, sections, chart_metric, years, show_all } = input;
  let lassoId = toLassoId(company, config.LASSO_COMPANY_ID_PREFIX);
  let note: string | undefined;
  let official: string | undefined;
  if (!isCompanyRef(company)) {
    let found: CompanyPick | null;
    try {
      found = await findCompany(provider, company);
    } catch (err) {
      return fail(404, `Kunne ikke slå "${company}" op: ${errorMessage(err)}.`);
    }
    if (!found) return fail(404, `Fandt ingen virksomhed, der hedder "${company}". Prøv et andet navn eller CVR-nummeret.`);
    lassoId = found.pick.lassoId;
    official = found.pick.name;
    const alt = found.alternatives.map((r) => `${r.name} (${r.cvr ?? r.lassoId})`).join("; ");
    note = `Fundet ud fra navnet "${company}": ${found.pick.name} (${found.pick.cvr ?? found.pick.lassoId}).${alt ? ` Andre match: ${alt}. Mente brugeren en af dem, så kald show_company igen med dens CVR-nummer.` : ""}`;
  }
  // Spørgsmålet læses uden virksomhedens navn ("X Holding", "X Ejendomme" er ikke emner); ved et
  // CVR-nummer hentes navnet først (samme cachede opslag som hovedet), som på den delte side /k/.
  const question = sections?.length ? undefined : input.question?.trim() || undefined;
  if (question && !official) official = await provider.company(lassoId).then((c) => c.name).catch(() => undefined);
  const ask = question ? parseAsk(question, "company", { metrics: input.metrics, name: companyNameHints(official) }) : undefined;
  // Et generelt spørgsmål uden focus giver fokus-siden for spørgsmålets fokus ("hvordan går det" → oekonomi).
  const focus = input.focus ?? (ask?.generic ? askFocus(ask) : undefined);
  const dataset: Dataset = await resolveSpec(
    sections?.length ? companyTemplate(lassoId, { sections, chartMetric: chart_metric, years }) : composeProbe(lassoId, focus, ask),
    provider,
    extrasOf(ctx),
  );
  const name = dataset.companies[lassoId]?.name;
  if (!name) {
    return fail(404, `Kunne ikke hente ${company}: ${dataset.errors[`company:${lassoId}`] ?? "ukendt fejl"}. Tjek CVR-nummeret eller navnet.`);
  }
  // Ældre kald med faste sektioner får skabelonen; ellers komponeres ud fra datas form.
  const spec: ViewSpec = sections?.length
    ? companyTemplate(lassoId, { sections, chartMetric: chart_metric, years, name })
    : composeCompany(lassoId, dataset, { focus, years, chartMetric: chart_metric, name, ask, ...(show_all ? { showAll: true } : {}) });
  const cvr = cvrFromLassoId(lassoId);
  // Linket åbner samme visning (focus og spørgsmål) med samme hovednøgletal som i chatten (review P2-7).
  const link = cvr
    ? companyLink(config, {
        cvr,
        metric: chart_metric ?? mainMetric(dataset.financials[lassoId]?.years ?? []),
        years: years ?? (focus === "oekonomi" ? 10 : 5),
        focus: sections?.length ? undefined : focus,
        ...(ask ? { question: ask.question, ...(input.metrics?.length ? { metrics: input.metrics } : {}) } : {}),
      })
    : undefined;
  return { spec, dataset, ...(note ? { note } : {}), lassoId, ...(link ? { link } : {}), ...(ask && !ask.generic ? { ask } : {}) };
}

/* --- show_person / GET /api/portal/person/:ref -------------------------------------------- */

export interface PersonView extends ViewData {
  /** Personens Lasso-ID (CVR-3-…). */
  lassoId: string;
  /** Signeret link til personsiden /p/ med samme fokus og spørgsmål. */
  link: string;
  /** Spørgsmålsprofilen, når spørgsmålet har et emne (resuméets "Svar:" og tekstkortet svarer først). */
  ask?: Ask;
}

export interface ShowPersonInput {
  /** Navn eller person-ID (CVR-3-…). */
  person: string;
  /** Personfokus (overblik, roller, netvaerk, ejerskab, risiko, historik). Standard: overblik. */
  focus?: PersonFocus;
  /** Brugerens spørgsmål ordret (højst 300 tegn): serveren vælger elementer og data efter det. */
  question?: string;
  /** "Vis alt om X" (brugervalg): alle elementer i fuld form, også ud over højdebudgettet. */
  show_all?: boolean;
}

/** Én person fra CVR som ét skærmbillede (katalog 16), komponeret ud fra hensigt (focus) og personens data. Tager navn eller person-ID. */
export async function showPerson(ctx: UseCaseCtx, input: ShowPersonInput): Promise<PersonView | UseCaseError> {
  const { config, provider } = ctx;
  const ref = input.person.trim();
  let lassoId = ref;
  let note: string | undefined;
  let official: string | undefined;
  if (!isPersonId(ref)) {
    if (isCompanyRef(ref)) return fail(400, `"${ref}" er et CVR-nummer eller virksomheds-ID. Brug show_company til virksomheder.`);
    let found;
    try {
      found = await findPerson(provider, ref);
    } catch (err) {
      return fail(404, `Kunne ikke slå "${ref}" op: ${errorMessage(err)}.`);
    }
    if (!found) return fail(404, `Fandt ingen person, der hedder "${ref}". Prøv med fulde navn.`);
    lassoId = found.pick.lassoId;
    official = found.pick.name;
    const alt = found.alternatives.map((r) => `${r.name}${r.city ? `, ${r.city}` : ""} (${r.lassoId})`).join("; ");
    note = `Fundet ud fra navnet "${ref}": ${found.pick.name}${found.pick.city ? `, ${found.pick.city}` : ""} (${found.pick.lassoId}).${alt ? ` Andre match: ${alt}. Mente brugeren en af dem, så kald show_person igen med dens ID.` : ""}`;
  }
  // Spørgsmålet læses uden personens navn; ved et ID hentes navnet først (samme opslag som hovedet).
  const question = input.question?.trim() || undefined;
  if (question && !official) official = await provider.person(lassoId).then((x) => x.name).catch(() => undefined);
  const ask = question ? parseAsk(question, "person", { name: official }) : undefined;
  const focus = input.focus ?? (ask?.generic ? askPersonFocus(ask) : undefined) ?? "overblik";
  // Kun det, fokus (eller spørgsmålet) viser, hentes (fx nyheder kun på historik, ejerdiagrammet kun på overblik og ejerskab).
  const dataset = await resolveSpec(composePersonProbe(lassoId, focus, ask), provider, extrasOf(ctx));
  const p = dataset.persons[lassoId];
  if (!p) return fail(404, `Kunne ikke hente personen ${lassoId}: ${dataset.errors[`person:${lassoId}`] ?? "ukendt fejl"}.`);
  const spec = composePerson(lassoId, dataset, { focus, name: p.name, ask, ...(input.show_all ? { showAll: true } : {}) });
  // Linket åbner samme fokus og samme svar som i chatten.
  return { spec, dataset, ...(note ? { note } : {}), lassoId, link: personLink(config, lassoId, focus, ask?.question), ...(ask && !ask.generic ? { ask } : {}) };
}

/* --- render_view -------------------------------------------------------------------------- */

/**
 * Fri komposition (render_view): en spec uden version og kind. Navne ("Risika") slås op som i
 * show_company, så modellen ikke skal søge først (review P1-7).
 */
export async function renderView(ctx: UseCaseCtx, input: object): Promise<ViewData | UseCaseError> {
  const parsed = viewSpecSchema.safeParse({ ...input, version: 2, kind: "custom" });
  if (!parsed.success) return fail(400, `Specen er ugyldig: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}.`);
  const named = await lookupCompanyNames(parsed.data, ctx.provider);
  const spec = normalizeSpec(named.spec, ctx.config.LASSO_COMPANY_ID_PREFIX);
  for (const c of spec.components) {
    if (c.type === "LassoCompanyTable") {
      const invalid = criteriaError(c.search.criteria);
      if (invalid) return invalid;
    }
  }
  const invalid = criteriaError(spec.criteria);
  if (invalid) return invalid;
  const dataset = await resolveSpec(spec, ctx.provider, extrasOf(ctx));
  return { spec, dataset, ...(named.note ? { note: named.note } : {}) };
}

/* --- resolve_view / POST /api/portal/resolve ---------------------------------------------- */

/** Data til en visnings-spec (drill-down, fjern kriterie, opdatér) uden en model-tur. */
export async function resolveView(ctx: UseCaseCtx, rawSpec: unknown): Promise<{ spec: ViewSpec; dataset: Dataset } | UseCaseError> {
  const parsed = viewSpecSchema.safeParse(rawSpec);
  if (!parsed.success) return fail(400, "Ugyldig spec.");
  const spec = normalizeSpec(parsed.data, ctx.config.LASSO_COMPANY_ID_PREFIX);
  const dataset = await resolveSpec(spec, ctx.provider, extrasOf(ctx));
  return { spec, dataset };
}

/* --- save_view / POST /api/portal/views --------------------------------------------------- */

export interface SaveViewInput {
  /** Den viste spec, uændret; valideres her. */
  spec: unknown;
  name?: string;
  slug?: string;
  visibility?: Visibility;
}

export interface SavedViewResult {
  url: string;
  org: string;
  slug: string;
  version: number;
  name: string | null;
  visibility: Visibility;
}

/**
 * Gemmer specen (ikke data) under brugerens organisation og giver et delbart link til /v/.
 * Samme adresse igen giver en ny version. Optaget adresse (en anden ejers) giver 409.
 */
export async function saveView(ctx: UseCaseCtx, input: SaveViewInput): Promise<SavedViewResult | UseCaseError> {
  const { config, store, user } = ctx;
  const parsed = viewSpecSchema.safeParse(input.spec);
  if (!parsed.success) {
    return fail(400, `Specen er ugyldig: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}. Send structuredContent.spec fra forrige svar uændret.`);
  }
  const wanted = input.slug ? slugify(input.slug) : undefined;
  if (wanted !== undefined && !SLUG_PATTERN.test(wanted)) return fail(400, "Adressen må kun indeholde a-z, 0-9 og bindestreg (2-64 tegn).");
  try {
    const saved = await store.save({
      org: user.org,
      slug: wanted,
      name: input.name,
      spec: normalizeSpec(parsed.data, config.LASSO_COMPANY_ID_PREFIX),
      visibility: input.visibility,
      owner: user.id,
    });
    const url = `${config.publicBaseUrl}/v/${saved.org}/${saved.slug}`;
    return { url, org: saved.org, slug: saved.slug, version: saved.version, name: saved.name, visibility: saved.visibility };
  } catch (err) {
    if (err instanceof ViewConflictError) return fail(409, `${err.message}. Vælg en anden adresse.`);
    throw err;
  }
}
