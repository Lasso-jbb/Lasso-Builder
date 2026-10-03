import { emptyDataset, type Dataset, type ViewSpec } from "@lasso/spec";
import type { PageTemplate } from "../../portal/api.js";
import type { OpenItem, PendingChoice } from "../model.js";
import type { Answer, Turn } from "../thread.js";

/**
 * Samtaler til hver scene i Paper-eksporten (docs/design/chat/chat-designguide.html): anatomi, de tre svarformer,
 * fuld skærm, de tre placeringer (bliv, ny fane før/efter, global), afklaring, tom, tænker, længere opgave, fejl,
 * lang samtale, mobil og sideskabelonen (rød nål, bekræftelse). Bruges af designguiden (WP3) og dev-forhåndsvisningen
 * med de rigtige komponenter. Teksterne er eksportens, med komma i stedet for midterprik (D2).
 *
 * Kortenes specs peger på demovirksomheden og -personen (FIXTURE_COMPANY/FIXTURE_PERSON); datasættet er tomt, så
 * værten lægger sine egne data ind med withDataset (designguiden: ctx.boot.showcase).
 */

export const FIXTURE_COMPANY = "CVR-1-99000001";
export const FIXTURE_PERSON = "CVR-3-4000000001";
/** Fast tidspunkt 09:41 (lokal tid), så rammerne er ens ved hver tegning. */
export const FIXTURE_AT = new Date(2026, 9, 3, 9, 41).getTime();
const AT_PAGE = new Date(2026, 9, 3, 9, 52).getTime();

export const EMPTY_DATASET: Dataset = { ...emptyDataset("demo"), generatedAt: "2026-10-03T09:41:00.000Z" };

const spec = (s: Partial<ViewSpec> & Pick<ViewSpec, "title" | "components">): ViewSpec => ({ version: 2, kind: "custom", layout: "stack", criteria: [], ...s }) as ViewSpec;

export const SPEC_OWNERSHIP = spec({ title: "Ejerdiagram", subtitle: "Jakob Bech Benediktson, 4 selskaber", components: [{ type: "LassoOwnershipDiagram", person: FIXTURE_PERSON }] as unknown as ViewSpec["components"] });
export const SPEC_ROLES = spec({ title: "Jakobs øvrige roller", subtitle: "3 selskaber, alle aktive", components: [{ type: "LassoPersonRoles", person: FIXTURE_PERSON, show: "current" }] as unknown as ViewSpec["components"] });
export const SPEC_KYC = spec({
  title: "KYC-overblik, LASSO X A/S",
  subtitle: "CVR 34580820, genereret i dag kl. 09:52",
  layout: "page",
  components: [
    { type: "LassoCreditRating", company: FIXTURE_COMPANY, column: 1 },
    { type: "LassoBeneficialOwners", company: FIXTURE_COMPANY, column: 2 },
    { type: "LassoPersonList", company: FIXTURE_COMPANY, column: 2 },
    { type: "LassoRiskObservations", company: FIXTURE_COMPANY, column: 3, compact: true },
  ] as unknown as ViewSpec["components"],
});
export const SPEC_WINDOWS = spec({
  title: "Største vinduesproducenter, omsætning 2024",
  subtitle: "10 selskaber, kilde: seneste årsrapporter",
  components: [{ type: "LassoCompanyTable", source: "search", search: { query: "vinduer", criteria: [], limit: 10 } }] as unknown as ViewSpec["components"],
});

const view = (id: string, s: ViewSpec, form: "page" | "module" = "module") => ({ kind: "view" as const, id, form, spec: s, dataset: EMPTY_DATASET });
const text = (t: string) => ({ kind: "text" as const, text: t });
const done = (parts: Answer["parts"], at = FIXTURE_AT, extra: Partial<Answer> = {}): Answer => ({ parts, pending: false, at, ...extra });
let seq = 0;
const turn = (question: string, answer: Answer, extra: Partial<Turn> = {}): Turn => ({ id: `fx-${++seq}`, question, askedAt: FIXTURE_AT, answer, ...extra });

