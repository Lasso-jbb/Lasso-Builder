import type { Focus } from "./compose.js";
import type { CompanyFactKey } from "./companyFacts.js";
import type { PersonFocus } from "./composePerson.js";
import { GAUGE_METRICS, METRIC_LABELS, type ComponentType, type Metric, type PersonListRole, type PersonRoleFilter, type TimelineKind } from "./spec.js";

/**
 * Spørgsmålet styrer formen (docs/portal.md, "Spørgsmålet styrer formen"). Brugerens spørgsmål ordret
 * bliver til en deterministisk spørgsmålsprofil (`parseAsk`), og profilen bliver til en plan for siden
 * (`askPlan`): svar-elementet (lead) med data afgrænset til spørgsmålet, og kontekstmoduler fra hele
 * kataloget i rangorden, som komponisten fylder på, til siden er fuld. Samme spørgsmål giver altid
 * samme plan; komponisten tilpasser den derefter til data (tomme kontekstmoduler udelades).
 *
 * Serverens implementering af Paper 30 "Fra spørgsmål til skærm" for show_company og show_person:
 * de bygger altid en hel side i spørgsmålets kontekst. Uden spørgsmål, eller med et generelt
 * spørgsmål ("fortæl om X", "hvordan går det"), er det fokus-siderne som hidtil.
 */

export const ASK_TOPICS = [
  "direktion", "bestyrelse", "ledelse", "ejere", "reelle-ejere", "koncern", "revisor",
  "revisorskift", "stiftet", "status", "branche", "formaal", "adresse", "telefon", "email", "web",
  "kontaktpersoner", "nyheder", "historik", "konkurs", "kredit", "score", "regnskab",
  "resultatopgoerelse", "balance", "pengestroem", "enheder", "ejendomme", "besaetning",
  // B1-ordbogen (docs/plan-b1-ordbog.md): de manglende komponenters emner
  "roede-flag", "fusion", "meddelelser", "dokumenter", "branchesammenligning", "placering", "heleregnskab",
  "registrering", "opsummering", "aendringer",
  // person
  "netvaerk", "bopael", "roller", "persontal",
] as const;
export type AskTopic = (typeof ASK_TOPICS)[number];

export interface Ask {
  /** Spørgsmålet, trimmet, højst 300 tegn ("" uden spørgsmål). */
  question: string;
  /** Nøgletal i nævnt rækkefølge, uden dubletter. */
  metrics: Metric[];
  /** Emner i nævnt rækkefølge, uden dubletter. */
  topics: AskTopic[];
  /** "de sidste 3 år", "over 10 år" → 2–10. */
  years?: number;
  /** "i 2023", "regnskabet for 2022" → et årstal 1990–i år (aldrig et 8-cifret CVR-nummer). */
  year?: number;
  /** udvikling, over tid/årene, de seneste år, vokset, faldet, steget, tendens, år for år, siden 20xx. */
  trend: boolean;
  /** tidligere, har været, forhenværende, udskiftning, historisk (roller og lister viser ophørte). */
  past: boolean;
  /** Ingen metrics, topics, year eller years → niveau C (fokus-siden som i dag). */
  generic: boolean;
  /** Emnet fra `AskHints.topic` (kanonisk): står forrest i `topics` og rangerer før alt andet. */
  topicHint?: AskTopic;
}

export type AskKind = "company" | "person";

export interface AskHints {
  /** Nøgletal, modellen har genkendt i spørgsmålet; lægges forrest i `metrics`. */
  metrics?: readonly Metric[];
  /**
   * Virksomhedens eller personens navn (flere stavemåder). Navnet fjernes fra spørgsmålet, før det
   * læses, så "Eksempel Ejendomme ApS" eller "X Holding" ikke bliver til emnerne ejendomme og koncern.
   */
  name?: string | readonly (string | undefined)[];
  /** Dags dato (tests); årstal efter i år afvises. */
  today?: Date;
  /**
   * Den kaldende AI's aflæsning af emnet (B1-ordbogen, afsnit 1 og 4): behandles som et emne nævnt
   * allerførst i spørgsmålet. Kanoniske værdier (`ASK_TOPICS`) og aliaserne i `normalizeTopic`;
   * ukendte værdier og emner for den anden slags side ignoreres.
   */
  topic?: string;
}

export const ASK_MAX_LENGTH = 300;

/** Små bogstaver, æ/ø/å som ae/oe/aa og uden accenter: "Årsværk" → "aarsvaerk". */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

/* ---------- Ordstammer (på foldet tekst) ---------- */

/** Nøgletal, mest specifikke først: et match "bruges", så "overskudsgrad" ikke også bliver resultat. */
const METRIC_RULES: readonly [Metric, string][] = [
  ["soliditetsgrad", String.raw`soliditet\w*|egenkapitalandel\w*|\bsolid(?:e|t)?\b`],
  ["overskudsgrad", String.raw`overskudsgrad\w*|\w*margin\w*`],
  ["likviditetsgrad", String.raw`likviditet\w*`],
  ["ebitda", String.raw`\bebitda\b|driftsresultat\w*`],
  ["bruttofortjeneste", String.raw`bruttofortjeneste\w*|bruttoavance\w*|bruttoresultat\w*|daekningsbidrag\w*`],
  ["balancesum", String.raw`balancesum\w*|samlede aktiver|aktiver i alt`],
  ["egenkapital", String.raw`egenkapital\w*`],
  ["gaeld", String.raw`\bgaeld\w*|forpligtelse\w*`],
  [
    "resultat",
    String.raw`\bresultat(?!opgoer)\w*|\baarsresultat\w*|\boverskud\w*|\bunderskud\w*|indtjening\w*|\btjener\b(?!\s+(?:de\s+|den\s+|det\s+|vi\s+)?penge)|bundlinje\w*|\bprofit\w*`,
  ],
  ["omsaetning", String.raw`omsaet\w*|\bomsat\b|\bsalg\w*|toplinje\w*`],
  ["ansatte", String.raw`\bansat\w*|medarbejder\w*|\bbeskaeftig\w*\b(?!\s+(?:[a-z]+\s+){0,2}sig\b)|aarsvaerk\w*`],
];

interface TopicRule {
  topic: AskTopic;
  re: string;
  /** Kun for denne slags side; udeladt = begge. */
  kind?: AskKind;
}

