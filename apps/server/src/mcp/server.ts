import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  catalogAsText,
  FOCUSES,
  COMPANY_SECTIONS,
  COMPOSITION_RULES,
  LAYOUT_RULES,
  DATASET_META_KEY,
  fieldsAsText,
  METRICS,
  OPERATORS_TEXT,
  PAGE_FOCUSES,
  PERSON_FOCUSES,
  searchQuerySchema,
  TABLE_COLUMNS,
  viewSpecSchema,
  type Ask,
  type Dataset,
  type ViewSpec,
} from "@lasso/spec";
import { textCard } from "../data/card.js";
import { summarizeView } from "../data/summary.js";
import { VISIBILITIES } from "../views/store.js";
import { loadViewHtml, viewVersion } from "../web/page.js";
import {
  listSavedPages,
  removeSavedPage,
  renderView,
  resolveView,
  savePage,
  saveView,
  searchCompanies,
  showCompany,
  showPerson,
  type UseCaseCtx,
} from "../usecases/index.js";

/** Navneopslaget i render_view bor nu i use-casene; eksporteres fortsat herfra. */
export { lookupCompanyNames } from "../usecases/index.js";

/** Adressen skifter med app-versionen, så værten aldrig viser en gemt, forældet render-app. */
export const VIEW_URI = `ui://lasso/view-${viewVersion()}.html`;

/**
 * Serverens kontekst pr. MCP-request: samme som use-casenes (usecases/), som tool-handlerne kalder.
 * Handlerne validerer input (zod-skemaerne nedenfor) og pakker use-casens svar i CallToolResult.
 */
export type McpContext = UseCaseCtx;

/**
 * Serverinstruktionerne står i hver samtale, så de holdes korte: routing og regler. Komponent-
 * kataloget og kompositionsreglerne står KUN i render_view's beskrivelse og søgefelterne KUN i
 * search_companies' (review P1-6: før stod begge dele to gange, ~9k tokens ekstra pr. tur).
 */
