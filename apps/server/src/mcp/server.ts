import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  catalogAsText,
  companyTemplate,
  COMPANY_SECTIONS,
  DATASET_META_KEY,
  fieldsAsText,
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
import { summarizeView } from "../data/summary.js";
import { SLUG_PATTERN, slugify, ViewConflictError, VISIBILITIES, type ViewStore } from "../views/store.js";
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
- Økonomi og regnskab ("hvordan går det økonomisk for Novo?"): show_company med sections ["header","noegletal","graf"], chart_metric "omsaetning" og years 10. Kommentér udviklingen i 2–3 sætninger; tallene står i visningen.
- Lister og målgrupper ("alle revisorer i Region Midt over 10 mio."): search_companies med kriterier.
- Sammenligninger og oversigter, der ikke passer i de to: render_view med en spec fra komponentkataloget.
- "Giv mig en URL", "del", "gem": save_view.

Regler:
- Tegn altid grafisk med det samme. Spørg aldrig "vil du se det grafisk?".
- Skriv aldrig HTML/CSS. Du sender en spec; Lassos kode henter data og tegner.
- Brugeren ser visningen. Svar kort i tekst og gentag ikke tallene som tabel.
- Beløb angives i hele kroner (10 mio. = 10000000).

Komponentkatalog:
${catalogAsText()}

Søgefelter:
${fieldsAsText()}
${OPERATORS_TEXT}`;

/**
 * Resuméet står både som tekst og i structuredContent: nogle værter (fx Claude Code)
 * giver kun modellen structuredContent, og så skal tallene at kommentere stå der.
 */
function viewResult(spec: ViewSpec, ds: Dataset, note?: string): CallToolResult {
  const summary = [note, summarizeView(spec, ds)].filter(Boolean).join("\n");
  return {
    content: [{ type: "text", text: summary }],
    structuredContent: { spec, source: ds.source, summary },
    _meta: { [DATASET_META_KEY]: ds },
  };
}

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
      description: `Søg i danske virksomheder (CVR) med fritekst og kriterier, og vis resultatet som en Lasso-tabel med et udfyldt filterpanel, så brugeren kan se og rette, hvad du forstod. Brug til målgrupper, lister og "top N"-spørgsmål, fx "revisorer i Region Midt med over 10 ansatte" eller "top 20 byggefirmaer efter omsætning". Tegn altid med det samme.\n\nFelter:\n${fieldsAsText()}\n${OPERATORS_TEXT}`,
      inputSchema: searchQuerySchema.extend({
        title: z.string().max(120).optional().describe("Overskrift på listen, fx 'Revisionskunder · Region Midt'."),
        columns: z.array(z.enum(TABLE_COLUMNS)).min(1).max(8).optional().describe("Kolonner. Standard: navn, by, branche, ansatte, bruttofortjeneste, udvikling."),
      }),
      annotations: { title: "Søg virksomheder", ...readOnly },
      _meta: ui,
    },
    async ({ title, columns, ...search }): Promise<CallToolResult> => {
      const invalid = criteriaError(search.criteria);
      if (invalid) return invalid;
      const spec = listTemplate(search, { title, columns });
      const ds = await resolveSpec(spec, provider);
      return viewResult(spec, ds);
    },
  );

  registerAppTool(
    server,
    "show_company",
    {
      title: "Vis virksomhed",
      description:
        "Vis én dansk virksomhed som Lassos faste virksomhedskort: header → nøgletal → regnskabsgraf → ledelse → ejerskab/revisor → opfølgningsknapper. Brug når brugeren spørger til en bestemt virksomhed, dens regnskab, økonomi, ledelse, bestyrelse, direktør, ejere eller revisor. Tager CVR-nummer, Lasso-ID eller navn (fx \"Novo Nordisk\"); ved navn vælger serveren det bedste match og nævner alternativerne. Spørgsmål om økonomi: sections [header, noegletal, graf], chart_metric omsaetning, years 10. Spørgsmål om ledelse: sections [header, ledelse].",
      inputSchema: z.object({
        company: z.string().min(1).describe("8-cifret CVR-nummer, Lasso-ID (fx CVR-1-12345678) eller virksomhedens navn."),
        sections: z.array(z.enum(COMPANY_SECTIONS)).optional().describe("Vis kun disse sektioner. Header er altid med. Standard: alle."),
        chart_metric: z.enum(METRICS).optional().describe("Nøgletal i grafen. Standard: bruttofortjeneste."),
        years: z.number().int().min(2).max(10).optional().describe("Antal år i grafen. Standard: 5."),
      }),
      annotations: { title: "Vis virksomhed", ...readOnly },
      _meta: ui,
    },
    async ({ company, sections, chart_metric, years }): Promise<CallToolResult> => {
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
      const spec = companyTemplate(lassoId, { sections, chartMetric: chart_metric, years, name });
      const ds = await resolveSpec(spec, provider);
      return viewResult(spec, ds, note);
    },
  );

  registerAppTool(
    server,
    "render_view",
    {
      title: "Vis oversigt",
      description: `Fri komposition til sammenligninger, oversigter og analyser, der ikke passer i show_company eller search_companies. Send en JSON-spec; Lassos kode henter data og tegner i Lassos design. Skriv aldrig HTML/CSS. Brug 2–6 komponenter.\n\nKomponentkatalog:\n${catalogAsText()}\n\nEksempel: {"title":"Byg vs. Transport","layout":"grid-2","components":[{"type":"LassoComparison","companies":["12345678","87654321"]},{"type":"LassoFinancialChart","company":"12345678","metric":"omsaetning","years":5}]}`,
      inputSchema: viewSpecSchema.omit({ version: true, kind: true }),
      annotations: { title: "Vis oversigt", ...readOnly },
      _meta: ui,
    },
    async (input): Promise<CallToolResult> => {
      const spec = normalizeSpec(viewSpecSchema.parse({ ...input, kind: "custom" }), prefix);
      for (const c of spec.components) {
        if (c.type === "LassoTable") {
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