/** Emner, mest specifikke først (samme "brug"-regel som nøgletallene). */
const TOPIC_RULES: readonly TopicRule[] = [
  // B1-ordbogen (docs/plan-b1-ordbog.md, afsnit 2): de specifikke emner før de brede.
  { topic: "roede-flag", kind: "company", re: String.raw`roede\s?flag\w*|advarsel\w*|advarsler|observation\w*|noget galt|bekymr\w*|\badvar\w*` },
  { topic: "fusion", kind: "company", re: String.raw`fusion\w*|fusioner\w*|spaltning\w*|spaltet|delt op|sammenlagt|sammenlaegning\w*|opkoeb\w*|overtaget af|overtagelse\w*` },
  { topic: "meddelelser", kind: "company", re: String.raw`offentliggoer\w*|offentliggjort|statstidende|meddelelse\w*|bekendtgoer\w*|bekendtgjort` },
  { topic: "dokumenter", kind: "company", re: String.raw`dokument\w*|\bfiler\b|erhvervsstyrelsen|publikation\w*|\bbilag\w*|indsendt\w*` },
  {
    topic: "branchesammenligning",
    kind: "company",
    re: String.raw`i forhold til branchen|branchegennemsnit\w*|gennemsnit\w*\s+(?:i\s+)?(?:sin|deres|hele\s+)?\s*branche\w*|sammenlignet med branchen|bedre end (?:gennemsnittet|branchen|andre)|daarligere end (?:gennemsnittet|branchen)|benchmark\w*|klarer .{0,20} sig i forhold til`,
  },
  {
    topic: "placering",
    kind: "company",
    re: String.raw`paa et kort|kort over|\bkortet\b|(?:hvor (?:ligger|har)|beliggenhed\w*) .{0,40}(?:afdeling\w*|adresser|enheder|filial\w*|butik\w*)|geografi\w*`,
  },
  {
    topic: "heleregnskab",
    kind: "company",
    re: String.raw`hele regnskabet|komplette regnskab\w*|fulde regnskab\w*|alle poster\w*|alle regnskabslinjer|alle linjer\w*|skifte (?:aar|regnskabsaar)|(?:vaelge|vaelg) (?:aar|regnskabsaar)`,
  },
  // "tegne" flytter med tegningsreglen fra formålet hertil ("hvem kan tegne selskabet").
  {
    topic: "registrering",
    kind: "company",
    re: String.raw`selskabskapital\w*|indskudskapital\w*|\bkapital\b(?!andel)|vedtaegt\w*|tegningsregel\w*|tegningsret\w*|\btegne[rs]?\b|registreret med|registrering\w*|\bregnskabsklasse\w*`,
  },
  { topic: "opsummering", kind: "company", re: String.raw`opsummer\w*|opsummering\w*|kort fortalt|tl;?dr|\bresume\w*|i korte traek|hurtigt overblik|sammendrag\w*|kort version` },
  {
    topic: "aendringer",
    kind: "company",
    re: String.raw`aendringsfeed\w*|seneste aendringer|nye aendringer|(?:aendret|aendring\w*|sket) .{0,30}(?:sidste|seneste) \d+ (?:dage|uger|maaneder)|sidste \d+ dage`,
  },
  {
    topic: "persontal",
    kind: "person",
    re: String.raw`hvor mange (?:roller|selskaber|poster|ejerskaber|bestyrelser|virksomheder)|antal (?:roller|selskaber|poster)|\bi alt\b|hvor mange .{0,20}ophoert`,
  },
  { topic: "reelle-ejere", kind: "company", re: String.raw`\breel(?:le)?\s+ejer\w*|\breelt\s+ejer\w*|ultimative\s+ejer\w*|i sidste ende|personerne bag` },
  { topic: "koncern", re: String.raw`koncern\w*|moderselskab\w*|datterselskab\w*|\bholding\w*|ejerstruktur\w*|ejerdiagram\w*` },
  { topic: "revisorskift", kind: "company", re: String.raw`revisorskift\w*|skift\w*\s+(?:af\s+)?revisor\w*|uafhaengig\w*|\bhabil\w*` },
  { topic: "revisor", kind: "company", re: String.raw`revisor\w*|\brevision\w*|\brevideret\b` },
  { topic: "kontaktpersoner", kind: "company", re: String.raw`kontaktperson\w*` },
  { topic: "email", kind: "company", re: String.raw`\be-?mail\w*|\bmail\w*` },
  { topic: "web", kind: "company", re: String.raw`hjemmeside\w*|website\w*|\bweb\w*|\bwww\b` },
  { topic: "telefon", kind: "company", re: String.raw`telefon\w*|\btlf\b|\bring(?:e|er)?\b` },
  { topic: "enheder", kind: "company", re: String.raw`\bp-?enhed\w*|\bp-?num\w*|produktionsenhed\w*|afdeling\w*|filial\w*|\bbutik\w*` },
  { topic: "ejendomme", kind: "company", re: String.raw`ejendom\w*|matrikel\w*|bygning\w*|tinglys\w*|\bbbr\b` },
  { topic: "besaetning", kind: "company", re: String.raw`besaetning\w*|\bdyr\b|\bchr\b|husdyr\w*|\bsvin\b|\bkvaeg\b|\bkoeer\b` },
  { topic: "konkurs", re: String.raw`konkurs\w*|tvangsoploes\w*|tvangsoploest\w*|\bkurator\w*|rekonstruktion\w*|betalingsstands\w*` },
  // Scoren før kreditten, så "kreditscoren" er scoren (B1-ordbogen: score + kreditscore\w*).
  { topic: "score", kind: "company", re: String.raw`\bscore\w*|kreditscore\w*` },
  { topic: "kredit", kind: "company", re: String.raw`kredit\w*|\brisiko\w*|handle med|\brating\w*|\bsikker\w*|kreditvaerdig\w*` },
  { topic: "resultatopgoerelse", kind: "company", re: String.raw`resultatopgoerelse\w*|driftsregnskab\w*` },
  { topic: "pengestroem", kind: "company", re: String.raw`pengestroem\w*|cash\s?flow\w*` },
  { topic: "balance", kind: "company", re: String.raw`\bbalance(?!sum)\w*|aktiver og passiver|\bpassiver\b` },
  { topic: "regnskab", kind: "company", re: String.raw`regnskab\w*|aarsrapport\w*` },
  { topic: "nyheder", re: String.raw`nyhed\w*|\bpresse\w*|omtal\w*|\bmedie\w*|\bartikl\w*|\bavis\w*` },
  { topic: "historik", re: String.raw`\bsket\b|historik\w*|haendelse\w*|aendring\w*|\baendret\b|\bhistorie\b` },
  { topic: "stiftet", kind: "company", re: String.raw`\bstiftet\b|stiftelse\w*|grundlagt|\betableret\b|hvor gammel|\boprettet\b|\bstartet\b` },
  { topic: "status", kind: "company", re: String.raw`\bstatus\b|\bophoer\w*|\boploes\w*|\boploest\b|\baktive?\b|\blukket\b` },
  { topic: "formaal", kind: "company", re: String.raw`formaal\w*` },
  { topic: "branche", kind: "company", re: String.raw`branche\w*|hvad laver|beskaeftiger\s+(?:[a-z]+\s+){0,2}sig|hvad driver|hvad goer` },
  { topic: "adresse", re: String.raw`adresse\w*|hvor ligger|beliggenhed|hovedsaede\w*|hvor holder` },
  { topic: "bopael", kind: "person", re: String.raw`\bbor\b|bopael\w*|hjemby\w*` },
  { topic: "netvaerk", kind: "person", re: String.raw`sammen med|netvaerk\w*|kolleg\w*|forbindelse\w*` },
  { topic: "roller", kind: "person", re: String.raw`\broller?\b|\bposter\b|\bhverv\b|engagement\w*` },
  { topic: "direktion", re: String.raw`direktoer\w*|direktion\w*|\badm\.?\s?dir\w*|administrerende|\bceo\b` },
  { topic: "bestyrelse", re: String.raw`bestyrelse\w*|\bformand\w*|naestformand\w*|\bsuppleant\w*` },
  { topic: "ledelse", kind: "company", re: String.raw`ledelse\w*|hvem sidder|hvem staar bag|\bledere\b` },
  { topic: "ejere", re: String.raw`\bejer\w*|\bejes\b|\bejet\b|aktionaer\w*|anpartshaver\w*|kapitalejer\w*` },
];

const TREND = new RegExp(
  String.raw`udvikl\w*|over tid|over (?:de )?(?:seneste |sidste )?(?:\d+ |to |tre |fire |fem |seks |syv |otte |ni |ti )?aar(?:ene)?\b|gennem aarene|de (?:seneste|sidste) (?:\d+ |to |tre |fire |fem |seks |syv |otte |ni |ti )?aar|\bvokse\w*|\bvokset\b|\bvaekst\w*|\bfaldet\b|\bfalder\b|\bfaldende\b|\bsteget\b|\bstiger\b|\bstigende\b|\bsteg\b|tendens\w*|aar for aar|\bforandr\w*|\bsiden (?:19|20)\d\d\b|\bfra (?:19|20)\d\d\b`,
);
const PAST = new RegExp(String.raw`tidligere|\btidl\b|har\s+vaeret|forhenvaerende|\bfhv\b|udskift\w*|historisk\w*|fratraad\w*|\bophoerte\b`);
/** Tabelord: "tabel", "år for år", "alle tal" giver flerårstabellen som svar. */
const TABLE = new RegExp(String.raw`\btabel\w*|aar for aar|\bskema\w*|alle (?:tal|noegletal)(?:ene)?\b`);
/** Udskiftning i ledelsen: listen viser også de fratrådte. */
const TURNOVER = new RegExp(String.raw`udskift\w*|fratraad\w*|tidligere|forhenvaerende|\bfhv\b|har\s+vaeret`);

const NUMBER_WORDS: Record<string, number> = { to: 2, tre: 3, fire: 4, fem: 5, seks: 6, syv: 7, otte: 8, ni: 9, ti: 10 };

/** Generelle vendinger uden emne: fokus uden svar-element (niveau C). */
const GENERIC_FOCUS: readonly [Focus, RegExp][] = [
  ["oekonomi", /hvordan gaar det|oekonomi\w*|tjener (?:de |den |det |vi )?penge|\budvikl\w*|\bvaekst\w*|noegletal\w*|\bpenge\b|\btal\b/],
  ["kontakt", /kontakt\w*|\bfat i\b/],
  ["historik", /hvad sker der/],
];
const GENERIC_PERSON_FOCUS: readonly [PersonFocus, RegExp][] = [
  ["roller", /hvad laver|hvor arbejder|\bjob\b/],
  ["historik", /hvad sker der/],
];