/** Faner til rammerne. */
export const TAB_COMPANY: OpenItem = { key: FIXTURE_COMPANY, kind: "company", name: "LASSO X A/S", tab: "lasso" };
export const TAB_PERSON: OpenItem = { key: FIXTURE_PERSON, kind: "person", name: "Jakob Bech Benediktson", tab: "lasso" };
export const TAB_GLOBAL: OpenItem = { key: "result:1", kind: "result", name: "Firmaliste", tab: "lasso" };

/* ---------- 02 Samtalen, anatomi ---------- */
export const ANATOMY: Turn[] = [
  turn("Vis mig risikovurderingen", done([text("LASSO X A/S har kreditvurdering B, lav risiko. Vurderingen bygger på regnskab 2024, betalingsadfærd og ejerkredsens historik, og den er uændret siden 2023.")])),
  turn(
    "Er der røde flag?",
    done([
      text(
        "Jeg har set tre ting igennem. Ingen af dem er alvorlige, men én er værd at kende:\n\n- **Konkursrelationer**, ingen aktive relationer i ledelse eller ejerkreds. Info\n- **Årets resultat**, faldt 12 % i 2024, men egenkapitalen er fortsat solid. Info\n- **Kreditorer**, kortfristet gæld til leverandører er steget markant siden 2023. Mulig vigtig\n\nSamlet set er der ingen røde flag, men hold øje med kreditorerne i det næste regnskab.",
      ),
    ]),
  ),
  turn(
    "Hvad betyder kreditorer her?",
    done([
      text(
        "Kreditorer er de leverandører og långivere, LASSO X A/S skylder penge på kort sigt. Når posten vokser hurtigere end omsætningen, kan det være et tidligt tegn på pres på likviditeten.\n\n[Risiko](lasso:modul/risiko) [Kreditorer](lasso:modul/oekonomi)",
      ),
    ]),
  ),
];

/* ---------- 03 Svarformer ---------- */
export const FORM_TEXT: Turn[] = [turn("Hvor mange ansatte er der?", done([text("LASSO X A/S har **42 ansatte** (årsværk 2024), 6 flere end året før.")]))];
export const FORM_ELEMENT: Turn[] = [turn("Vis mig Jakobs firmaer", done([text("Jakob Bech Benediktson har 4 firmaer, som han ejer gennem Benediktson Holding ApS."), view("fx-owner", SPEC_OWNERSHIP)]))];
export const FORM_PAGE: Turn[] = [
  turn("Lav et fuldt KYC-overblik", done([text("Her er en KYC-side for LASSO X A/S. Den samler ejere og reelle ejere, PEP- og sanktionstjek, risikoobservationer og nøgletal ét sted."), view("fx-kyc", SPEC_KYC, "page")], AT_PAGE)),
];

/* ---------- 04 Fuld skærm ---------- */
export const FULLSCREEN = { part: view("fx-owner", SPEC_OWNERSHIP), at: FIXTURE_AT };

/* ---------- 06-09 Placering ---------- */
export const STAY: Turn[] = [
  turn(
    "Hvad laver Jakob ellers?",
    done([text("Ud over LASSO X A/S har Jakob Bech Benediktson roller i tre andre selskaber. Alle er aktive, og alle hænger sammen gennem hans holdingselskab."), view("fx-roles", SPEC_ROLES)]),
    { notice: { kind: "here", name: "LASSO X A/S" } },
  ),
];