const INSTRUCTIONS = `Lasso giver adgang til data om danske virksomheder og personer (CVR): stamdata, regnskaber, nøgletal, ledelse, bestyrelse, ejere, revisor, risiko, historik og kontakt, samt søgning med kriterier (målgrupper).

Vælg værktøj:
- Én virksomhed: show_company med CVR-nummer, Lasso-ID eller navn (serveren slår navnet op; brug ikke search_companies først). Serveren bygger siden omkring svaret på spørgsmålet: svar-elementet først med de nævnte nøgletal, roller og år, og kontekst rundt om. Sæt kun focus, når spørgsmålet er generelt: 'overblik' (standard, "fortæl om X"), 'oekonomi' ("hvordan går det"), 'regnskab', 'ejerskab', 'ledelse', 'risiko', 'historik', 'kontakt'.
- Én person: show_person med navn eller person-ID (CVR-3-…). Vælg focus kun ved et generelt spørgsmål: 'overblik' (standard, "hvem er X"), 'roller' (roller over tid), 'netvaerk' (hvem sidder X sammen med), 'ejerskab' (hvilke selskaber ejer X), 'risiko' (konkurser og tvangsopløsninger), 'historik' (hvad er der sket, nyheder om X).
- Send altid brugerens spørgsmål ordret i question.
- Lister og målgrupper ("revisorer i Region Midt med mindst 10 ansatte"): search_companies med brugerens formulering som query.
- Flere navngivne virksomheder (sammenligning, rangering) eller elementer, ingen focus dækker: render_view med en spec fra kataloget i dens beskrivelse. Navne må bruges i stedet for CVR-numre.
- "Gem virksomheden/personen", "husk", "bogmærk", "sæt på min liste": save_page. "Mine gemte", "hvad har jeg gemt", "min liste": list_saved_pages. "Fjern fra listen": remove_saved_page. save_view er kun til et delbart link til en visning.
- "Giv mig en URL", "del": save_view.

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
function viewResult(spec: ViewSpec, ds: Dataset, extra: { note?: string; link?: string; ask?: Ask } = {}): CallToolResult {
  // Med et spørgsmål svarer resuméet og tekstkortet på det først ("Svar: …").
  const summary = [extra.note, summarizeView(spec, ds, { ask: extra.ask }), extra.link && `Interaktiv Lasso-visning (link til brugeren): ${extra.link}`]
    .filter(Boolean)
    .join("\n");
  const card = textCard(spec, ds, { ask: extra.ask });
  return {
    content: [
      { type: "text", text: summary },
      ...(card ? [{ type: "text" as const, text: `Tekstkort:\n${card}` }] : []),
    ],
    structuredContent: { spec, source: ds.source, summary, ...(card ? { card } : {}), ...(extra.link ? { link: extra.link } : {}) },
    _meta: { [DATASET_META_KEY]: ds },
  };
}

function toolError(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

export function createMcpServer(ctx: McpContext): McpServer {
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
    async (input): Promise<CallToolResult> => {
      const r = await searchCompanies(ctx, input);
      if ("error" in r) return toolError(r.error);
      return viewResult(r.spec, r.dataset, { note: r.note });
    },
  );

  registerAppTool(
    server,
    "show_company",
    {
      title: "Vis virksomhed",
      description:
        "Vis én dansk virksomhed som ét skærmbillede, der tilpasser sig spørgsmålet og virksomhedens data. Send brugerens spørgsmål ordret i question: serveren afleder, hvad der spørges om, og bygger en hel side i Lassos portal-layout, hvor svar-elementet står først med data afgrænset til spørgsmålet (fx soliditetsgraden først på kortene og som linjegraf, kun direktionen i personlisten, regnskabet for det nævnte år, kun ledelsesændringerne i historikken), og resten af siden er kontekst fra hele komponentkataloget. Samme spørgsmål giver altid samme side. Kald det kun én gang pr. svar, og kald ikke render_view bagefter. Brug til alle spørgsmål om én bestemt virksomhed. focus bruges kun ved et generelt spørgsmål ('fortæl om X', 'hvordan går det'): 'overblik' (standard), 'oekonomi', 'ejerskab', 'ledelse', 'risiko' (kreditvurdering fra Creditsafe), 'historik', 'regnskab', 'kontakt'. Tager CVR-nummer, Lasso-ID eller navn; ved navn vælger serveren det bedste match og nævner alternativerne. Brug kun render_view, når brugeren beder om noget, show_company ikke dækker (fx sammenligning af flere virksomheder).",
      inputSchema: z.object({
        company: z.string().min(1).describe("8-cifret CVR-nummer, Lasso-ID (fx CVR-1-12345678) eller virksomhedens navn."),
        question: z.string().max(300).optional().describe("Brugerens spørgsmål ordret. Serveren vælger niveau, elementer og data (nøgletal, roller, år) efter spørgsmålet."),
        metrics: z.array(z.enum(METRICS)).max(5).optional().describe("Valgfrit: de nøgletal, spørgsmålet handler om, hvis de ikke står med deres navn (fx 'egenkapitalandel' = soliditetsgrad)."),
        focus: z.enum(FOCUSES).optional().describe("Sæt kun focus, når spørgsmålet er generelt; ellers bestemmer spørgsmålet. Standard: overblik."),
        sections: z.array(z.enum(COMPANY_SECTIONS)).optional().describe("Forældet: fast skabelon. Brug focus i stedet."),
        chart_metric: z.enum(METRICS).optional().describe("Nøgletal i grafen, kun hvis brugeren nævner et bestemt. Standard: omsætning, hvis den er oplyst, ellers bruttofortjeneste."),
        years: z.number().int().min(2).max(10).optional().describe("Antal år i grafer og tabeller. Standard: 5, ved økonomi 10."),
      }),
      annotations: { title: "Vis virksomhed", ...readOnly },
      _meta: ui,
    },
    async (input): Promise<CallToolResult> => {
      const r = await showCompany(ctx, input);
      if ("error" in r) return toolError(r.error);
      return viewResult(r.spec, r.dataset, { note: r.note, link: r.link, ask: r.ask });
    },
  );

  registerAppTool(
    server,
    "show_person",
    {
      title: "Vis person",
      description:
        "Vis én person fra CVR som ét skærmbillede (katalog 16), der tilpasser sig spørgsmålet og personens data. Send brugerens spørgsmål ordret i question: serveren bygger siden omkring svaret (fx kun bestyrelsesposterne ved 'sidder X i bestyrelser', konkurserne ved 'har X været i konkurser') med kontekst rundt om. Uden spørgsmål, eller ved et generelt spørgsmål, angiver focus hensigten; serveren henter kun det, siden viser, og vælger selv formen (tomme sektioner udelades). Personhovedet (by, antal aktive og ophørte roller, ejerskaber, konkurser blandt selskaberne) står på alle fokus. focus: 'overblik' (standard, 'hvem er X': de aktive roller som liste, stamoplysninger, netværk (top 3), risiko, seneste historik og de ejede selskaber), 'roller' ('hvor sidder X i bestyrelser', 'hvilke selskaber er X direktør i': alle roller som tidsbånd fra–til og stamoplysninger), 'netvaerk' ('hvem sidder X sammen med': hele netværket; år sammen = længste sammenhængende periode), 'ejerskab' ('hvilke selskaber ejer X': ejede selskaber med ejerandel og siden-dato og ejerdiagram med personen øverst), 'risiko' ('har X været i konkurser': alle konkurser og tvangsopløsninger blandt personens selskaber og forløbet i de selskaber), 'historik' ('hvad er der sket', nyheder: rolleskift og selskabernes konkurser, nyheder om personen fra Lasso News). Tager navn eller personens Lasso-ID (CVR-3-…); ved navn vælger serveren det bedste match og nævner alternativerne. Personer har ikke CVR-nummer; brug show_company til virksomheder. Kald det kun én gang pr. svar.",
      inputSchema: z.object({
        person: z.string().min(1).describe("Personens navn (fx 'Mette Holm') eller Lasso-ID (fx 'CVR-3-4000000001')."),
        question: z.string().max(300).optional().describe("Brugerens spørgsmål ordret. Serveren vælger elementer og data (roller, konkurser, netværk) efter spørgsmålet."),
        focus: z.enum(PERSON_FOCUSES).optional().describe("Sæt kun focus, når spørgsmålet er generelt; ellers bestemmer spørgsmålet. Standard: overblik."),
      }),
      annotations: { title: "Vis person", ...readOnly },
      _meta: ui,
    },
    async (input): Promise<CallToolResult> => {
      const r = await showPerson(ctx, input);
      if ("error" in r) return toolError(r.error);
      return viewResult(r.spec, r.dataset, { note: r.note, link: r.link, ask: r.ask });
    },
  );

  registerAppTool(
    server,
    "render_view",
    {
      title: "Vis oversigt",
      description: `Fri komposition til sammenligninger, oversigter og analyser, der ikke passer i show_company eller search_companies. Send en JSON-spec; Lassos kode henter data og tegner i Lassos design. Virksomheder angives med CVR-nummer, Lasso-ID eller navn (navne slås op, og valget står i svaret). Skriv aldrig HTML/CSS. Brug 1–12 komponenter i ét dashboard. Kald render_view én gang pr. svar.\n\n${COMPOSITION_RULES}