/** Fanernes navne (foldet): "Vis historik for X" er et klik på fanen, ikke et spørgsmål med et emne. */
const COMPANY_FOCUS_WORDS = ["overblik", "oekonomi", "regnskab", "ejerskab", "ledelse", "risiko", "historik", "kontakt"] as const;
const PERSON_FOCUS_WORDS = ["overblik", "roller", "netvaerk", "ejerskab", "risiko", "historik"] as const;
const FOCUS_COMMAND = /^\s*vis\s+(overblik|oekonomi|regnskab|ejerskab|ledelse|risiko|historik|kontakt|roller|netvaerk)(?:en|et|ket)?\s+for\b(?!\s*(?:19|20)\d\d\b)/;

/** Fanen i en "Vis <fane> for X"-besked (foldet navn), ellers undefined. */
function focusCommand(question: string): string | undefined {
  return FOCUS_COMMAND.exec(foldText(question))?.[1];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Fjerner et match (alle forekomster) fra teksten og giver positionen for det første, eller -1. */
function take(text: string, source: string): { text: string; at: number } {
  let at = -1;
  const out = text.replace(new RegExp(source, "g"), (m: string, offset: number) => {
    if (at < 0) at = offset;
    return " ".repeat(m.length);
  });
  return { text: out, at };
}

interface Scan {
  metrics: { m: Metric; at: number }[];
  topics: { t: AskTopic; at: number }[];
  year?: number;
  years?: number;
  trend: boolean;
  past: boolean;
}

/** Læser den foldede tekst: nøgletal og emner med position, årstal, antal år, udvikling og tidligere. */
function scan(raw: string, kind: AskKind, hints: AskHints): Scan {
  const thisYear = (hints.today ?? new Date()).getFullYear();
  let text = ` ${foldText(raw)} `;
  // Navnet på virksomheden eller personen er ikke en del af spørgsmålet.
  const names = (Array.isArray(hints.name) ? hints.name : [hints.name]).filter((n): n is string => typeof n === "string" && n.trim().length > 1);
  for (const name of [...names].sort((a, b) => b.length - a.length)) {
    const folded = foldText(name).trim();
    if (folded) text = text.replace(new RegExp(`(?<![\\p{L}\\d])${escape(folded)}(?![\\p{L}\\d])`, "gu"), (m) => " ".repeat(m.length));
  }
  // CVR-numre (8 cifre, evt. i par) er aldrig årstal eller antal år.
  text = text.replace(/\b(?:cvr[\s.:-]*(?:nr\.?|nummer)?[\s.:-]*)?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}\b/g, (m) => " ".repeat(m.length));

  const trend = TREND.test(text);
  const past = PAST.test(text);

  // "siden 2019" og "fra 2019": udvikling fra det år; ikke et enkelt regnskabsår.
  let years: number | undefined;
  text = text.replace(/\b(?:siden|fra|efter)\s+((?:19|20)\d{2})\b/g, (m, y: string) => {
    const n = Number(y);
    if (n >= 1990 && n <= thisYear) years = Math.max(years ?? 0, clamp(thisYear - n + 1, 2, 10));
    return " ".repeat(m.length);
  });
  const found = [...text.matchAll(/(?<!\d)((?:19|20)\d{2})(?!\d)/g)].map((m) => Number(m[1])).filter((y) => y >= 1990 && y <= thisYear);
  const distinct = [...new Set(found)];
  let year: number | undefined;
  if (distinct.length === 1) year = distinct[0];
  else if (distinct.length > 1) years = Math.max(years ?? 0, clamp(thisYear - Math.min(...distinct) + 1, 2, 10));
  text = text.replace(/(?<!\d)(?:19|20)\d{2}(?!\d)/g, (m) => " ".repeat(m.length));

  // Antal år: "de sidste 3 år", "over 10 år", "fem år".
  const count = /\b(\d{1,2})\s*(?:regnskabs)?aar\w*/.exec(text) ?? /\b(to|tre|fire|fem|seks|syv|otte|ni|ti)\s+(?:regnskabs)?aar\w*/.exec(text);
  if (count) {
    const n = /^\d+$/.test(count[1]!) ? Number(count[1]) : NUMBER_WORDS[count[1]!]!;
    if (n >= 1) years = clamp(n, 2, 10);
  }

  const metrics: Scan["metrics"] = [];
  for (const [m, re] of METRIC_RULES) {
    const r = take(text, re);
    if (r.at < 0) continue;
    text = r.text;
    metrics.push({ m, at: r.at });
  }
  const topics: Scan["topics"] = [];
  for (const rule of TOPIC_RULES) {
    if (rule.kind && rule.kind !== kind) continue;
    const r = take(text, rule.re);
    if (r.at < 0) continue;
    text = r.text;
    topics.push({ t: rule.topic, at: r.at });
  }
  return { metrics, topics, year, years, trend, past };
}

/** Emner, der ikke hører til siden, eller som et mere præcist emne dækker. */
function cleanTopics(s: Scan, kind: AskKind): { t: AskTopic; at: number }[] {
  const has = (t: AskTopic) => s.topics.some((x) => x.t === t);
  return s.topics.filter(({ t }) => {
    // "hvem sidder i bestyrelsen": bestyrelsen, ikke hele ledelsen.
    if (t === "ledelse" && (has("direktion") || has("bestyrelse"))) return false;
    // "hvad er der sket med omsætningen": udviklingen i tallet, ikke historikken.
    if (t === "historik" && s.metrics.length > 0) return false;
    // "hvilke ejendomme ejer de": ejendommene, ikke selskabets ejere.
    if (t === "ejere" && has("ejendomme")) return false;
    // "er revisor uafhængig", "har de skiftet revisor": revisorskiftet dækker revisoren.
    if (t === "revisor" && has("revisorskift")) return false;
    // "er de gået konkurs": konkursen er status-spørgsmålet.
    if (t === "status" && has("konkurs")) return false;
    // Person: adresse er bopælen.
    if (kind === "person" && t === "adresse" && has("bopael")) return false;
    return true;
  });
}

/**
 * Spørgsmålsprofilen: nøgletal og emner i nævnt rækkefølge, år, antal år, udvikling og tidligere.
 * Store/små bogstaver og æøå/ae-oe-aa er ligegyldige; ordstammer fanger bøjningerne.
 */
export function parseAsk(question: string | undefined, kind: AskKind, hints: AskHints = {}): Ask {
  const q = (question ?? "").trim().slice(0, ASK_MAX_LENGTH);
  // "Vis historik for X" (modulbjælken og "Se alle … i Historik" i chatten): fanen, som den er.
  if (focusCommand(q)) return { question: q, metrics: [], topics: [], trend: false, past: false, generic: true };
  const s = scan(q, kind, hints);
  const hinted = (hints.metrics ?? []).filter((m, i, a) => a.indexOf(m) === i);
  const inText = [...s.metrics].sort((a, b) => a.at - b.at).map((x) => x.m);
  const metrics = kind === "company" ? [...hinted, ...inText.filter((m) => !hinted.includes(m))] : [];
  const inTopics = cleanTopics(s, kind)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.t);
  // Emne-hintet er "nævnt allerførst": forrest, og spørgsmålet er ikke generelt.
  const hint = topicForKind(hints.topic, kind);
  const topics = hint ? [hint, ...inTopics.filter((t) => t !== hint)] : inTopics;
  const trend = s.trend || (kind === "company" && metrics.length > 0 && s.topics.some((x) => x.t === "historik"));
  // En person har ingen nøgletal: kun emnerne gør spørgsmålet specifikt.
  const generic = kind === "person" ? topics.length === 0 : metrics.length === 0 && topics.length === 0 && s.year === undefined && s.years === undefined;
  return {
    question: q,
    metrics,
    topics,
    ...(s.years !== undefined ? { years: s.years } : {}),
    ...(s.year !== undefined ? { year: s.year } : {}),
    trend,
    past: s.past,
    generic: hint ? false : generic,
    ...(hint ? { topicHint: hint } : {}),
  };
}

/** Emner, der kun hører til den ene slags side (fra reglerne). */
const TOPIC_KIND = new Map<AskTopic, AskKind | undefined>(TOPIC_RULES.map((r) => [r.topic, r.kind]));

/** Hintet som kanonisk emne for denne slags side, ellers undefined (ukendt eller den anden slags). */
function topicForKind(raw: string | undefined, kind: AskKind): AskTopic | undefined {
  const t = raw === undefined ? undefined : normalizeTopic(raw);
  if (!t) return undefined;
  const only = TOPIC_KIND.get(t);
  return only && only !== kind ? undefined : t;
}

