import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  catalogAsText,
  companyTemplate,
  composeCompany,
  composeProbe,
  composePerson,
  composePersonProbe,
  isPersonId,
  FOCUSES,
  COMPANY_SECTIONS,
  COMPOSITION_RULES,
  cvrFromLassoId,
  DATASET_META_KEY,
  fieldsAsText,
  formatCriterion,
  listTemplate,
  METRICS,
  OPERATORS_TEXT,
  searchQuerySchema,
  TABLE_COLUMNS,
  toLassoId,
  validateCriteria,
  viewSpecSchema,
  mainMetric,
  type Dataset,
  type ViewComponent,
  type ViewSpec,
} from "@lasso/spec";
import type { CurrentUser } from "../auth/user.js";
import type { Config } from "../config.js";
import { findCompany, isCompanyRef, type CompanyPick } from "../data/lookup.js";
import type { DataProvider } from "../data/provider.js";
import { errorMessage, normalizeSpec, resolveSpec } from "../data/resolve.js";
import { textCard } from "../data/card.js";
import { summarizeView } from "../data/summary.js";
import { SLUG_PATTERN, slugify, ViewConflictError, VISIBILITIES, type ViewStore } from "../views/store.js";
import { companyLink, personLink } from "../web/links.js";
import { findPerson } from "../data/personLookup.js";
import { loadViewHtml, viewVersion } from "../web/page.js";

/** Adressen skifter med app-versionen, så værten aldrig viser en gemt, forældet render-app. */
export const VIEW_URI = `ui://lasso/view-${viewVersion()}.html`;

export interface McpContext {
  config: Config;
  provider: DataProvider;
  store: ViewStore;
  user: CurrentUser;
}

/**
 * Serverinstruktionerne står i hver samtale, så de holdes korte: routing og regler. Komponent-
 * kataloget og kompositionsreglerne står KUN i render_view's beskrivelse og søgefelterne KUN i
 * search_companies' (review P1-6: før stod begge dele to gange, ~9k tokens ekstra pr. tur).
 */
const INSTRUCTIONS = `Lasso giver adgang til data om danske virksomheder og personer (CVR): stamdata, regnskaber, nøgletal, ledelse, bestyrelse, ejere, revisor, risiko, historik og kontakt, samt søgning med kriterier (målgrupper).

Vælg værktøj:
- Én virksomhed: show_company med CVR-nummer, Lasso-ID eller navn (serveren slår navnet op; brug ikke search_companies først). Vælg focus efter spørgsmålet: 'overblik' (standard, "fortæl om X", snævre stamdataspørgsmål som revisor, stiftet, ansatte), 'oekonomi' (omsætning, resultat, nøgletal, "hvordan går det"), 'regnskab' (resultatopgørelse, balance, pengestrøm), 'ejerskab' (ejere, reelle ejere, koncern), 'ledelse' (direktion, bestyrelse, udskiftning), 'risiko' (røde flag, "kan vi handle med dem"), 'historik' (hvad er der sket, nyheder), 'kontakt' (telefon, e-mail, web, kontaktpersoner). Serveren vælger selv formen efter virksomhedens data.
- Én person ("hvem er X", "hvor sidder X i bestyrelser", "har X været i konkurser"): show_person med navn eller person-ID (CVR-3-…).
- Lister og målgrupper ("revisorer i Region Midt med mindst 10 ansatte"): search_companies med brugerens formulering som query.
- Flere navngivne virksomheder (sammenligning, rangering) eller elementer, ingen focus dækker: render_view med en spec fra kataloget i dens beskrivelse. Navne må bruges i stedet for CVR-numre.
- "Giv mig en URL", "del", "gem": save_view.

Regler:
- Én visning pr. svar: kald højst ét af show_company, show_person, search_companies og render_view pr. brugerbesked, og kun én gang. Aldrig show_company og render_view efter hinanden.
- Tegn altid med det samme. Spørg aldrig "vil du se det grafisk?".
- Kan din app vise den interaktive Lasso-visning: vis kun den, og skriv aldrig tekstkortet. Kan den ikke (fx Claude Code eller en terminal): vis tekstkortet fra værktøjssvaret uændret i en kodeblok med linket til den interaktive visning som klikbart link lige under, fx [Åbn LASSO X A/S i Lasso](url).
- Brugeren ser visningen. Svar kort (1–3 sætninger) med det vigtigste, og gentag ikke tallene som tabel. Skriv aldrig HTML/CSS.
- Nævner svaret andre match ved navneopslag, og er det uklart hvem brugeren mente, så spørg.
- Beløb angives i hele kroner (10 mio. = 10000000).`;

