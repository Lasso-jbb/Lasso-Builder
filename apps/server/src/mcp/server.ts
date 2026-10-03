import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  catalogAsText,
  catalogIndexText,
  COMPONENT_CATALOG,
  FOCUSES,
  COMPANY_SECTIONS,
  COMPOSITION_RULES,
  LAYOUT_RULES,
  LAYOUTS,
  DATASET_META_KEY,
  fieldsAsText,
  METRICS,
  OPERATORS_TEXT,
  PAGE_FOCUSES,
  PERSON_FOCUSES,
  searchQuerySchema,
  TABLE_COLUMNS,
  type Ask,
  type ComponentType,
  type Dataset,
  type ViewSpec,
} from "@lasso/spec";
import { PERSON_SEARCH_ROLES } from "../usecases/views.js";
import { textCard } from "../data/card.js";
import { mcpPdfLink } from "../pdf/routes.js";
import { summarizeView } from "../data/summary.js";
import { VISIBILITIES } from "../views/store.js";
import { loadViewHtml, viewVersion } from "../web/page.js";
import {
  listSavedPages,
  removeSavedPage,
  compareCompanies,
  renderView,
  resolveView,
  savePage,
  saveView,
  searchCompanies,
  searchPersons,
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
 * host: hvem der taler med modellen. "mcp" (standard) er Claude.ai m.fl. over /mcp; "chat" er Lassos
 * egen chat (chat/agent.ts), som altid viser visningen under modellens tekst.
 */
export type McpContext = UseCaseCtx & { host?: "mcp" | "chat" };

/**
 * Serverinstruktionerne står i hver samtale, så de holdes korte: routing og regler. Komponent-
 * kataloget hentes med describe_components (render_view har kun et indeks, plan Ø8), kompositions-
 * reglerne står KUN i render_view's beskrivelse og søgefelterne KUN i search_companies' (review P1-6).
 * Routingen (værktøjsvalget) deles med Lassos egen chat; reglerne er /mcp's egne, chatten har sine i
 * chat/agent.ts (CHAT_RULES). Teksten til Claude.ai er uændret: ROUTING + MCP_RULES.
 */
export const CHAT_ROUTING = `Lasso giver adgang til data om danske virksomheder og personer (CVR): stamdata, regnskaber, nøgletal, ledelse, bestyrelse, ejere, revisor, risiko, historik og kontakt, samt søgning med kriterier (målgrupper).

Vælg værktøj:
- Én virksomhed: show_company med CVR-nummer, Lasso-ID eller navn (serveren slår navnet op; brug ikke search_companies først). Serveren bygger siden omkring svaret på spørgsmålet: svar-elementet først med de nævnte nøgletal, roller og år, og kontekst rundt om. Sæt kun focus, når spørgsmålet er generelt: 'overblik' (standard, "fortæl om X"), 'oekonomi' ("hvordan går det"), 'regnskab', 'ejerskab', 'risiko', 'historik', 'kontakt' (kontakt og ledelse; 'ledelse' åbner samme side).
- Én person: show_person med navn eller person-ID (CVR-3-…). Vælg focus kun ved et generelt spørgsmål: 'overblik' (standard, "hvem er X"), 'roller' (roller over tid), 'netvaerk' (hvem sidder X sammen med), 'ejerskab' (hvilke selskaber ejer X), 'risiko' (konkurser og tvangsopløsninger), 'historik' (hvad er der sket, nyheder om X).
- Send altid brugerens spørgsmål ordret i question.
- "Vis alt om X", "vis det hele": show_company/show_person med show_all: true (siden må så gå ud over højdebudgettet). Ellers udelades show_all.
- Lister og målgrupper ("revisorer i Region Midt med mindst 10 ansatte"): search_companies med brugerens formulering som query.
- Personer på navn ('find Mette Holm', flere med samme navn): search_persons, derefter show_person med Lasso-ID.
- Flere navngivne virksomheder → compare_companies (sammenligning, rangering, "hvem er størst"). Navne må bruges i stedet for CVR-numre.
- Elementer, ingen focus dækker: render_view; hent først props for typerne med describe_components.`;

/** Gem-værktøjerne i routingen: kun Claude.ai har dem (portalen har knapper til at gemme). */
const ROUTING_SAVE = `- "Gem virksomheden/personen", "husk", "bogmærk", "sæt på min liste": save_page. "Mine gemte", "hvad har jeg gemt", "min liste": list_saved_pages. "Fjern fra listen": remove_saved_page. save_view er kun til et delbart link til en visning.
- "Giv mig en URL", "del": save_view.`;

/** Routingen til Claude.ai: chattens routing plus gem-værktøjerne. Byte-identisk med teksten før opdelingen (chatHost.test.ts). */
export const ROUTING = `${CHAT_ROUTING}\n${ROUTING_SAVE}`;

export const MCP_RULES = `Regler:
- Én visning pr. svar: kald højst ét af show_company, show_person, search_companies, search_persons, compare_companies og render_view pr. brugerbesked, og kun én gang. Aldrig show_company og render_view efter hinanden.
- Tegn altid med det samme. Spørg aldrig "vil du se det grafisk?".
- Kan din app vise den interaktive Lasso-visning: vis kun den, og skriv aldrig tekstkortet. Kan den ikke (fx Claude Code eller en terminal): vis tekstkortet fra værktøjssvaret uændret i en kodeblok med linket til den interaktive visning som klikbart link lige under, fx [Åbn LASSO X A/S i Lasso](url).
- Visningen er hele svaret (Jakob 30.09): skriv INGEN tekst i chatten før eller efter den; ingen opsummering, ingen kommentar, ingen gentagelse af tal og ingen forslag til næste spørgsmål (de står i visningen). Skriv kun tekst, når værktøjet fejlede, når du skal spørge, hvem brugeren mente, eller når appen ikke kan vise visningen (tekstkortet ovenfor). Skriv aldrig HTML/CSS.
- Nævner svaret andre match ved navneopslag, og er det uklart hvem brugeren mente, så spørg.
- Beløb angives i hele kroner (10 mio. = 10000000).`;

const INSTRUCTIONS = `${ROUTING}\n\n${MCP_RULES}`;

/** Første linje i hvert visningssvar (Jakob 30.09): visningen er svaret, så modellen skriver intet i chatten. */
const SILENT = "Visningen vises for brugeren nu og er hele svaret: skriv intet i chatten (kun hvis appen ikke kan vise visningen, se tekstkortet).";
/** Samme linje i Lassos egen chat, hvor visningen står under modellens tekst, og tekst er tilladt (CHAT_RULES). */
const SHOWN_IN_CHAT = "Visningen vises for brugeren under din tekst.";

/**
 * Resuméet står både som tekst og i structuredContent: nogle værter (fx Claude Code)
 * giver kun modellen structuredContent, og så skal tallene at kommentere stå der.
 */
function viewResult(spec: ViewSpec, ds: Dataset, extra: { note?: string; link?: string; ask?: Ask; pdfLink?: string } = {}, host: McpContext["host"] = "mcp"): CallToolResult {
  // Med et spørgsmål svarer resuméet og tekstkortet på det først ("Svar: …").
  const summary = [host === "chat" ? SHOWN_IN_CHAT : SILENT, extra.note, summarizeView(spec, ds, { ask: extra.ask }), extra.link && `Interaktiv Lasso-visning (link til brugeren): ${extra.link}`]
    .filter(Boolean)
    .join("\n");
  const card = textCard(spec, ds, { ask: extra.ask });
  return {
    content: [
      { type: "text", text: summary },
      ...(card ? [{ type: "text" as const, text: `Tekstkort:\n${card}` }] : []),
    ],
    structuredContent: {
      spec,
      source: ds.source,
      summary,
      ...(card ? { card } : {}),
      ...(extra.link ? { link: extra.link } : {}),
      // "Gem som PDF" i appen: det signerede .pdf-link til netop denne visning (pdf/routes.ts).
      ...(extra.pdfLink ? { pdfLink: extra.pdfLink } : {}),
    },
    _meta: { [DATASET_META_KEY]: ds },
  };
}

/** { [key]: value } når value findes, ellers {}. */
function optional<K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } {
  return (value === undefined ? {} : { [key]: value }) as { [P in K]?: V };
}