/** AI-ord for emnerne (B1-ordbogen, afsnit 4), foldet og med "_" mellem ordene. */
const TOPIC_ALIASES: Record<string, AskTopic> = {
  risiko: "roede-flag",
  roede_flag: "roede-flag",
  red_flags: "roede-flag",
  advarsler: "roede-flag",
  fusioner: "fusion",
  spaltning: "fusion",
  mergers: "fusion",
  offentliggoerelser: "meddelelser",
  statstidende: "meddelelser",
  announcements: "meddelelser",
  publikationer: "dokumenter",
  filer: "dokumenter",
  documents: "dokumenter",
  branche_sammenligning: "branchesammenligning",
  benchmark: "branchesammenligning",
  branchetal: "branchesammenligning",
  kort: "placering",
  map: "placering",
  adresser: "placering",
  afdelinger: "placering",
  hele_regnskabet: "heleregnskab",
  fuldt_regnskab: "heleregnskab",
  statements: "heleregnskab",
  kapital: "registrering",
  vedtaegter: "registrering",
  registration: "registrering",
  resume: "opsummering",
  summary: "opsummering",
  tldr: "opsummering",
  changes: "aendringer",
  aendringsfeed: "aendringer",
  seneste_aendringer: "aendringer",
  kreditscore: "score",
  rating_history: "score",
  antal_roller: "persontal",
  stats: "persontal",
  kredit: "kredit",
  kreditvurdering: "kredit",
  creditsafe: "kredit",
};

/**
 * Et emne-hint som kanonisk emne: en værdi fra `ASK_TOPICS` eller et alias fra B1-ordbogens tabel
 * ("risiko" → roede-flag, "red flags" → roede-flag). Store/små bogstaver, æøå og "-", "_" eller
 * mellemrum mellem ordene er ligegyldige. Ukendte værdier giver undefined.
 */
export function normalizeTopic(s: string): AskTopic | undefined {
  if (typeof s !== "string") return undefined;
  const key = foldText(s).trim().replace(/[\s_-]+/g, "_");
  if (!key) return undefined;
  const canonical = key.replace(/_/g, "-");
  if ((ASK_TOPICS as readonly string[]).includes(canonical)) return canonical as AskTopic;
  return Object.hasOwn(TOPIC_ALIASES, key) ? TOPIC_ALIASES[key] : undefined;
}

/* ---------- Spørgsmålstyper (rækkefølge = nævnt rækkefølge) ---------- */

export const COMPANY_ASK_TYPES = [
  "noegletal", "tabel", "ledelse", "ejerskab", "revisor", "stamdata", "kontakt", "nyheder", "konkurs", "kredit", "score", "regnskab", "enheder",
  // B1-ordbogen, afsnit 3
  "observationer", "fusioner", "meddelelser", "dokumenter", "branchesammenligning", "placering", "heleregnskab", "registrering", "opsummering",
  "aendringer",
] as const;
export type CompanyAskType = (typeof COMPANY_ASK_TYPES)[number];
export const PERSON_ASK_TYPES = ["roller", "konkurs", "netvaerk", "nyheder", "bopael", "koncern", "persontal"] as const;
export type PersonAskType = (typeof PERSON_ASK_TYPES)[number];

const COMPANY_TYPE_OF: Partial<Record<AskTopic, CompanyAskType>> = {
  direktion: "ledelse",
  bestyrelse: "ledelse",
  ledelse: "ledelse",
  ejere: "ejerskab",
  "reelle-ejere": "ejerskab",
  koncern: "ejerskab",
  revisor: "revisor",
  revisorskift: "revisor",
  stiftet: "stamdata",
  status: "stamdata",
  branche: "stamdata",
  formaal: "stamdata",
  adresse: "stamdata",
  telefon: "kontakt",
  email: "kontakt",
  web: "kontakt",
  kontaktpersoner: "kontakt",
  nyheder: "nyheder",
  historik: "nyheder",
  konkurs: "konkurs",
  kredit: "kredit",
  score: "score",
  regnskab: "regnskab",
  resultatopgoerelse: "regnskab",
  balance: "regnskab",
  pengestroem: "regnskab",
  enheder: "enheder",
  ejendomme: "enheder",
  besaetning: "enheder",
  "roede-flag": "observationer",
  fusion: "fusioner",
  meddelelser: "meddelelser",
  dokumenter: "dokumenter",
  branchesammenligning: "branchesammenligning",
  placering: "placering",
  heleregnskab: "heleregnskab",
  registrering: "registrering",
  opsummering: "opsummering",
  aendringer: "aendringer",
};

const PERSON_TYPE_OF: Partial<Record<AskTopic, PersonAskType>> = {
  bestyrelse: "roller",
  direktion: "roller",
  ejere: "roller",
  roller: "roller",
  konkurs: "konkurs",
  netvaerk: "netvaerk",
  nyheder: "nyheder",
  historik: "nyheder",
  bopael: "bopael",
  adresse: "bopael",
  koncern: "koncern",
  persontal: "persontal",
};

const CONTACT_TOPICS: readonly AskTopic[] = ["telefon", "email", "web", "kontaktpersoner"];
const LEADERSHIP_TOPICS: readonly AskTopic[] = ["direktion", "bestyrelse", "ledelse"];

/** Hvor i spørgsmålet et emne eller nøgletal står (hints uden ord i teksten først). */
function positions(ask: Ask, kind: AskKind): { metric: (m: Metric) => number; topic: (t: AskTopic) => number } {
  const s = scan(ask.question, kind, {});
  return {
    metric: (m) => s.metrics.find((x) => x.m === m)?.at ?? -1,
    // Emne-hintet er nævnt allerførst: før nøgletallene (-1).
    topic: (t) => (t === ask.topicHint ? -2 : (s.topics.find((x) => x.t === t)?.at ?? Number.MAX_SAFE_INTEGER)),
  };
}

/** Flerårstabellen er svaret: 4+ nøgletal, eller "tabel"/"år for år". */
function wantsTable(ask: Ask): boolean {
  return ask.metrics.length >= 4 || TABLE.test(foldText(ask.question));
}

/** Spørgsmålstyperne i nævnt rækkefølge (virksomhed). Tom for et generelt spørgsmål. */
export function companyAskTypes(ask: Ask): CompanyAskType[] {
  if (ask.generic) return [];
  const pos = positions(ask, "company");
  const found = new Map<CompanyAskType, number>();
  const put = (t: CompanyAskType, at: number) => found.set(t, Math.min(found.get(t) ?? Number.MAX_SAFE_INTEGER, at));
  // "Hele regnskabet for 2023": året er en prop på det fulde regnskab, ikke et nøgletalssvar.
  const whole = ask.topics.includes("heleregnskab");
  const numbers = ask.metrics.length > 0 || (!whole && (ask.year !== undefined || ask.years !== undefined)) || (ask.topics.includes("regnskab") && ask.trend);
  if (numbers || TABLE.test(foldText(ask.question))) {
    const at = ask.metrics.length ? Math.min(...ask.metrics.map(pos.metric)) : -1;
    put(wantsTable(ask) ? "tabel" : "noegletal", at);
  }
  const leadership = ask.topics.some((t) => LEADERSHIP_TOPICS.includes(t));
  const contactWords = ask.topics.some((t) => CONTACT_TOPICS.includes(t));
  for (const t of ask.topics) {
    let type = COMPANY_TYPE_OF[t];
    if (!type) continue;
    // "Hvad er der sket i ledelsen": ledelsens historik; "adresse og telefon": kontaktblokken.
    if (t === "historik" && leadership) type = "ledelse";
    if (t === "adresse" && contactWords) type = "kontakt";
    // Et regnskabsår eller udviklingen i tallene er nøgletalssvaret, ikke de fulde regnskaber; "hvad er
    // der sket med regnskabet" er historikken med regnskaberne.
    if (t === "regnskab" && (found.has("noegletal") || found.has("tabel") || ask.topics.includes("historik"))) continue;
    // Hele regnskabet vinder over regnskabstypen (B1-ordbogen, afsnit 3).
    if (type === "regnskab" && whole) continue;
    put(type, pos.topic(t));
  }
  // Røde flag før kreditten og kortet før enhederne, uanset rækkefølgen i spørgsmålet: det andet
  // står som lead nr. 2 (B1-ordbogen, afsnit 3).
  // Branchesammenligningen med nøgletal: måleren med de spurgte nøgletal er svaret, grafen konteksten.
  const pairs = [["observationer", "kredit"], ["placering", "enheder"], ["branchesammenligning", "noegletal"], ["branchesammenligning", "tabel"]] as const;
  for (const [first, then] of pairs) {
    const a = found.get(first);
    const b = found.get(then);
    if (a !== undefined && b !== undefined && b < a) found.set(first, b - 0.5);
  }
  return [...found.entries()].sort((a, b) => a[1] - b[1]).map(([t]) => t);
}