/** Ny fane, før: den gamle samtale med meddelelsesrækken (Fortryd står, til undoUntil er passeret; brug now = FIXTURE_AT). */
export const NEW_TAB_BEFORE: Turn[] = [
  turn("Hvem er direktør?", done([text("Direktør er Jakob Bech Benediktson, som også er medejer gennem Benediktson Holding ApS.")])),
  turn("Vis mig alt om Jakob", { parts: [], pending: false }, { notice: { kind: "moved", name: "Jakob Bech Benediktson", tabKey: FIXTURE_PERSON, undoUntil: FIXTURE_AT + 10_000, createdTab: true } }),
];
/** Ny fane, efter: spørgsmålet er første besked i personens fane. */
export const NEW_TAB_AFTER: Turn[] = [
  turn(
    "Vis mig alt om Jakob",
    done([
      text(
        "Her er Jakob Bech Benediktson. Han er 47 år, bor i Kgs. Lyngby og har roller i 4 aktive selskaber, alle ejet gennem Benediktson Holding ApS.\n\n[Overblik](lasso:modul/overblik) [Ejerskab](lasso:modul/ejerskab) [Netværk](lasso:modul/netvaerk)",
      ),
    ]),
  ),
];

export const CHOICE: PendingChoice = {
  id: "fx-choice",
  question: "Hvilken Jakob mener du?",
  allowFreeText: true,
  options: [
    { label: "Jakob Bech Benediktson", description: "Direktør og medejer, 47 år, Kgs. Lyngby. 4 selskaber, bl.a. Benediktson Holding ApS.", recommended: true, action: { placement: "entity", entity: { kind: "person", id: FIXTURE_PERSON, name: "Jakob Bech Benediktson" } } },
    { label: "Jakob Lindqvist Holm", description: "Bestyrelsesmedlem, 58 år, Aarhus. 2 selskaber, bl.a. Holm Invest A/S.", action: { placement: "entity", entity: { kind: "person", id: "CVR-3-4000002550", name: "Jakob Lindqvist Holm" } } },
  ],
};
export const CLARIFY: Turn[] = [turn("Vis mig alt om Jakob", done([text("Der er to personer med navnet Jakob i kredsen om LASSO X A/S. Hvem mener du?")], FIXTURE_AT, { choice: CHOICE }))];

export const GLOBAL: Turn[] = [
  turn(
    "Find de største vinduesproducenter i Danmark",
    done([text("Her er de 10 største vinduesproducenter i Danmark efter omsætning 2024. VELUX står for over halvdelen af branchens samlede omsætning."), view("fx-windows", SPEC_WINDOWS)]),
  ),
];

/* ---------- 10 Tilstande ---------- */
/** Tom: ingen ture; EmptyState med fanens navn og forslag. */
export const EMPTY = { name: "LASSO X A/S", kind: "company" as const, suggestions: ["Hvordan går det økonomisk?", "Hvem ejer LASSO X A/S?", "Er der røde flag?"] };
export const THINKING: Turn[] = [turn("Er der røde flag?", { parts: [], pending: true })];
export const LONG_TASK: Turn[] = [turn("Lav et fuldt KYC-overblik", { parts: [], pending: true, status: "Læser regnskab 2024 og ejerregistret…" })];
export const ERROR: Turn[] = [
  turn(
    "Vis mig regnskabet for 2019",
    done([text("LASSO X A/S har ikke indsendt regnskab for 2019; selskabet blev stiftet i 2020. Det ældste regnskab er 2020.\n\n[Regnskab](lasso:modul/regnskab) [Økonomi](lasso:modul/oekonomi)")]),
  ),
  turn("Sammenlign med Novo Nordisk", done([text("Novo Nordisk A/S kan også åbnes som fane.\n\n[Novo Nordisk A/S](lasso:firma/CVR-1-24256790)")], FIXTURE_AT, { error: "Jeg kunne ikke hente tallene for Novo Nordisk A/S lige nu." })),
];
/** Lang samtale: nok ture til at "Indlæser ældre beskeder…" står øverst (tegn med pageSize 5). */
export const LONG_THREAD: Turn[] = [
  ...Array.from({ length: 3 }, (_, i) => turn(`Tidligere spørgsmål ${i + 1}`, done([text("Et tidligere svar.")]))),
  turn("Hvem sidder i bestyrelsen?", done([text("Bestyrelsen består af tre medlemmer: Marie Louise Thomsen (formand), Søren Kjær Madsen og Jakob Bech Benediktson, som også er direktør.")])),
  turn("Hvornår kom Søren ind?", done([text("Søren Kjær Madsen indtrådte i bestyrelsen 1. marts 2022 i forbindelse med kapitaludvidelsen.")])),
  turn("Vis mig risikovurderingen", done([text("LASSO X A/S har kreditvurdering B, lav risiko. Vurderingen bygger på regnskab 2024, betalingsadfærd og ejerkredsens historik.")])),
  turn(
    "Er der røde flag?",
    done([text("Jeg har set tre ting igennem. Ingen af dem er alvorlige, men én er værd at kende:\n\n- **Konkursrelationer**, ingen aktive relationer. Info\n- **Kreditorer**, kortfristet gæld er steget markant. Mulig vigtig")]),
  ),
  turn("Hvad betyder kreditorer her?", done([text("Kreditorer er de leverandører og långivere, LASSO X A/S skylder penge på kort sigt.")])),
];
export const LONG_THREAD_PAGE = 5;