/** Appens CSP: må hente fra serverens egen adresse (PDF'en bag pdfLink). */
function serverCsp(publicBaseUrl: string): { connectDomains: string[] } | undefined {
  try {
    return { connectDomains: [new URL(publicBaseUrl).origin] };
  } catch {
    return undefined;
  }
}

function toolError(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

const KNOWN_TYPES = new Set<string>(COMPONENT_CATALOG.map((c) => c.type));

/**
 * render_view's input-skema holdes løst (plan Ø8): det fulde viewSpec-skema er ca. 45.000 tokens
 * JSON Schema, som modellen ellers fik i hver samtale. Typenavnene står her; props hentes med
 * describe_components, og renderView validerer specen præcist (fejlsvaret har katalogposterne).
 */
const renderViewInputSchema = z.object({
  title: z.string().min(1).max(120),
  subtitle: z.string().max(200).optional(),
  layout: z.enum(LAYOUTS).optional().describe("Udelad (dashboard). 'page' = Lasso-siden: tre kolonner 2:3:4 via column 1-3 på komponenterne."),
  criteria: z.array(z.record(z.string(), z.unknown())).max(20).optional().describe("Vises som chips under titlen: { field, operator, value }."),
  answer: z.record(z.string(), z.unknown()).optional().describe("{ next: { label, prompt } }"),
  components: z
    .array(z.object({ type: z.enum(COMPONENT_CATALOG.map((c) => c.type) as [ComponentType, ...ComponentType[]]) }).passthrough())
    .min(1)
    .max(12)
    .describe("Komponenter med props fra describe_components."),
});

/** describe_components: katalogposter for de kendte typer; ukendte nævnes med en rettelse. */
export function describeComponents(types: readonly string[]): string {
  const known = [...new Set(types)].filter((t) => KNOWN_TYPES.has(t)) as ComponentType[];
  const unknown = [...new Set(types)].filter((t) => !KNOWN_TYPES.has(t));
  const parts: string[] = [];
  if (known.length) parts.push(catalogAsText(known));
  if (unknown.length) parts.push(`Ukendte typer: ${unknown.join(", ")}. Brug typenavnene fra komponentindekset i render_view's beskrivelse.`);
  parts.push("Udelad width; Lasso lægger bredderne efter indholdet.");
  return parts.join("\n\n");
}

/** render_view's fejlsvar: en ugyldig spec får katalogposterne for de typer, den bruger, så modellen kan rette i ét forsøg. */
function withCatalogHelp(message: string, input: unknown): string {
  const comps = (input as { components?: unknown }).components;
  const types = Array.isArray(comps)
    ? [...new Set(comps.map((c) => (c as { type?: unknown })?.type).filter((t): t is string => typeof t === "string" && KNOWN_TYPES.has(t)))]
    : [];
  if (!message.startsWith("Specen er ugyldig") || types.length === 0) return message;
  return `${message}\n\nKatalog for typerne i specen:\n${catalogAsText(types as ComponentType[])}`;
}

/**
 * render_view's fulde beskrivelse (Claude.ai over /mcp): komposition, layoutguiden (Paper 30) og komponentindekset
 * med formål. Uændret tekst; chatten (host "chat") får den korte variant nedenfor.
 */
const RENDER_VIEW_DESCRIPTION = `Fri komposition til oversigter og analyser, der ikke passer i show_company, show_person, search_companies, search_persons eller compare_companies (sammenligninger bygges med compare_companies, ikke her). Send en JSON-spec; Lassos kode henter data og tegner i Lassos design. Virksomheder angives med CVR-nummer, Lasso-ID eller navn (navne slås op, og valget står i svaret). Skriv aldrig HTML/CSS. Brug 1–12 komponenter i ét dashboard. Kald render_view én gang pr. svar.

Før render_view: vælg typerne i indekset nedenfor og kald describe_components med dem for at få deres props, brug og eksempler. Gæt ikke props.\n\n${COMPOSITION_RULES}

${LAYOUT_RULES}\n\nKomponentindeks (type (titel): formål):\n${catalogIndexText()}\n\nEksempel (ét dashboard): {"title":"Byg A/S: ejere og revisor","components":[{"type":"LassoCompanyHead","company":"12345678"},{"type":"LassoOwnerList","company":"12345678"},{"type":"LassoKeyValueList","company":"12345678","rows":["revisor","revisorskift"]}]}`;

/**
 * render_view i Lassos egen chat (docs/chat.md, tokens): kun det, routingen (ROUTING) og CHAT_RULES ikke allerede
 * siger. Layoutguiden og indeksets formål er udeladt; typenavnene står her, fordi describe_components kræver dem
 * (uden dem kan modellen ikke slå noget op). Holdes under 1.500 tegn; input-skemaet er det samme som i /mcp.
 */
export const RENDER_VIEW_CHAT_DESCRIPTION = `Fri komposition: ét eller flere elementer, ingen af de andre værktøjer dækker (fx ét ejerdiagram eller én graf under din tekst), eller en hel side med layout "page". Send en JSON-spec; Lasso henter data og tegner. Kald først describe_components med de typer, du overvejer (props gættes ikke). 1–12 komponenter i læserækkefølge, højst én graf, udelad width, aldrig HTML/CSS. Virksomheder med CVR-nummer, Lasso-ID eller navn.
Typer: ${COMPONENT_CATALOG.map((c) => c.type).join(", ")}.`;

export function createMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer(
    { name: "lasso", title: "Lasso", version: "0.1.0" },
    { instructions: INSTRUCTIONS },
  );

  const ui = { ui: { resourceUri: VIEW_URI } };
  const view = (spec: ViewSpec, ds: Dataset, extra?: { note?: string; link?: string; ask?: Ask; pdfLink?: string }) => viewResult(spec, ds, extra, ctx.host);
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
      return view(r.spec, r.dataset, { note: r.note, pdfLink: mcpPdfLink(ctx.config, r) });
    },
  );

  registerAppTool(
    server,
    "search_persons",
    {
      title: "Søg personer",
      description:
        "Søg personer i CVR på navn (og evt. rolle eller by) og vis dem som en Lasso-tabel med aktive roller. Brug til 'find Mette Holm', 'hvem hedder … og sidder i bestyrelser', når navnet er tvetydigt, eller når brugeren vil se flere personer. Kald derefter show_person med personens Lasso-ID (CVR-3-…). Brug ikke til én kendt person (show_person) eller til virksomheder (search_companies).",
      inputSchema: z.object({
        query: z.string().min(2).max(120).describe("Navnet eller en del af det, fx 'Mette Holm'."),
        limit: z.number().int().min(1).max(50).optional().describe("Højst så mange personer. Standard 25."),
        role: z.enum(PERSON_SEARCH_ROLES).optional().describe("Kun personer med aktive roller af denne type. Standard: alle."),
        city: z.string().max(60).optional().describe("Kun personer bosat i denne by."),
        title: z.string().max(80).optional().describe("Overskrift på tabellen."),
      }),
      annotations: { title: "Søg personer", ...readOnly },
      _meta: ui,
    },
    async (input): Promise<CallToolResult> => {
      const r = await searchPersons(ctx, input);
      if ("error" in r) return toolError(r.error);
      return view(r.spec, r.dataset, { note: r.note, pdfLink: mcpPdfLink(ctx.config, r) });
    },
  );

  registerAppTool(
    server,
    "compare_companies",
    {
      title: "Sammenlign virksomheder",
      description:
        "Sammenlign 2–10 navngivne virksomheder på nøgletal: tabel (2–3, flere nøgletal), rangering (ét nøgletal, 'hvem er størst') og udvikling over tid for de to første. Send virksomhederne som navne eller CVR-numre og brugerens spørgsmål i question. Brug ikke til én virksomhed (show_company) eller til at finde virksomheder efter kriterier (search_companies).",
      inputSchema: z.object({
        companies: z.array(z.string().min(1).max(120)).min(2).max(10).describe("2–10 virksomheder: navne, CVR-numre eller Lasso-ID'er."),
        metrics: z.array(z.enum(METRICS)).min(1).max(5).optional().describe("Nøgletal i tabellen. Standard: omsætning, bruttofortjeneste, resultat, ansatte."),
        metric: z.enum(METRICS).optional().describe("Ét nøgletal at rangere efter."),
        years: z.number().int().min(2).max(10).optional().describe("År i linjegrafen. Standard 5."),
        question: z.string().max(300).optional().describe("Brugerens spørgsmål ordret."),
        title: z.string().max(120).optional().describe("Overskrift."),
      }),
      annotations: { title: "Sammenlign virksomheder", ...readOnly },
      _meta: ui,
    },
    async (input): Promise<CallToolResult> => {
      const r = await compareCompanies(ctx, input);
      if ("error" in r) return toolError(r.error);
      return view(r.spec, r.dataset, { note: r.note, pdfLink: mcpPdfLink(ctx.config, r) });
    },
  );

  registerAppTool(
    server,
    "show_company",
    {
      title: "Vis virksomhed",
      description:
        "Vis én dansk virksomhed som ét skærmbillede, der tilpasser sig spørgsmålet og virksomhedens data. Send brugerens spørgsmål ordret i question: serveren afleder, hvad der spørges om, og bygger en hel side i Lassos portal-layout, hvor svar-elementet står først med data afgrænset til spørgsmålet (fx soliditetsgraden først på kortene og som linjegraf, kun direktionen i personlisten, regnskabet for det nævnte år, kun ledelsesændringerne i historikken), og resten af siden er kontekst fra hele komponentkataloget. Samme spørgsmål giver altid samme side. Kald det kun én gang pr. svar, og kald ikke render_view bagefter. Brug til alle spørgsmål om én bestemt virksomhed. focus bruges kun ved et generelt spørgsmål ('fortæl om X', 'hvordan går det'): 'overblik' (standard), 'oekonomi', 'ejerskab', 'risiko' (kreditvurdering fra Creditsafe), 'historik', 'regnskab', 'kontakt' (kontakt og ledelse; 'ledelse' åbner samme side). Tager CVR-nummer, Lasso-ID eller navn; ved navn vælger serveren det bedste match og nævner alternativerne. Flere navngivne virksomheder → compare_companies; personer → show_person/search_persons; render_view kun til elementer, ingen af de andre værktøjer dækker. Siden holdes inden for et højdebudget (de mest relevante elementer); beder brugeren om at se alt/det hele om virksomheden, så sæt show_all: true.",
      inputSchema: z.object({
        company: z.string().min(1).describe("8-cifret CVR-nummer, Lasso-ID (fx CVR-1-12345678) eller virksomhedens navn."),
        question: z.string().max(300).optional().describe("Brugerens spørgsmål ordret. Serveren vælger niveau, elementer og data (nøgletal, roller, år) efter spørgsmålet."),
        metrics: z.array(z.enum(METRICS)).max(5).optional().describe("Valgfrit: de nøgletal, spørgsmålet handler om, hvis de ikke står med deres navn (fx 'egenkapitalandel' = soliditetsgrad)."),
        focus: z.enum(FOCUSES).optional().describe("Sæt kun focus, når spørgsmålet er generelt; ellers bestemmer spørgsmålet. Standard: overblik."),
        topic: z.string().max(40).optional().describe("Emnet i spørgsmålet, hvis det ikke står med sit eget ord: fx roede-flag, fusion, meddelelser, dokumenter, branchesammenligning, placering, heleregnskab, registrering, opsummering, aendringer, score, persontal (person). Aliaser som 'risiko', 'kort', 'tldr' forstås også. Udelad, når spørgsmålet selv siger det."),
        sections: z.array(z.enum(COMPANY_SECTIONS)).optional().describe("Forældet: fast skabelon. Brug focus i stedet."),
        chart_metric: z.enum(METRICS).optional().describe("Nøgletal i grafen, kun hvis brugeren nævner et bestemt. Standard: omsætning, hvis den er oplyst, ellers bruttofortjeneste."),
        years: z.number().int().min(2).max(10).optional().describe("Antal år i grafer og tabeller. Standard: 5, ved økonomi 10."),
        show_all: z.boolean().optional().describe("Vis alt om virksomheden: sæt true, når brugeren beder om at se alt/det hele ('vis alt om X', 'hele siden', 'det hele'). Så vises alle elementer i fuld form, også ud over sidens højdebudget (ca. 1½ skærm). Standard: udeladt; siden holdes kort med de mest relevante elementer."),
      }),
      annotations: { title: "Vis virksomhed", ...readOnly },
      _meta: ui,
    },
    async (input): Promise<CallToolResult> => {
      const r = await showCompany(ctx, input);
      if ("error" in r) return toolError(r.error);
      return view(r.spec, r.dataset, { note: r.note, link: r.link, ask: r.ask, pdfLink: mcpPdfLink(ctx.config, r) });
    },
  );

  registerAppTool(
    server,
    "show_person",
    {
      title: "Vis person",
      description:
        "Vis én person fra CVR som ét skærmbillede (katalog 16), der tilpasser sig spørgsmålet og personens data. Send brugerens spørgsmål ordret i question: serveren bygger siden omkring svaret (fx kun bestyrelsesposterne ved 'sidder X i bestyrelser', konkurserne ved 'har X været i konkurser') med kontekst rundt om. Uden spørgsmål, eller ved et generelt spørgsmål, angiver focus hensigten; serveren henter kun det, siden viser, og vælger selv formen (tomme sektioner udelades). Personhovedet (by, antal aktive og ophørte roller, ejerskaber, konkurser blandt selskaberne) står på alle fokus. focus: 'overblik' (standard, 'hvem er X': persontal, de aktive roller som liste, netværk (top 3) og erhvervsresumé; historik og ejerskab står på deres egne fokus), 'roller' ('hvor sidder X i bestyrelser', 'hvilke selskaber er X direktør i': alle roller som tidsbånd fra–til), 'netvaerk' ('hvem sidder X sammen med': hele netværket; år sammen = længste sammenhængende periode), 'ejerskab' ('hvilke selskaber ejer X': ejede selskaber med ejerandel og siden-dato og ejerdiagram med personen øverst), 'risiko' ('har X været i konkurser': forløbet i de selskaber, der gik konkurs eller blev tvangsopløst), 'historik' ('hvad er der sket', nyheder: rolleskift og selskabernes konkurser, nyheder om personen fra Lasso News; uden nyheder rollerne over tid). Tager navn eller personens Lasso-ID (CVR-3-…); ved navn vælger serveren det bedste match og nævner alternativerne. Personer har ikke CVR-nummer; brug show_company til virksomheder. Kald det kun én gang pr. svar. Siden holdes inden for et højdebudget; beder brugeren om at se alt/det hele om personen, så sæt show_all: true.",
      inputSchema: z.object({
        person: z.string().min(1).describe("Personens navn (fx 'Mette Holm') eller Lasso-ID (fx 'CVR-3-4000000001')."),
        question: z.string().max(300).optional().describe("Brugerens spørgsmål ordret. Serveren vælger elementer og data (roller, konkurser, netværk) efter spørgsmålet."),
        focus: z.enum(PERSON_FOCUSES).optional().describe("Sæt kun focus, når spørgsmålet er generelt; ellers bestemmer spørgsmålet. Standard: overblik."),
        topic: z.string().max(40).optional().describe("Emnet i spørgsmålet, hvis det ikke står med sit eget ord: fx roede-flag, fusion, meddelelser, dokumenter, branchesammenligning, placering, heleregnskab, registrering, opsummering, aendringer, score, persontal (person). Aliaser som 'risiko', 'kort', 'tldr' forstås også. Udelad, når spørgsmålet selv siger det."),
        show_all: z.boolean().optional().describe("Vis alt om personen: sæt true, når brugeren beder om at se alt/det hele ('vis alt om X', 'hele siden', 'det hele'). Så vises alle elementer i fuld form, også ud over sidens højdebudget (ca. 1½ skærm). Standard: udeladt; siden holdes kort med de mest relevante elementer."),
      }),
      annotations: { title: "Vis person", ...readOnly },
      _meta: ui,
    },
    async (input): Promise<CallToolResult> => {
      const r = await showPerson(ctx, input);
      if ("error" in r) return toolError(r.error);
      return view(r.spec, r.dataset, { note: r.note, link: r.link, ask: r.ask, pdfLink: mcpPdfLink(ctx.config, r) });
    },
  );

  // Plan Ø8 (token-reduktion): kataloget hentes efter behov i stedet for at stå i render_view's beskrivelse.
  registerAppTool(
    server,
    "describe_components",
    {
      title: "Beskriv komponenter",
      description:
        "Giver props, brug, 'brug ikke når', krav og eksempel for de komponenttyper, du vil bruge i render_view (typerne står i render_view's komponentindeks). Kald det før render_view med alle typer, du overvejer, i ét kald. Viser intet for brugeren.",
      inputSchema: z.object({
        types: z.array(z.string().min(1).max(60)).min(1).max(20).describe("Komponenttyper, fx ['LassoOwnerList', 'LassoKeyValueList']."),
      }),
      annotations: { title: "Beskriv komponenter", ...readOnly },
      _meta: { ui: { visibility: ["model"] } },
    },
    async ({ types }): Promise<CallToolResult> => {
      const text = describeComponents(types);
      return { content: [{ type: "text", text }] };
    },
  );

  registerAppTool(
    server,
    "render_view",
    {
      title: "Vis oversigt",
      // Chatten får den korte beskrivelse (tokens); Claude.ai den fulde. Skemaet er det samme.
      description: ctx.host === "chat" ? RENDER_VIEW_CHAT_DESCRIPTION : RENDER_VIEW_DESCRIPTION,
      inputSchema: renderViewInputSchema,
      annotations: { title: "Vis oversigt", ...readOnly },
      _meta: ui,
    },
    async (input): Promise<CallToolResult> => {
      // Navne ("Risika") slås op som i show_company, så modellen ikke skal søge først (review P1-7).
      const r = await renderView(ctx, input);
      if ("error" in r) return toolError(withCatalogHelp(r.error, input));
      return view(r.spec, r.dataset, { note: r.note, pdfLink: mcpPdfLink(ctx.config, r) });
    },
  );

  // Gem-værktøjerne kun til Claude.ai: portalen har knapper til at gemme (docs/chat.md, tokens).
  if (ctx.host !== "chat") registerAppTool(
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

  if (ctx.host !== "chat") registerAppTool(
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

  if (ctx.host !== "chat") registerAppTool(
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

  if (ctx.host !== "chat") registerAppTool(
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
      return view(spec, dataset, { pdfLink: mcpPdfLink(ctx.config, { spec, dataset }) });
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
        structuredContent: { spec: r.spec, dataset: r.dataset, ...optional("pdfLink", mcpPdfLink(ctx.config, r)) },
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
          // connectDomains: appen henter "Gem som PDF" (pdfLink) fra serveren selv.
          _meta: { ui: { prefersBorder: false, ...optional("csp", serverCsp(ctx.config.publicBaseUrl)) } },
        },
      ],
    }),
  );

  return server;
}