/** Spørgsmålstyperne i nævnt rækkefølge (person). Tom for et generelt spørgsmål. */
export function personAskTypes(ask: Ask): PersonAskType[] {
  if (ask.generic) return [];
  const pos = positions(ask, "person");
  const found = new Map<PersonAskType, number>();
  for (const t of ask.topics) {
    const type = PERSON_TYPE_OF[t];
    if (type) found.set(type, Math.min(found.get(type) ?? Number.MAX_SAFE_INTEGER, pos.topic(t)));
  }
  return [...found.entries()].sort((a, b) => a[1] - b[1]).map(([t]) => t);
}

/* ---------- Fokus og etiket ---------- */

const TYPE_FOCUS: Record<CompanyAskType, Focus> = {
  noegletal: "oekonomi",
  tabel: "oekonomi",
  ledelse: "ledelse",
  ejerskab: "ejerskab",
  revisor: "overblik",
  stamdata: "overblik",
  kontakt: "kontakt",
  nyheder: "historik",
  konkurs: "risiko",
  kredit: "risiko",
  score: "risiko",
  regnskab: "regnskab",
  enheder: "overblik",
  observationer: "risiko",
  fusioner: "historik",
  meddelelser: "historik",
  dokumenter: "regnskab",
  branchesammenligning: "oekonomi",
  placering: "kontakt",
  heleregnskab: "regnskab",
  registrering: "overblik",
  opsummering: "overblik",
  aendringer: "historik",
};
const PERSON_TYPE_FOCUS: Record<PersonAskType, PersonFocus> = {
  roller: "roller",
  konkurs: "risiko",
  netvaerk: "netvaerk",
  nyheder: "historik",
  bopael: "overblik",
  koncern: "ejerskab",
  persontal: "roller",
};

/** Fokus afledt af spørgsmålet (stærkeste signal); undefined uden signal. Bruges til modulbjælke, opfølgninger og som ramme for niveau C. */
export function askFocus(ask: Ask): Focus | undefined {
  const command = focusCommand(ask.question);
  if (command && (COMPANY_FOCUS_WORDS as readonly string[]).includes(command)) return command as Focus;
  const types = companyAskTypes(ask);
  if (ask.topics.includes("revisorskift") && types[0] === "revisor") return "risiko";
  if (types[0]) return TYPE_FOCUS[types[0]];
  const text = foldText(ask.question);
  return GENERIC_FOCUS.find(([, re]) => re.test(text))?.[0];
}

export function askPersonFocus(ask: Ask): PersonFocus | undefined {
  const command = focusCommand(ask.question);
  if (command && (PERSON_FOCUS_WORDS as readonly string[]).includes(command)) return command as PersonFocus;
  const types = personAskTypes(ask);
  if (types[0]) return PERSON_TYPE_FOCUS[types[0]];
  const text = foldText(ask.question);
  return GENERIC_PERSON_FOCUS.find(([, re]) => re.test(text))?.[0];
}

/** Nøgletallenes korte navne i etiketter ("Gæld og egenkapital"). */
const METRIC_WORD: Record<Metric, string> = { ...METRIC_LABELS, gaeld: "Gæld", resultat: "Resultat" };

const COMPANY_TOPIC_LABEL: Record<AskTopic, string> = {
  direktion: "Direktion",
  bestyrelse: "Bestyrelse",
  ledelse: "Ledelse",
  ejere: "Ejere",
  "reelle-ejere": "Reelle ejere",
  koncern: "Koncern",
  revisor: "Revisor",
  revisorskift: "Revisors uafhængighed",
  stiftet: "Stiftelse",
  status: "Status",
  branche: "Branche",
  formaal: "Formål",
  adresse: "Adresse",
  telefon: "Telefon",
  email: "E-mail",
  web: "Web",
  kontaktpersoner: "Kontaktpersoner",
  nyheder: "Nyheder",
  historik: "Historik",
  konkurs: "Konkurs og status",
  kredit: "Kreditvurdering",
  score: "Score",
  regnskab: "Regnskab",
  resultatopgoerelse: "Resultatopgørelse",
  balance: "Balance",
  pengestroem: "Pengestrøm",
  enheder: "Produktionsenheder",
  ejendomme: "Ejendomme",
  besaetning: "Besætning",
  "roede-flag": "Røde flag",
  fusion: "Fusioner og spaltninger",
  meddelelser: "Offentliggørelser",
  dokumenter: "Dokumenter",
  branchesammenligning: "Branchesammenligning",
  placering: "Placering",
  heleregnskab: "Hele regnskabet",
  registrering: "Registrering",
  opsummering: "Opsummering",
  aendringer: "Seneste ændringer",
  netvaerk: "Netværk",
  bopael: "Bopæl",
  roller: "Roller",
  persontal: "Antal roller",
};
const PERSON_TOPIC_LABEL: Partial<Record<AskTopic, string>> = {
  bestyrelse: "Bestyrelsesposter",
  direktion: "Direktørposter",
  ejere: "Ejerskaber",
  roller: "Roller",
  konkurs: "Konkurser",
  netvaerk: "Netværk",
  nyheder: "Nyheder",
  historik: "Historik",
  bopael: "Bopæl",
  adresse: "Bopæl",
  koncern: "Ejerstruktur",
  persontal: "Antal roller og selskaber",
};

