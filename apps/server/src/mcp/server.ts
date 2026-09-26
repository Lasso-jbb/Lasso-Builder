import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  catalogAsText,
  companyTemplate,
  composeCompany,
  composeProbe,
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
  type Dataset,
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
import { companyLink } from "../web/links.js";
import { loadViewHtml } from "../web/page.js";

export const VIEW_URI = "ui://lasso/view.html";

export interface McpContext {
  config: Config;
  provider: DataProvider;
  store: ViewStore;
  user: CurrentUser;
}

const INSTRUCTIONS = `Lasso giver adgang til data om danske virksomheder (CVR): stamdata, regnskaber, nøgletal, ledelse, bestyrelse, ejere og revisor, samt søgning med kriterier (målgrupper).

Sådan bruges værktøjerne:
- Én bestemt virksomhed: show_company med CVR-nummer, Lasso-ID eller navn. Et navn slår serveren selv op; brug ikke search_companies først.
- Økonomi og regnskab ("hvordan går det økonomisk for Novo?"): show_company med focus "oekonomi". Ejere: focus "ejerskab". Ledelse: focus "ledelse". Risiko: focus "risiko". Historik og nyheder: focus "historik". Serveren tilpasser selv skærmbilledet til virksomhedens data. Kommentér kort i 2–3 sætninger; tallene står i visningen.
- Lister og målgrupper ("alle revisorer i Region Midt med mindst 10 ansatte"): search_companies med brugerens formulering som query. Lasso fortolker den til filtre i hele CVR og viser dem i filterpanelet. Tilføj kun criteria for det, teksten ikke siger, og sort for "top N"/"største".
- Sammenligninger og oversigter, der ikke passer i de to: render_view med en spec fra komponentkataloget.
- "Giv mig en URL", "del", "gem": save_view.

Regler:
- Én visning pr. svar: kald højst ét visningsværktøj (show_company, search_companies eller render_view) pr. brugerbesked. Kræver spørgsmålet mere end show_company viser, så brug render_view med alle komponenter i én spec — ikke show_company og render_view efter hinanden.
- Tegn altid grafisk med det samme. Spørg aldrig "vil du se det grafisk?".
- Kan din app vise den interaktive Lasso-visning: vis kun den, og skriv aldrig tekstkortet i et svar. Kan appen ikke tegne den (fx Claude Code eller en terminal), så vis tekstkortet fra værktøjssvaret uændret i en kodeblok, og skriv lige under kodeblokken linket til den interaktive Lasso-visning som et klikbart link, fx [Åbn LASSO X A/S i Lasso](url). Kommentér derefter kort i 1–3 sætninger.
- Skriv aldrig HTML/CSS. Du sender en spec; Lassos kode henter data og tegner.
- Brugeren ser visningen. Svar kort i tekst og gentag ikke tallene som tabel.
- Beløb angives i hele kroner (10 mio. = 10000000).

${COMPOSITION_RULES}

Komponentkatalog (hver linje: Brug til / Brug ikke når / Kræver / Eksempel):
${catalogAsText()}

Søgefelter:
${fieldsAsText()}
${OPERATORS_TEXT}`;

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
        note = `Lasso fortolkede "${text}" som: ${interpreted.criteria.map(formatCriterion).join("; ")}.${interpreted.unknown.length ? ` Ikke vist i filterpanelet: ${interpreted.unknown.join("; ")}.` : ""}`;
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
        "Vis én dansk virksomhed som ét skærmbillede, der tilpasser sig virksomhedens data. Du angiver kun hensigten med focus; serveren henter data og vælger selv formen (fx graf ved mange regnskabsår, alle tal ved få, ejerdiagram ved en koncern, ingen nyhedssektion når der ingen nyheder er) og lægger det i kolonner som Lassos portal. Kald det kun én gang pr. svar, og kald ikke render_view bagefter. Brug til alle spørgsmål om én bestemt virksomhed. focus: 'overblik' (standard, 'fortæl om X'), 'oekonomi' (regnskab, omsætning, resultat, 'hvordan går det'), 'ejerskab' (ejere, reelle ejere, koncern), 'ledelse' (direktion, bestyrelse, udskiftning), 'risiko' (røde flag, kan vi handle med dem), 'historik' (hvad er der sket, nyheder). Tager CVR-nummer, Lasso-ID eller navn; ved navn vælger serveren det bedste match og nævner alternativerne. Brug kun render_view, når brugeren beder om noget, focus ikke dækker (fx sammenligning af flere virksomheder).",
      inputSchema: z.object({
        company: z.string().min(1).describe("8-cifret CVR-nummer, Lasso-ID (fx CVR-1-12345678) eller virksomhedens navn."),
        focus: z.enum(FOCUSES).optional().describe("Hvad brugeren vil vide. Standard: overblik."),
        sections: z.array(z.enum(COMPANY_SECTIONS)).optional().describe("Forældet: fast skabelon. Brug focus i stedet."),
        chart_metric: z.enum(METRICS).optional().describe("Nøgletal i grafen. Standard: bruttofortjeneste."),
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
      let name: string | undefined;
      try {
        name = (await provider.company(lassoId)).name;
      } catch (err) {
        return toolError(`Kunne ikke hente ${company}: ${errorMessage(err)}. Tjek CVR-nummeret eller navnet.`);
      }
      let spec: ViewSpec;
      let ds: Dataset;
      if (sections?.length) {
        // Ældre kald med faste sektioner.
        spec = companyTemplate(lassoId, { sections, chartMetric: chart_metric, years, name });
        ds = await resolveSpec(spec, provider);
      } else {
        // Hent først de data, hensigten kan bruge; komponér derefter ud fra datas form.
        ds = await resolveSpec(composeProbe(lassoId, focus), provider);
        spec = composeCompany(lassoId, ds, { focus, years, chartMetric: chart_metric, name });
      }
      const cvr = cvrFromLassoId(lassoId);
      const link = cvr ? companyLink(config, { cvr, metric: chart_metric ?? "bruttofortjeneste", years: years ?? 5 }) : undefined;
      return viewResult(spec, ds, { note, link });
    },
  );

  registerAppTool(
    server,
    "render_view",
    {
      title: "Vis oversigt",
      description: `Fri komposition til sammenligninger, oversigter og analyser, der ikke passer i show_company eller search_companies. Send en JSON-spec; Lassos kode henter data og tegner i Lassos design. Skriv aldrig HTML/CSS. Brug 2–8 komponenter i ét dashboard. Kald render_view én gang pr. svar.\n\n${COMPOSITION_RULES}\n\nKomponentkatalog (hver linje: Brug til / Brug ikke når / Kræver / Eksempel):\n${catalogAsText()}\n\nEksempel (ét dashboard): {"title":"Byg vs. Transport","components":[{"type":"LassoCompareTable","companies":["12345678","87654321"]},{"type":"LassoLineChart","company":"12345678","metric":"omsaetning","years":5,"benchmark":"87654321"},{"type":"LassoRanking","companies":["12345678","87654321"],"metric":"omsaetning"}]}`,
      inputSchema: viewSpecSchema.omit({ version: true, kind: true }),
      annotations: { title: "Vis oversigt", ...readOnly },
      _meta: ui,
    },
    async (input): Promise<CallToolResult> => {
      const spec = normalizeSpec(viewSpecSchema.parse({ ...input, kind: "custom" }), prefix);
      for (const c of spec.components) {
        if (c.type === "LassoCompanyTable") {
          const invalid = criteriaError(c.search.criteria);
          if (invalid) return invalid;
        }
      }
      const invalid = criteriaError(spec.criteria);
      if (invalid) return invalid;
      const ds = await resolveSpec(spec, provider);
      return viewResult(spec, ds);
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
        spec: viewSpecSchema,
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
    async ({ spec, name, slug, visibility }): Promise<CallToolResult> => {
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
      inputSchema: z.object({ spec: viewSpecSchema }),
      annotations: { title: "Hent data til visning", ...readOnly },
      _meta: { ui: { resourceUri: VIEW_URI, visibility: ["app"] } },
    },
    async ({ spec }): Promise<CallToolResult> => {
      const normalized = normalizeSpec(spec, prefix);
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