${LAYOUT_RULES}\n\nKomponentkatalog (hver linje: Brug til / Brug ikke når / Kræver / Eksempel):\n${catalogAsText()}\n\nEksempel (ét dashboard): {"title":"Byg vs. Transport","components":[{"type":"LassoCompareTable","companies":["12345678","87654321"]},{"type":"LassoLineChart","company":"12345678","metric":"omsaetning","years":5,"benchmark":"87654321"}]}`,
      inputSchema: viewSpecSchema.omit({ version: true, kind: true }),
      annotations: { title: "Vis oversigt", ...readOnly },
      _meta: ui,
    },
    async (input): Promise<CallToolResult> => {
      // Navne ("Risika") slås op som i show_company, så modellen ikke skal søge først (review P1-7).
      const r = await renderView(ctx, input);
      if ("error" in r) return toolError(r.error);
      return viewResult(r.spec, r.dataset, { note: r.note });
    },
  );

  registerAppTool(
    server,
    "save_view",
    {
      title: "Gem visning",
      description:
        "Gem en visning og få et link, der kan deles. Specen gemmes, ikke data, så linket altid viser friske tal. Gemmer man igen på samme adresse, opdateres den, og tidligere versioner bevares. Brug når brugeren beder om en URL, et link eller at dele visningen; vil brugeren gemme en virksomhed eller person på sin liste, er det save_page. Send den spec, der blev vist (structuredContent.spec fra forrige tool-resultat).",
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
    async (input): Promise<CallToolResult> => {
      const r = await saveView(ctx, input);
      if ("error" in r) return toolError(r.error);
      return {
        content: [{ type: "text", text: `Gemt som version ${r.version}: ${r.url}` }],
        structuredContent: { ...r },
      };
    },
  );

  // --- Gem-laget (docs/gem-lag.md): brugerens personlige liste af gemte virksomheder og personer ---
  const writeAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  const modelAndApp = { ui: { visibility: ["model", "app"] } };

  registerAppTool(
    server,
    "save_page",
    {
      title: "Gem side",
      description:
        "Gem én virksomhed eller person på brugerens egen liste over gemte sider (bogmærke), så den kan findes igen med list_saved_pages og åbnes med friske data. Brug når brugeren siger 'gem virksomheden/personen', 'husk', 'bogmærk' eller 'sæt på min liste'. Tager CVR-nummer, Lasso-ID (CVR-1-… / CVR-3-…) eller navn; ved navn slås virksomheden op (kind 'person' slår en person op). Gemmes siden igen, flyttes den øverst. Brug save_view i stedet, når brugeren vil have et delbart link til en visning.",
      inputSchema: z.object({
        page: z.string().min(1).describe("Lasso-ID (CVR-1-… eller CVR-3-…), 8-cifret CVR-nummer eller navn."),
        kind: z.enum(["company", "person"]).optional().describe("Kun ved navn: 'person' slår en person op. Standard: virksomhed. Ved ID/CVR afledes det af ID'et."),
        focus: z
          .enum(PAGE_FOCUSES)
          .optional()
          .describe("Den fokusvisning, siden blev vist med (fx 'oekonomi' for en virksomhed, 'risiko' for en person), så linket åbner samme visning. Standard: overblik."),
        note: z.string().max(500).optional().describe("Brugerens egen note til siden, højst 500 tegn."),
      }),
      annotations: { title: "Gem side", ...writeAnnotations },
      _meta: modelAndApp,
    },
    async (input): Promise<CallToolResult> => {
      const r = await savePage(ctx, input);
      if ("error" in r) return toolError(r.error);
      const { message, lookupNote, ...saved } = r;
      return {
        content: [{ type: "text", text: [message, lookupNote].filter(Boolean).join("\n") }],
        structuredContent: { ...saved },
      };
    },
  );

  registerAppTool(
    server,
    "remove_saved_page",
    {
      title: "Fjern gemt side",
      description:
        "Fjern én virksomhed eller person fra brugerens liste over gemte sider. Brug når brugeren siger 'fjern fra listen' eller 'glem X'. Tager Lasso-ID, CVR-nummer eller navn; et navn matches kun mod brugerens egne gemte sider.",
      inputSchema: z.object({
        page: z.string().min(1).describe("Lasso-ID (CVR-1-… eller CVR-3-…), 8-cifret CVR-nummer eller navnet på en gemt side."),
      }),
      annotations: { title: "Fjern gemt side", ...writeAnnotations, destructiveHint: true },
      _meta: modelAndApp,
    },
    async (input): Promise<CallToolResult> => {
      const r = await removeSavedPage(ctx, input);
      if ("error" in r) return toolError(r.error);
      const { message, ...result } = r;
      return {
        content: [{ type: "text", text: message }],
        structuredContent: { ...result },
      };
    },
  );

  registerAppTool(
    server,
    "list_saved_pages",
    {
      title: "Mine gemte sider",
      description:
        "Vis brugerens gemte virksomheder og personer (nyeste først) som en Lasso-liste, hvor hver side kan åbnes med friske data eller fjernes. Brug når brugeren spørger 'mine gemte', 'hvad har jeg gemt' eller 'min liste'. kind: 'company' (kun virksomheder), 'person' (kun personer) eller 'all' (standard).",
      inputSchema: z.object({
        kind: z.enum(["company", "person", "all"]).optional().describe("Kun virksomheder, kun personer eller begge. Standard: all."),
        limit: z.number().int().min(1).max(100).optional().describe("Højst så mange sider, nyeste først. Standard: 20."),
      }),
      annotations: { title: "Mine gemte sider", ...readOnly },
      _meta: ui,
    },
    async (input): Promise<CallToolResult> => {
      const { spec, dataset } = await listSavedPages(ctx, input);
      return viewResult(spec, dataset);
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
      const r = await resolveView(ctx, rawSpec);
      if ("error" in r) return toolError(r.error);
      return {
        content: [{ type: "text", text: "ok" }],
        structuredContent: { spec: r.spec, dataset: r.dataset },
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