/** "A", "A og b", "A, b og c": første ord med stort, resten med småt (forkortelser urørt). */
function joinLabels(parts: readonly string[]): string {
  const low = (p: string, i: number) => (i === 0 || /^[A-ZÆØÅ]{2,}/.test(p) ? p : p.charAt(0).toLowerCase() + p.slice(1));
  const words = parts.map(low);
  return words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} og ${words.at(-1)}`;
}

/** Kort dansk etiket til sidens subtitle: "Soliditetsgrad", "Gæld og egenkapital", "Direktion", "Revisor", "Bestyrelsesposter". undefined når generic. */
export function askLabel(ask: Ask, kind: AskKind): string | undefined {
  if (ask.generic) return undefined;
  const pos = positions(ask, kind);
  const parts: { at: number; text: string }[] = [];
  if (kind === "company") {
    if (ask.metrics.length) {
      const at = Math.min(...ask.metrics.map(pos.metric));
      const names = joinLabels(ask.metrics.slice(0, 3).map((m) => METRIC_WORD[m]));
      parts.push({ at, text: ask.year !== undefined ? `${names} ${ask.year}` : names });
    } else if (ask.year !== undefined) parts.push({ at: -1, text: `Regnskab ${ask.year}` });
    else if (ask.years !== undefined && !ask.topics.length) parts.push({ at: -1, text: `Økonomi, ${ask.years} år` });
  }
  const topics = ask.topics.filter((t) => !(kind === "company" && ask.year !== undefined && t === "regnskab"));
  // Direktion og bestyrelse sammen er ledelsen; "hvad er der sket i ledelsen" er ledelsesændringerne.
  const both = kind === "company" && topics.includes("direktion") && topics.includes("bestyrelse");
  const changes = kind === "company" && topics.includes("historik") && topics.some((t) => LEADERSHIP_TOPICS.includes(t));
  for (const t of topics) {
    if ((both && t === "bestyrelse") || (changes && t === "historik")) continue;
    const leadership = LEADERSHIP_TOPICS.includes(t);
    const label =
      kind === "person" ? PERSON_TOPIC_LABEL[t] : changes && leadership ? "Ledelsesændringer" : both && t === "direktion" ? "Ledelse" : COMPANY_TOPIC_LABEL[t];
    if (label && !parts.some((p) => p.text === label)) parts.push({ at: pos.topic(t), text: label });
  }
  if (!parts.length) return undefined;
  return joinLabels(
    parts
      .sort((a, b) => a.at - b.at)
      .slice(0, 3)
      .map((p) => p.text),
  );
}

/* ---------- Planen: svar-element (lead) og kontekst ---------- */

/**
 * Et element i planen: komponenttypen og dens data (metrics, only, year, rows, roles, kinds, role,
 * limit …) uden company/person, som proben og komponisten sætter på.
 */
export interface AskItem {
  type: ComponentType;
  props?: Record<string, unknown>;
  /** Fuld bredde: over kolonnerne (lead) eller under dem (kontekst). Ellers en kolonne (en halv). */
  full?: boolean;
  /** LassoTimeline: findes ingen begivenhed af de ønskede slags, vises alle (kontekst). */
  allKindsFallback?: boolean;
}

export interface AskPlan {
  /** Fuld bredde øverst under hovedet: nøgletalskortene (højst ét element). */
  top: AskItem[];
  /** Svar-elementerne i nævnt rækkefølge: det første øverst i kolonne 1 (eller i fuld bredde over kolonnerne). */
  lead: AskItem[];
  /** Kontekstmodulerne i rangorden; komponisten fylder på, til siden er fuld, og udelader tomme. */
  context: AskItem[];
}

/** Beslægtede nøgletal (til kort og liste): spurgt først, så de nærmest beslægtede. */
export const RELATED_METRICS: Record<Metric, readonly Metric[]> = {
  omsaetning: ["bruttofortjeneste", "resultat"],
  bruttofortjeneste: ["resultat", "ansatte"],
  resultat: ["overskudsgrad", "omsaetning"],
  egenkapital: ["soliditetsgrad", "balancesum"],
  gaeld: ["egenkapital", "soliditetsgrad", "balancesum"],
  soliditetsgrad: ["egenkapital", "gaeld"],
  likviditetsgrad: ["gaeld"],
  balancesum: ["egenkapital", "gaeld"],
  overskudsgrad: ["resultat", "omsaetning"],
  ebitda: ["resultat", "omsaetning"],
  ansatte: [],
};

/** De spurgte nøgletal og de beslægtede, uden dubletter, højst `max`. */
export function withRelated(metrics: readonly Metric[], max = 5): Metric[] {
  const out: Metric[] = [];
  for (const m of [...metrics, ...metrics.flatMap((x) => RELATED_METRICS[x])]) if (!out.includes(m)) out.push(m);
  return out.slice(0, max);
}

/** Procentnøgletal tegnes som linje; egenkapital og gæld som dele af balancen. */
const PERCENT: readonly Metric[] = ["soliditetsgrad", "overskudsgrad", "likviditetsgrad"];
const BALANCE: readonly Metric[] = ["balancesum", "gaeld", "egenkapital", "soliditetsgrad", "likviditetsgrad"];
const RESULT: readonly Metric[] = ["resultat", "omsaetning", "bruttofortjeneste", "overskudsgrad", "ebitda"];
/** Kortene ved konkurs og kredit: robusthed frem for størrelse. */
export const RISK_CARD_METRICS: readonly Metric[] = ["egenkapital", "resultat", "soliditetsgrad", "likviditetsgrad"];

/** Grafen for nøgletallene: 2–3 → grupperede søjler, procent → linje, gæld/egenkapital → stablede, ellers søjler. */
function graphFor(metrics: readonly Metric[], years: number): AskItem {
  if (metrics.length >= 2) return { type: "LassoGroupedBarChart", props: { metrics: metrics.slice(0, 3), years } };
  const m = metrics[0];
  if (!m) return { type: "LassoBarChart", props: { years } };
  if (PERCENT.includes(m)) return { type: "LassoLineChart", props: { metric: m, years } };
  if (m === "gaeld" || m === "egenkapital") return { type: "LassoStackedBarChart", props: { years } };
  return { type: "LassoBarChart", props: { metric: m, years } };
}

/** Typerne, der står i fuld bredde som egen række på spørgsmålssider (samme sæt som FULL_WIDTH_TYPES i compose.ts); designguiden viser dem som undtagelse fra gitterreglen. */
export const TYPE_WIDTH_FULL: ReadonlySet<ComponentType> = new Set([
  "LassoKeyFigureCards",
  "LassoMultiYearTable",
  "LassoIncomeStatement",
  "LassoBalanceSheet",
  "LassoCashFlow",
  "LassoOwnershipDiagram",
  "LassoProductionUnits",
  "LassoProperties",
  "LassoLivestock",
  "LassoFinancialStatements",
  "LassoRegistration",
  "LassoAnnouncements",
  "LassoSummary",
  "LassoChangeFeed",
  "LassoPersonStats",
]);
const item = (type: ComponentType, props?: Record<string, unknown>, extra: Partial<AskItem> = {}): AskItem => ({
  type,
  ...(props ? { props } : {}),
  ...(TYPE_WIDTH_FULL.has(type) ? { full: true } : {}),
  ...extra,
});

interface Fragment {
  /** Kortenes nøgletal (kandidater; komponisten vælger de oplyste, 4–5), "standard" eller ingen kort. */
  cards?: readonly Metric[] | "standard";
  lead: AskItem[];
  context: AskItem[];
}

const financialsList = (props: Record<string, unknown> = {}) => item("LassoKeyValueList", { variant: "financials", title: "Regnskab", ...props });
const rowsList = (rows: readonly CompanyFactKey[], title?: string) => item("LassoKeyValueList", { variant: "company", rows, ...(title ? { title } : {}) });
const timeline = (props: Record<string, unknown> = {}, extra: Partial<AskItem> = {}) => item("LassoTimeline", props, extra);
const PROFILE = () => item("LassoTextSections", { variant: "profil", title: "Virksomhedsprofil" });
const ANALYSIS = () => item("LassoTextSections", { variant: "analyse", title: "Regnskabsanalyse" });
const RELATIONS = () => item("LassoRelations");
const MAIN_GRAPH = (years = 5) => item("LassoBarChart", { years });

function companyFragment(type: CompanyAskType, ask: Ask): Fragment {
  const has = (t: AskTopic) => ask.topics.includes(t);
  const thisYear = new Date().getFullYear();
  const years = ask.years ?? (ask.trend ? 10 : 5);
  switch (type) {
    case "noegletal": {
      const asked = ask.metrics.slice(0, 3);
      const related = withRelated(asked, 5);
      // Et regnskabsår: listen med året er svaret (kortene viser altid seneste år), grafen dækker året.
      const graphYears = ask.year !== undefined ? clamp(Math.max(years, thisYear - ask.year + 1), 2, 10) : years;
      const graph = graphFor(asked, graphYears);
      const list = financialsList({ ...(related.length ? { only: related } : {}), ...(ask.year !== undefined ? { year: ask.year } : {}) });
      const statement = asked.length === 0 || RESULT.includes(asked[0]!) ? "LassoIncomeStatement" : BALANCE.includes(asked[0]!) ? "LassoBalanceSheet" : undefined;
      const balance = asked.length === 0 || asked.some((m) => BALANCE.includes(m));
      const result = asked.length === 0 || asked.some((m) => RESULT.includes(m));
      return {
        cards: ask.year !== undefined ? undefined : related.length ? related : "standard",
        lead: ask.year !== undefined ? [list] : [graph],
        context: [
          ...(ask.year !== undefined ? [graph] : [list]),
          ...(balance ? [item("LassoShareBars")] : []),
          ...(result ? [item("LassoWaterfallChart")] : []),
          ANALYSIS(),
          item("LassoMultiYearTable", { ...(related.length ? { metrics: withRelated(asked, 6) } : {}), years: Math.max(years, 5) }),
          timeline({ kinds: ["regnskab"], limit: 5 }),
          ...(statement ? [item(statement, { years: 3, title: statement === "LassoBalanceSheet" ? "Hele balancen" : "Hele resultatopgørelsen" })] : []),
          RELATIONS(),
        ],
      };
    }
    case "tabel": {
      const asked = ask.metrics.slice(0, 6);
      return {
        cards: asked.length ? asked.slice(0, 5) : "standard",
        lead: [item("LassoMultiYearTable", { ...(asked.length ? { metrics: asked } : {}), years: ask.years ?? (ask.trend ? 10 : 5) })],
        context: [graphFor(asked.slice(0, 1), years), financialsList(), ANALYSIS(), timeline({ kinds: ["regnskab"], limit: 5 })],
      };
    }
    case "ledelse": {
      const roles: PersonListRole | undefined = has("direktion") && !has("bestyrelse") ? "direktion" : has("bestyrelse") && !has("direktion") ? "bestyrelse" : undefined;
      const turnover = TURNOVER.test(foldText(ask.question));
      const people = item("LassoPersonList", { ...(roles ? { roles } : {}), show: ask.past || turnover ? "all" : "current", title: roles === "direktion" ? "Direktion" : roles === "bestyrelse" ? "Bestyrelse" : "Ledelse" });
      // "Hvad er der sket i ledelsen": ledelsens historik først.
      const history = has("historik");
      return {
        lead: history ? [timeline({ kinds: ["ledelse"], limit: 8 }), people] : [people],
        context: [
          ...(history ? [] : [timeline({ kinds: ["ledelse"], limit: 5 })]),
          item("LassoOwnerList"),
          PROFILE(),
          item("LassoContactPersons"),
          item("LassoNews", { limit: 3 }),
          item("LassoBeneficialOwners"),
        ],
      };
    }
    case "ejerskab": {
      const diagram = item("LassoOwnershipDiagram", { ingoingDepth: 3, outgoingDepth: 2 });
      const owners = item("LassoOwnerList");
      const beneficial = item("LassoBeneficialOwners");
      const lead = [...(has("koncern") ? [diagram] : []), ...(has("reelle-ejere") ? [beneficial] : []), ...(has("ejere") || !(has("koncern") || has("reelle-ejere")) ? [owners] : [])];
      return {
        lead,
        context: [
          ...[owners, beneficial, diagram].filter((x) => !lead.includes(x)),
          item("LassoPersonList", { show: "current" }),
          timeline({ kinds: ["ejerskab"], limit: 5 }, { allKindsFallback: true }),
          item("LassoNews", { limit: 3 }),
          PROFILE(),
        ],
      };
    }
    case "revisor": {
      const rows = rowsList(["revisor", "revisorskift", "regnskabsperiode"], "Revisor");
      // Jakob 01.10: revisoruafhængigheden er slettet.
      return {
        cards: "standard",
        lead: [rows],
        context: [MAIN_GRAPH(), ANALYSIS(), timeline({ kinds: ["regnskab"], limit: 5 }), item("LassoOwnerList")],
      };
    }
    case "stamdata": {
      const lead: AskItem[] = [];
      for (const t of ask.topics) {
        if ((t === "formaal" || t === "branche") && !lead.some((x) => x.type === "LassoTextSections")) lead.push(PROFILE());
        if ((t === "stiftet" || t === "status") && !lead.some((x) => x.type === "LassoTimeline")) lead.push(timeline({ kinds: ["stamdata", "status"], limit: 5, title: "Stiftelse og status" }));
        if (t === "adresse" && !lead.some((x) => x.type === "LassoContact")) lead.push(item("LassoContact"));
      }
      return {
        cards: "standard",
        lead,
        context: [RELATIONS(), timeline({ limit: 5 }), rowsList(["kommune", "region", "branchekode"], "Virksomhedsoplysninger"), MAIN_GRAPH(), item("LassoNews", { limit: 3 }), item("LassoProductionUnits")],
      };
    }
    case "kontakt": {
      const contact = item("LassoContact");
      const persons = item("LassoContactPersons");
      const lead = has("kontaktpersoner") ? [persons, ...(ask.topics.some((t) => t === "telefon" || t === "email" || t === "web" || t === "adresse") ? [contact] : [])] : [contact];
      return {
        lead,
        context: [
          ...[contact, persons].filter((x) => !lead.includes(x)),
          item("LassoProductionUnits"),
          item("LassoPersonList", { roles: "direktion", show: "current", title: "Direktion" }),
          rowsList(["kommune", "region"], "Virksomhedsoplysninger"),
          PROFILE(),
          item("LassoNews", { limit: 3 }),
        ],
      };
    }
    case "nyheder": {
      const history = has("historik");
      const kinds: TimelineKind[] | undefined = has("regnskab") ? ["regnskab"] : undefined;
      const tl = timeline({ limit: 8, ...(kinds ? { kinds } : {}) });
      const news = item("LassoNews", { limit: 5 });
      const lead = history ? [tl, ...(has("nyheder") ? [news] : [])] : [news];
      return {
        cards: history ? "standard" : undefined,
        lead,
        context: [...(history ? (has("nyheder") ? [] : [news]) : [timeline({ limit: 5 })]), RELATIONS(), PROFILE()],
      };
    }
    case "konkurs":
      return {
        cards: RISK_CARD_METRICS,
        // Statusbegivenhederne; uden dem hele historikken (hovedet viser status), ikke en tom tilstand.
        lead: [timeline({ kinds: ["status"], limit: 8, title: "Status og historik" }, { allKindsFallback: true })],
        context: [financialsList({ only: ["gaeld", "balancesum"] }), item("LassoShareBars"), ANALYSIS(), RELATIONS()],
      };
    case "kredit":
      return {
        cards: RISK_CARD_METRICS,
        lead: [item("LassoCreditRating")],
        context: [timeline({ kinds: ["status"], limit: 5 }), item("LassoShareBars"), ANALYSIS(), RELATIONS()],
      };
    case "score": {
      // Jakob 01.10: scorehistorikken er slettet (historikken kan ikke ses); måleren svarer, også på "over tid".
      const lead = [item("LassoScoreGauge")];
      return { cards: "standard", lead, context: [MAIN_GRAPH(), financialsList(), ANALYSIS(), RELATIONS()] };
    }
    case "regnskab": {
      const income = has("resultatopgoerelse");
      const balance = has("balance");
      const cash = has("pengestroem");
      const general = !income && !balance && !cash;
      const lead = [
        ...(income || general ? [item("LassoIncomeStatement", { years: 3 })] : []),
        ...(balance || general ? [item("LassoBalanceSheet", { years: 3 })] : []),
        ...(cash ? [item("LassoCashFlow", { years: 3 })] : []),
      ];
      const relevant: Metric[] = [
        ...(income || general ? (["omsaetning", "bruttofortjeneste", "ebitda", "resultat", "overskudsgrad"] as Metric[]) : []),
        ...(balance || general ? (["egenkapital", "gaeld", "balancesum", "soliditetsgrad", "likviditetsgrad"] as Metric[]) : []),
        ...(cash ? (["likviditetsgrad", "resultat", "egenkapital"] as Metric[]) : []),
      ].filter((m, i, a) => a.indexOf(m) === i);
      return {
        cards: "standard",
        lead,
        context: [
          ...(income || general ? [item("LassoWaterfallChart")] : []),
          ...(balance || general || cash ? [item("LassoShareBars")] : []),
          ...(general ? [item("LassoCashFlow", { years: 3 })] : []),
          ANALYSIS(),
          financialsList({ only: relevant }),
          timeline({ kinds: ["regnskab"], limit: 5 }),
        ],
      };
    }
    case "enheder": {
      const lead = [
        ...(has("enheder") ? [item("LassoProductionUnits")] : []),
        ...(has("ejendomme") ? [item("LassoProperties")] : []),
        ...(has("besaetning") ? [item("LassoLivestock")] : []),
      ];
      return {
        lead,
        context: [item("LassoContact"), rowsList(["kommune", "region", "branchekode"], "Virksomhedsoplysninger"), item("LassoPersonList", { show: "current" }), PROFILE(), item("LassoNews", { limit: 3 })],
      };
    }
    /* ---------- B1-ordbogen, afsnit 3 ---------- */
    case "observationer": {
      // "Kan vi handle med dem, er der røde flag": kreditvurderingen som lead nr. 2.
      const credit = has("kredit");
      return {
        cards: RISK_CARD_METRICS,
        lead: [item("LassoRiskObservations"), ...(credit ? [item("LassoCreditRating")] : [])],
        context: [
          ...(credit ? [] : [item("LassoCreditRating")]),
          timeline({ kinds: ["status"], limit: 5 }),
          item("LassoShareBars"),
          ANALYSIS(),
          RELATIONS(),
        ],
      };
    }
    case "fusioner":
      return {
        lead: [item("LassoMergers")],
        context: [timeline({ kinds: ["status"], limit: 5 }), item("LassoOwnerList"), RELATIONS(), PROFILE()],
      };
    case "meddelelser":
      return {
        lead: [item("LassoAnnouncements")],
        context: [item("LassoPublications"), timeline({ limit: 5 }), item("LassoNews", { limit: 3 })],
      };
    case "dokumenter":
      return {
        lead: [item("LassoPublications")],
        context: [item("LassoAnnouncements"), timeline({ kinds: ["regnskab"], limit: 5 }), financialsList()],
      };
    case "branchesammenligning": {
      // Målerens nøgletal: de spurgte, som måleren kender (op til 3), ellers alle tre.
      const asked = ask.metrics.filter((m): m is (typeof GAUGE_METRICS)[number] => (GAUGE_METRICS as readonly Metric[]).includes(m)).slice(0, 3);
      return {
        cards: "standard",
        lead: [item("LassoKeyFigureGauge", { metrics: asked.length ? asked : [...GAUGE_METRICS] })],
        context: [MAIN_GRAPH(), financialsList(), ANALYSIS(), RELATIONS()],
      };
    }
    case "placering": {
      // "Hvilke afdelinger har de, og hvor ligger de på et kort": enhederne som lead nr. 2.
      const units = has("enheder");
      return {
        lead: [item("LassoMap"), ...(units ? [item("LassoProductionUnits")] : [])],
        context: [...(units ? [] : [item("LassoProductionUnits")]), item("LassoContact"), rowsList(["kommune", "region"], "Virksomhedsoplysninger")],
      };
    }
    case "heleregnskab":
      return {
        cards: "standard",
        lead: [item("LassoFinancialStatements", ask.year !== undefined ? { year: ask.year } : undefined)],
        context: [ANALYSIS(), MAIN_GRAPH()],
      };
    case "registrering": {
      // Formålet alene er profil-varianten (bibrancher og formål); kapital, vedtægter og tegningsregel er 'full'.
      const text = foldText(ask.question);
      const profile = has("formaal") && !REGISTRATION_FULL.test(text);
      return {
        lead: [item("LassoRegistration", { variant: profile ? "profile" : "full" })],
        context: [PROFILE(), rowsList(["stiftet", "form", "regnskabsperiode"], "Virksomhedsoplysninger"), item("LassoOwnerList")],
      };
    }
    case "opsummering":
      return {
        cards: "standard",
        // LassoSummary kræver `text` i skemaet (askComponent parser planen): pladsholderen står, til
        // komponisten skriver resumeet (B4) og genkender den på SUMMARY_PENDING_TEXT.
        lead: [item("LassoSummary", { text: SUMMARY_PENDING_TEXT })],
        context: [PROFILE(), RELATIONS(), MAIN_GRAPH(), item("LassoContact")],
      };
    case "aendringer":
      return {
        lead: [item("LassoChangeFeed", { days: changeDays(ask.question) })],
        context: [timeline({ limit: 5 }), item("LassoNews", { limit: 3 })],
      };
  }
}

/** Pladsholder for resumeets tekst i planen; komponisten (B4) erstatter den med det skrevne resumé. */
export const SUMMARY_PENDING_TEXT = "Resumeet skrives ud fra virksomhedens seneste tal og fakta.";
/** Registreringens 'full'-ord: kapital, vedtægter, tegningsregel, regnskabsklasse (skemaets 'full'-kort). */
const REGISTRATION_FULL = new RegExp(String.raw`kapital\w*|vedtaegt\w*|tegningsre\w*|\btegne[rs]?\b|regnskabsklasse\w*|registreret med`);

/** Ændringsfeedets periode: "de sidste 14 dage", "3 uger", "2 måneder" → dage (højst 90); ellers 30. */
export function changeDays(question: string): number {
  const m = /\b(\d{1,3})\s+(dage?|uger?|maaned\w*)\b/.exec(foldText(question));
  if (!m) return 30;
  const n = Number(m[1]);
  const unit = m[2]!;
  const days = unit.startsWith("uge") ? n * 7 : unit.startsWith("maaned") ? n * 30 : n;
  return clamp(days, 1, 90);
}

const PERSON_ROLE_TOPICS: readonly [AskTopic, PersonRoleFilter][] = [
  ["bestyrelse", "bestyrelse"],
  ["direktion", "direktion"],
  ["ejere", "ejer"],
];

function personFragment(type: PersonAskType, ask: Ask): Fragment {
  const has = (t: AskTopic) => ask.topics.includes(t);
  switch (type) {
    case "roller": {
      // Én rolleliste: den første nævnte rolle (bestyrelse, direktion, ejer); "roller" generelt = alle som tidsbånd.
      const role = PERSON_ROLE_TOPICS.filter(([t]) => has(t)).sort((a, b) => ask.topics.indexOf(a[0]) - ask.topics.indexOf(b[0]))[0]?.[1];
      const show = role ? (ask.past ? "ended" : ask.trend ? "all" : "current") : "all";
      return {
        lead: [item("LassoPersonRoles", { ...(role ? { role } : {}), show, limit: 8 })],
        context: [
          item("LassoPersonNetwork", { limit: 5 }),
          timeline({ limit: 5 }),
          ...(role === "ejer" ? [item("LassoOwnershipDiagram", {}, { full: false })] : []),
          item("LassoNews", { limit: 3 }),
        ],
      };
    }
    case "konkurs":
      return {
        // Risikosektionen (LassoPersonRisk) udgår (Jakob 30.09): forløbet i selskaberne er svaret.
        lead: [timeline({ filter: "risiko", title: "Forløb i selskaberne" })],
        context: [item("LassoPersonRoles", { show: "ended", except: "risiko" }), item("LassoPersonNetwork", { limit: 3 })],
      };
    case "netvaerk":
      return {
        lead: [item("LassoPersonNetwork", { limit: 8 })],
        context: [item("LassoPersonRoles", { show: "current", limit: 5 }), timeline({ limit: 5 })],
      };
    case "nyheder": {
      const history = has("historik");
      const news = item("LassoNews", { limit: 5 });
      const tl = timeline({ limit: 8 });
      return {
        lead: history ? [tl, ...(has("nyheder") ? [news] : [])] : [news],
        context: [...(history ? (has("nyheder") ? [] : [news]) : [timeline({ limit: 5 })]), item("LassoPersonRoles", { show: "current", limit: 5 })],
      };
    }
    case "bopael":
      return {
        // Stamoplysningsblokken udgår (Jakob 30.09); byen står i personhovedet, rollerne svarer på resten.
        lead: [item("LassoPersonRoles", { show: "current", limit: 5 })],
        context: [item("LassoPersonRoles", { show: "current", limit: 5 }), item("LassoPersonNetwork", { limit: 3 }), timeline({ limit: 5 })],
      };
    case "koncern":
      return {
        lead: [item("LassoOwnershipDiagram")],
        context: [item("LassoPersonRoles", { show: "owner" }), item("LassoPersonNetwork", { limit: 3 })],
      };
    case "persontal":
      return {
        lead: [item("LassoPersonStats")],
        context: [item("LassoPersonRoles", { show: "current", limit: 5 }), timeline({ limit: 5 })],
      };
  }
}

/** Nøglen, dubletter findes på: typen (og variant for nøgle-værdi-listerne); ét tekstelement pr. side. */
export function askItemKey(i: { type: ComponentType; props?: Record<string, unknown> }): string {
  return i.type === "LassoKeyValueList" ? `${i.type}:${String(i.props?.variant ?? "company")}` : i.type;
}

/**
 * Planen for et spørgsmål: kortene øverst (top), svar-elementerne i nævnt rækkefølge (lead) og
 * kontekstmodulerne i rangorden (kontekst; foreningen af spørgsmålstypernes ranglister, flettet
 * efter rang og uden dubletter). Tom for et generelt spørgsmål (så gælder fokus-siderne).
 */
export function askPlan(ask: Ask, kind: AskKind): AskPlan {
  const fragments = kind === "company" ? companyAskTypes(ask).map((t) => companyFragment(t, ask)) : personAskTypes(ask).map((t) => personFragment(t, ask));
  if (!fragments.length) return { top: [], lead: [], context: [] };
  const cards = fragments.find((f) => f.cards)?.cards;
  const top = cards ? [item("LassoKeyFigureCards", cards === "standard" ? undefined : { metrics: [...cards] })] : [];
  const lead: AskItem[] = [];
  for (const f of fragments) for (const l of f.lead) if (!lead.some((x) => askItemKey(x) === askItemKey(l))) lead.push(l);
  // Konteksten kan have flere udgaver af samme element (fx historikken med regnskaberne og hele
  // historikken): komponisten tager den første med data og springer resten over (én pr. side).
  const signature = (i: AskItem) => `${i.type}|${JSON.stringify(i.props ?? {})}`;
  const seen = new Set(lead.map(signature));
  const context: AskItem[] = [];
  const add = (c: AskItem | undefined) => {
    if (!c || seen.has(signature(c))) return;
    seen.add(signature(c));
    context.push(c);
  };
  const longest = Math.max(...fragments.map((f) => f.context.length));
  for (let rank = 0; rank < longest; rank++) for (const f of fragments) add(f.context[rank]);
  // Er siden stadig ikke fuld, fyldes der efter med den fælles hale (mindst specifik sidst).
  for (const c of kind === "company" ? COMPANY_FILL() : PERSON_FILL()) add(c);
  return { top, lead, context };
}

/** Den fælles hale bag hver rangliste: moduler, der passer til ethvert spørgsmål om virksomheden. */
const COMPANY_FILL = (): AskItem[] => [
  MAIN_GRAPH(),
  timeline({ limit: 5 }),
  RELATIONS(),
  rowsList(["kommune", "region", "branchekode"], "Virksomhedsoplysninger"),
  item("LassoNews", { limit: 3 }),
  PROFILE(),
  item("LassoContact"),
];
/** Den fælles hale bag personens ranglister. */
const PERSON_FILL = (): AskItem[] => [
  item("LassoPersonRoles", { show: "current", limit: 5 }),
  item("LassoPersonNetwork", { limit: 3 }),
  timeline({ limit: 5 }),
  item("LassoNews", { limit: 3 }),
];