/* ---------- 11 Mobil ---------- */
export const MOBILE_THREAD: Turn[] = [
  turn("Er der røde flag?", done([text("Jeg har set tre ting igennem. Én er værd at kende:\n\n- **Konkursrelationer**, ingen aktive. Info\n- **Årets resultat**, faldt 12 % i 2024. Info\n- **Kreditorer**, steget markant siden 2023. Mulig vigtig")])),
  turn("Hvad betyder kreditorer her?", done([text("Kreditorer er de leverandører og långivere, selskabet skylder penge på kort sigt.\n\n[Risiko](lasso:modul/risiko) [Kreditorer](lasso:modul/oekonomi)")])),
];
export const MOBILE_PAGE: Turn[] = [turn("Lav et fuldt KYC-overblik", done([text("Her er en KYC-side for LASSO X A/S med ejere, PEP- og sanktionstjek, risiko og nøgletal."), view("fx-kyc", SPEC_KYC, "page")]))];

/* ---------- Sideskabelon (ejerens beslutning, erstatter D3) ---------- */
export const TEMPLATE: PageTemplate = { id: "fx-kyc", kind: "company", title: "KYC-overblik", subtitle: "Ejere, PEP- og sanktionstjek, risiko og nøgletal" };
/** "Tilføj som fane" lykkedes: tråden får rækken, og fanen står på skabelonmodulet (tab tpl:<id>) med den røde nål. */
export const TEMPLATE_ADDED = { turns: FORM_PAGE, afterTurnId: FORM_PAGE[0]!.id, notice: "Tilføjet som modul på alle virksomheder", tab: `tpl:${TEMPLATE.id}`, templates: [TEMPLATE] };
/** Den røde nål klikket: bekræftelsen "Fjern modulet?". */
export const TEMPLATE_CONFIRM = { ...TEMPLATE_ADDED, confirmOpen: true };

/** Alle scenerne med navn (designguidens rammer). */
export const SCENES = {
  anatomy: ANATOMY,
  formText: FORM_TEXT,
  formElement: FORM_ELEMENT,
  formPage: FORM_PAGE,
  stay: STAY,
  newTabBefore: NEW_TAB_BEFORE,
  newTabAfter: NEW_TAB_AFTER,
  clarify: CLARIFY,
  global: GLOBAL,
  thinking: THINKING,
  longTask: LONG_TASK,
  error: ERROR,
  longThread: LONG_THREAD,
  mobileThread: MOBILE_THREAD,
  mobileElement: FORM_ELEMENT,
  mobilePage: MOBILE_PAGE,
  templateAdded: TEMPLATE_ADDED.turns,
} as const;

/** Turene med et andet datasæt i kortene (værtens demodata). */
export function withDataset(turns: readonly Turn[], dataset: Dataset): Turn[] {
  return turns.map((t) => ({ ...t, answer: { ...t.answer, parts: t.answer.parts.map((p) => (p.kind === "view" ? { ...p, dataset } : p)) } }));
}