/**
 * Resuméet står både som tekst og i structuredContent: nogle værter (fx Claude Code)
 * giver kun modellen structuredContent, og så skal tallene at kommentere stå der.
 */
function viewResult(spec: ViewSpec, ds: Dataset, extra: { note?: string; link?: string } = {}): CallToolResult {
  const summary = [extra.note, summarizeView(spec, ds), extra.link && `Interaktiv Lasso-visning (link til brugeren): ${extra.link}`]
    .filter(Boolean)
    .join("\n");
  const card = textCard(spec, ds);
  return {
    content: [
      { type: "text", text: summary },
      ...(card ? [{ type: "text" as const, text: `Tekstkort:\n${card}` }] : []),
    ],
    structuredContent: { spec, source: ds.source, summary, ...(card ? { card } : {}), ...(extra.link ? { link: extra.link } : {}) },
    _meta: { [DATASET_META_KEY]: ds },
  };
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

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function toolError(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

function criteriaError(criteria: Parameters<typeof validateCriteria>[0]): CallToolResult | null {
  const issues = validateCriteria(criteria);
  if (issues.length === 0) return null;
  return toolError(`Ret kriterierne og prøv igen:\n${issues.map((i) => `- kriterie ${i.index + 1}: ${i.message}`).join("\n")}`);
}

export function createMcpServer(ctx: McpContext): McpServer {
  const { config, provider, store, user } = ctx;
  const prefix = config.LASSO_COMPANY_ID_PREFIX;

  const server = new McpServer(
    { name: "lasso", title: "Lasso", version: "0.1.0" },
    { instructions: INSTRUCTIONS },
  );

  const ui = { ui: { resourceUri: VIEW_URI } };
  const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

  registerAppTool(
    server,
    "search_companies",
    {
      title: "Søg virksomheder",
      description: `Søg i danske virksomheder (CVR) og vis resultatet som en Lasso-tabel med et udfyldt filterpanel, så brugeren kan se og rette filtrene. Brug til målgrupper, lister og "top N"-spørgsmål. Send brugerens formulering som query, fx "revisorer i Region Midtjylland med mindst 10 ansatte": Lasso fortolker den til filtre og søger i hele CVR. Et virksomhedsnavn i query søges som navn. Brug criteria til præciseringer og sort til "største"/"top N". Tegn altid med det samme.\n\nFelter:\n${fieldsAsText()}\n${OPERATORS_TEXT}`,
      inputSchema: searchQuerySchema.extend({
        title: z.string().max(120).optional().describe("Overskrift på listen, fx 'Revisionskunder, Region Midt'."),
        columns: z.array(z.enum(TABLE_COLUMNS)).min(1).max(8).optional().describe("Kolonner. Standard: navn, by, branche, ansatte, bruttofortjeneste, udvikling."),
      }),
      annotations: { title: "Søg virksomheder", ...readOnly },
      _meta: ui,
    },
    async ({ title, columns, ...search }): Promise<CallToolResult> => {
      const invalid = criteriaError(search.criteria);
      if (invalid) return invalid;
      // Lasso fortolker friteksten til filtre, som vises i filterpanelet. Et navn kan ikke fortolkes
      // og søges som navn. Kriterier, modellen selv har sat, vinder over Lassos for samme felt.
      let note: string | undefined;
      const text = search.query.trim();
      const interpreted = text && provider.interpret ? await provider.interpret(text) : null;
      if (interpreted) {
        const given = new Set(search.criteria.map((c) => c.field));
        search = { ...search, query: "", criteria: [...search.criteria, ...interpreted.criteria.filter((c) => !given.has(c.field))] };
        note = `Lasso fortolkede "${text}" som: ${interpreted.criteria.map(formatCriterion).join("; ")}.${interpreted.unknown.length ? ` Kunne ikke oversættes og indgår derfor IKKE i søgningen (nævn det for brugeren): ${interpreted.unknown.join("; ")}.` : ""}`;
      }
      const spec = listTemplate(search, { title: title ?? (interpreted ? capitalize(text) : undefined), columns });
      const ds = await resolveSpec(spec, provider);
      return viewResult(spec, ds, { note });
    },
  );

  registerAppTool(
    server,
    "show_company",
    {
      title: "Vis virksomhed",
      description:
        "Vis én dansk virksomhed som ét skærmbillede, der tilpasser sig virksomhedens data. Du angiver kun hensigten med focus; serveren henter data og vælger selv formen (fx graf ved mange regnskabsår, alle tal ved få, ejerdiagram ved en koncern, ingen nyhedssektion når der ingen nyheder er) og lægger det i kolonner som Lassos portal. Kald det kun én gang pr. svar, og kald ikke render_view bagefter. Brug til alle spørgsmål om én bestemt virksomhed. focus: 'overblik' (standard, 'fortæl om X'), 'oekonomi' (regnskab, omsætning, resultat, 'hvordan går det'), 'ejerskab' (ejere, reelle ejere, koncern), 'ledelse' (direktion, bestyrelse, udskiftning), 'risiko' (røde flag, kan vi handle med dem), 'historik' (hvad er der sket, nyheder), 'regnskab' (resultatopgørelse, balance, pengestrøm, alle linjer), 'kontakt' (telefon, e-mail, web, adresse, kontaktpersoner). Tager CVR-nummer, Lasso-ID eller navn; ved navn vælger serveren det bedste match og nævner alternativerne. Brug kun render_view, når brugeren beder om noget, focus ikke dækker (fx sammenligning af flere virksomheder).",
      inputSchema: z.object({
        company: z.string().min(1).describe("8-cifret CVR-nummer, Lasso-ID (fx CVR-1-12345678) eller virksomhedens navn."),
        focus: z.enum(FOCUSES).optional().describe("Hvad brugeren vil vide. Standard: overblik."),
        sections: z.array(z.enum(COMPANY_SECTIONS)).optional().describe("Forældet: fast skabelon. Brug focus i stedet."),
        chart_metric: z.enum(METRICS).optional().describe("Nøgletal i grafen, kun hvis brugeren nævner et bestemt. Standard: omsætning, hvis den er oplyst, ellers bruttofortjeneste."),
        years: z.number().int().min(2).max(10).optional().describe("Antal år i grafer og tabeller. Standard: 5, ved økonomi 10."),
      }),
      annotations: { title: "Vis virksomhed", ...readOnly },
      _meta: ui,
    },
    async ({ company, focus, sections, chart_metric, years }): Promise<CallToolResult> => {
      let lassoId = toLassoId(company, prefix);
      let note: string | undefined;
      if (!isCompanyRef(company)) {
        let found: CompanyPick | null;
        try {
          found = await findCompany(provider, company);
        } catch (err) {
          return toolError(`Kunne ikke slå "${company}" op: ${errorMessage(err)}.`);
        }
        if (!found) return toolError(`Fandt ingen virksomhed, der hedder "${company}". Prøv et andet navn eller CVR-nummeret.`);
        lassoId = found.pick.lassoId;
        const alt = found.alternatives.map((r) => `${r.name} (${r.cvr ?? r.lassoId})`).join("; ");
        note = `Fundet ud fra navnet "${company}": ${found.pick.name} (${found.pick.cvr ?? found.pick.lassoId}).${alt ? ` Andre match: ${alt}. Mente brugeren en af dem, så kald show_company igen med dens CVR-nummer.` : ""}`;
      }
      // Ét samlet hent: navnet tages fra datasættet (begge specs har LassoCompanyHead og henter
      // derfor virksomheden), så CVR-opslaget ikke laves to gange efter hinanden.
      const ds: Dataset = await resolveSpec(sections?.length ? companyTemplate(lassoId, { sections, chartMetric: chart_metric, years }) : composeProbe(lassoId, focus), provider);
      const name = ds.companies[lassoId]?.name;
      if (!name) {
        return toolError(`Kunne ikke hente ${company}: ${ds.errors[`company:${lassoId}`] ?? "ukendt fejl"}. Tjek CVR-nummeret eller navnet.`);
      }
      // Ældre kald med faste sektioner får skabelonen; ellers komponeres ud fra datas form.
      const spec: ViewSpec = sections?.length
        ? companyTemplate(lassoId, { sections, chartMetric: chart_metric, years, name })
        : composeCompany(lassoId, ds, { focus, years, chartMetric: chart_metric, name });
      const cvr = cvrFromLassoId(lassoId);
      // Linket åbner samme visning (focus) med samme hovednøgletal som i chatten (review P2-7).
      const link = cvr
        ? companyLink(config, { cvr, metric: chart_metric ?? mainMetric(ds.financials[lassoId]?.years ?? []), years: years ?? (focus === "oekonomi" ? 10 : 5), focus: sections?.length ? undefined : focus })
        : undefined;
      return viewResult(spec, ds, { note, link });
    },
  );

  registerAppTool(
    server,
    "show_person",
    {
      title: "Vis person",
      description:
        "Vis én person fra CVR som ét skærmbillede (katalog 16): personhoved med antal aktive og ophørte roller, roller i selskaber som tidsbånd fra–til, netværk (hvem personen sidder sammen med i selskaber) og risiko (konkurser og tvangsopløsninger blandt personens selskaber). Serveren henter data og vælger selv formen. Tager navn eller personens Lasso-ID (CVR-3-…); ved navn vælger serveren det bedste match og nævner alternativerne. Personer har ikke CVR-nummer; brug show_company til virksomheder. Kald det kun én gang pr. svar.",
      inputSchema: z.object({
        person: z.string().min(1).describe("Personens navn (fx 'Mette Holm') eller Lasso-ID (fx 'CVR-3-4000000001')."),
      }),
      annotations: { title: "Vis person", ...readOnly },
      _meta: ui,
    },
    async ({ person }): Promise<CallToolResult> => {
      const ref = person.trim();
      let lassoId = ref;
      let note: string | undefined;
      if (!isPersonId(ref)) {
        if (isCompanyRef(ref)) return toolError(`"${ref}" er et CVR-nummer eller virksomheds-ID. Brug show_company til virksomheder.`);
        let found;
        try {
          found = await findPerson(provider, ref);
        } catch (err) {
          return toolError(`Kunne ikke slå "${ref}" op: ${errorMessage(err)}.`);
        }
        if (!found) return toolError(`Fandt ingen person, der hedder "${ref}". Prøv med fulde navn.`);
        lassoId = found.pick.lassoId;
        const alt = found.alternatives.map((r) => `${r.name}${r.city ? `, ${r.city}` : ""} (${r.lassoId})`).join("; ");
        note = `Fundet ud fra navnet "${ref}": ${found.pick.name}${found.pick.city ? `, ${found.pick.city}` : ""} (${found.pick.lassoId}).${alt ? ` Andre match: ${alt}. Mente brugeren en af dem, så kald show_person igen med dens ID.` : ""}`;
      }
      const ds = await resolveSpec(composePersonProbe(lassoId), provider);
      const p = ds.persons[lassoId];
      if (!p) return toolError(`Kunne ikke hente personen ${lassoId}: ${ds.errors[`person:${lassoId}`] ?? "ukendt fejl"}.`);
      const spec = composePerson(lassoId, ds, { name: p.name });
      return viewResult(spec, ds, { note, link: personLink(config, lassoId) });
    },
  );

  registerAppTool(
    server,
    "render_view",
    {
      title: "Vis oversigt",
      description: `Fri komposition til sammenligninger, oversigter og analyser, der ikke passer i show_company eller search_companies. Send en JSON-spec; Lassos kode henter data og tegner i Lassos design. Virksomheder angives med CVR-nummer, Lasso-ID eller navn (navne slås op, og valget står i svaret). Skriv aldrig HTML/CSS. Brug 1–12 komponenter i ét dashboard. Kald render_view én gang pr. svar.\n\n${COMPOSITION_RULES}\n\nKomponentkatalog (hver linje: Brug til / Brug ikke når / Kræver / Eksempel):\n${catalogAsText()}\n\nEksempel (ét dashboard): {"title":"Byg vs. Transport","components":[{"type":"LassoCompareTable","companies":["12345678","87654321"]},{"type":"LassoLineChart","company":"12345678","metric":"omsaetning","years":5,"benchmark":"87654321"}]}`,
      inputSchema: viewSpecSchema.omit({ version: true, kind: true }),
      annotations: { title: "Vis oversigt", ...readOnly },
      _meta: ui,
    },
    async (input): Promise<CallToolResult> => {
      // Navne ("Risika") slås op som i show_company, så modellen ikke skal søge først (review P1-7).
      const named = await lookupCompanyNames(viewSpecSchema.parse({ ...input, kind: "custom" }), provider);
      const spec = normalizeSpec(named.spec, prefix);
      for (const c of spec.components) {
        if (c.type === "LassoCompanyTable") {
          const invalid = criteriaError(c.search.criteria);
          if (invalid) return invalid;
        }
      }
      const invalid = criteriaError(spec.criteria);
      if (invalid) return invalid;
      const ds = await resolveSpec(spec, provider);
      return viewResult(spec, ds, { note: named.note });
    },
  );

  registerAppTool(
    server,
    "save_view",
    {
      title: "Gem visning",
      description:
        "Gem en visning og få et link, der kan deles. Specen gemmes, ikke data, så linket altid viser friske tal. Gemmer man igen på samme adresse, opdateres den, og tidligere versioner bevares. Brug når brugeren beder om en URL, et link, at dele eller gemme. Send den spec, der blev vist (structuredContent.spec fra forrige tool-resultat).",
      inputSchema: z.object({
        // Løst skema i beskrivelsen (hele viewSpec-skemaet er ~30.000 tegn); specen valideres nedenfor.
        spec: z.record(z.string(), z.unknown()).describe("structuredContent.spec fra det værktøjssvar, der viste visningen, uændret."),
        name: z.string().min(1).max(120).optional().describe("Pænt navn, fx 'Revisionskunder Midt'."),
        slug: z
          .string()
          .max(64)
          .optional()
          .describe("Ønsket adresse, fx 'revisionskunder-midt'. Udelad for en tilfældig adresse."),
        visibility: z.enum(VISIBILITIES).optional().describe("private = kun mig, org = min organisation, link = alle med linket. Standard: org."),
      }),
      annotations: { title: "Gem visning", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { ui: { visibility: ["model", "app"] } },
    },
    async ({ spec: rawSpec, name, slug, visibility }): Promise<CallToolResult> => {
      const parsed = viewSpecSchema.safeParse(rawSpec);
      if (!parsed.success) return toolError(`Specen er ugyldig: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}. Send structuredContent.spec fra forrige svar uændret.`);
      const spec = parsed.data;
      const wanted = slug ? slugify(slug) : undefined;
      if (wanted !== undefined && !SLUG_PATTERN.test(wanted)) {
        return toolError("Adressen må kun indeholde a-z, 0-9 og bindestreg (2-64 tegn).");
      }
      try {
        const saved = await store.save({
          org: user.org,
          slug: wanted,
          name,
          spec: normalizeSpec(spec, prefix),
          visibility,
          owner: user.id,
        });
        const url = `${config.publicBaseUrl}/v/${saved.org}/${saved.slug}`;
        return {
          content: [{ type: "text", text: `Gemt som version ${saved.version}: ${url}` }],
          structuredContent: { url, org: saved.org, slug: saved.slug, version: saved.version, name: saved.name, visibility: saved.visibility },
        };
      } catch (err) {
        if (err instanceof ViewConflictError) return toolError(`${err.message}. Vælg en anden adresse.`);
        throw err;
      }
    },
  );

  // Kun for appen: henter data til en spec (drill-down, fjern kriterie, opdatér) uden en model-tur.
  registerAppTool(
    server,
    "resolve_view",
    {
      title: "Hent data til visning",
      description: "Intern: henter data til en visnings-spec. Kaldes af Lasso-appen, ikke af modellen.",
      inputSchema: z.object({ spec: z.record(z.string(), z.unknown()) }),
      annotations: { title: "Hent data til visning", ...readOnly },
      _meta: { ui: { resourceUri: VIEW_URI, visibility: ["app"] } },
    },
    async ({ spec: rawSpec }): Promise<CallToolResult> => {
      const parsed = viewSpecSchema.safeParse(rawSpec);
      if (!parsed.success) return toolError("Ugyldig spec.");
      const normalized = normalizeSpec(parsed.data, prefix);
      const ds = await resolveSpec(normalized, provider);
      return {
        content: [{ type: "text", text: "ok" }],
        structuredContent: { spec: normalized, dataset: ds },
      };
    },
  );

  registerAppResource(
    server,
    "Lasso-visning",
    VIEW_URI,
    { mimeType: RESOURCE_MIME_TYPE, description: "Lassos render-app: tegner visnings-specs i Lassos design." },
    async () => ({
      contents: [
        {
          uri: VIEW_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: await loadViewHtml(),
          _meta: { ui: { prefersBorder: false } },
        },
      ],
    }),
  );

  return server;
}
