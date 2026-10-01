import { useState, type ReactNode } from "react";
import type { GalleryEntry } from "../types.js";
import type { CompanyVM, ContactPersonVM, ContactVM, FinancialsVM, ScoreVM } from "@lasso/spec";
import { formatAmount, formatDate, formatNumber, formatPercent } from "@lasso/spec";
import {
  CompanyHead,
  DataState,
  Delta,
  KeyFigureCards,
  KeyFigureGauge,
  Livestock,
  PersonFacts,
  ScoreHistory,
  LassoContact,
  LassoContactPersons,
  ScoreGauge,
  Section,
  Sparkline,
  Tabs,
} from "@lasso/ui";

/* ---------- Hjælpere ---------- */

const B = "CVR-1-99000001";
const co = (title: string, components: Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({ kind: "company", title, components, ...extra });

function Stack({ children, gap = 28 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: "grid", gap }}>{children}</div>;
}
function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="lasso-small" style={{ color: "var(--lasso-text-muted)" }}>{label}</div>
      {children}
    </div>
  );
}
const noop = () => undefined;
/** Skærmbilledet tages, mens panelets 200 ms indglidning kan være i gang; slå den fra i galleriet. */
const NoAnim = () => <style>{".lasso-sidepanel{animation:none!important}"}</style>;

/* ---------- Eksempeldata til rene UI-elementer ---------- */

const BYG: CompanyVM = {
  lassoId: B,
  cvr: "99000001",
  name: "Eksempel Byg A/S",
  status: "Aktiv",
  statusKind: "active",
  form: "A/S",
  industryCode: "412000",
  industryText: "Opførelse af bygninger",
  address: { street: "Prøvevej 1", zip: "8600", city: "Silkeborg", municipality: "Silkeborg", region: "Midtjylland" },
  founded: "1998-04-01",
  employees: 64,
};
const ENERGI: CompanyVM = {
  lassoId: "CVR-1-99000011",
  cvr: "99000011",
  name: "Eksempel Energi A/S",
  status: "Under konkurs",
  statusKind: "warning",
  statusDate: "2026-06-03",
  curator: "Advokat Eksempel & Co.",
  secondaryNames: ["Eksempel Vind"],
  form: "A/S",
  industryText: "Produktion af elektricitet",
  address: { street: "Vindvej 9", zip: "6700", city: "Esbjerg" },
  founded: "2012-08-01",
  employees: 8,
};
const CAFE: CompanyVM = {
  lassoId: "CVR-1-99000009",
  cvr: "99000009",
  name: "Eksempel Café I/S",
  status: "Ophørt",
  statusKind: "inactive",
  statusDate: "2024-09-30",
  form: "I/S",
  industryText: "Caféer og barer",
  address: { street: "Torvet 1", zip: "8660", city: "Skanderborg" },
  founded: "2015-05-01",
  employees: 0,
};
const headActions = (monitoring: boolean) => ({
  monitor: { monitoring, onClick: noop },
  save: { saved: false, onClick: noop },
  exportItems: [{ id: "pdf", label: "Eksportér som PDF", onSelect: noop }],
  more: [{ id: "share", label: "Del link", onSelect: noop }],
});


/* 08.7–08.11: Papers eksempel (L75-0): LASSO X A/S med 16 kontaktpersoner i seks afdelinger. */
const LASSO_X: CompanyVM = {
  lassoId: "CVR-1-34580820",
  cvr: "34580820",
  name: "LASSO X A/S",
  status: "Aktiv",
  statusKind: "active",
  form: "A/S",
  address: { street: "Toldbodgade 37B", zip: "1253", city: "København K" },
  founded: "2012-07-01",
  employees: 16,
};
const LASSO_X_CONTACT: ContactVM = {
  lassoId: "CVR-1-34580820",
  phone: "71747812",
  email: "kontakt@lasso.dk",
  emails: ["contact@lassox.com"],
  website: "https://lassox.com",
  address: LASSO_X.address,
  verifiedNumbers: [{ phoneNumber: "71747812", score: 95, callable: true, sources: ["Website"] }],
  verifiedAt: "2026-09-20",
};
const src = [{ label: "lassox.com", url: "https://lassox.com/om-os/lasso-x" }];
const LX_PEOPLE: ContactPersonVM[] = [
  { name: "Jakob Bech Benediktson", role: "CEO", group: "Direktion", phone: "60409090", email: "jbb@lassox.com", sources: src },
  { name: "Anders Eksempel", role: "COO", group: "Direktion", phone: "60409091", email: "ae@lassox.com", sources: src },
  { name: "Jeppe Eksempel", role: "CTO", group: "Direktion", email: "je@lassox.com", sources: src },
  { name: "Mette Eksempel", role: "Markedschef for B2B", group: "Ledelse", phone: "60409092", email: "me@lassox.com" },
  { name: "Sara Eksempel", role: "Customer Success Manager", group: "Salg", email: "se@lassox.com" },
  { name: "Emil Eksempel", role: "Customer Success Manager", group: "Salg", phone: "60409093", email: "em@lassox.com" },
  { name: "Christian Eksempel", role: "Markedschef", group: "Salg", phone: "60409094", email: "ce@lassox.com" },
  { name: "Abed Eksempel", role: "Sales Lead", group: "Salg", phone: "60409095", email: "ab@lassox.com" },
  { name: "Bo Eksempel", role: "Back-End Udvikler", group: "IT-udvikling", email: "bo@lassox.com" },
  { name: "Cecilie Eksempel", role: "Front-End Udvikler", group: "IT-udvikling", email: "cc@lassox.com" },
  { name: "Dennis Eksempel", role: "Lead Developer", group: "IT-udvikling", email: "de@lassox.com" },
  { name: "Freja Eksempel", role: "Senior Front-End Udvikler", group: "IT-udvikling", email: "fe@lassox.com" },
  { name: "Gorm Eksempel", role: "Sales Consultant", group: "Konsulenter", email: "ge@lassox.com" },
  { name: "Hans Eksempel", role: "Sales Consultant", group: "Konsulenter", email: "he@lassox.com" },
  { name: "Ida Eksempel", role: "Sales Consultant", group: "Konsulenter", email: "ie@lassox.com" },
  { name: "Karin Eksempel", role: "Office Manager", group: "Øvrige", email: "ke@lassox.com" },
];
const LX_DATA = { lassoId: "CVR-1-34580820", people: LX_PEOPLE };
const LX_SHORTCUTS = [
  { id: "tvillinger", label: "Tvillinger", icon: "users" as const, onSelect: noop },
  { id: "nyheder", label: "Nyheder", icon: "news" as const, onSelect: noop },
];

function SeeAllPanel({ view = "detail", minHeight = 940 }: { view?: "list" | "detail"; minHeight?: number }) {
  // Præsentation: laget følger galleriets højde (ikke skærmbilledets 800 px), og fokusrammen fra
  // åbningen (fokus på den valgte række) tegnes ikke på det statiske billede.
  return (
    <div style={{ minHeight }}>
      <NoAnim />
      {/* Kontrol r5 (08.9): laget dækker hele billedet inkl. galleriets luft (24 px top og bund), så panelet ikke rager ud under rammen */}
      <style>{`.lasso-layer{position:absolute!important;height:${minHeight + 48}px!important}.lasso-sidepanel-wrap{position:absolute!important}.lasso-panellist__row:focus-visible{outline:none!important}`}</style>
      <LassoContactPersons
        data={LX_DATA}
        companyName="LASSO X A/S"
        company={LASSO_X}
        contact={LASSO_X_CONTACT}
        shortcuts={LX_SHORTCUTS}
        onLiveDetails={noop}
        defaultOpen={0}
        defaultView={view}
        onCopy={noop}
        onOpenLink={noop}
      />
    </div>
  );
}

function SectionTabs() {
  const items = ["Overblik", "Økonomi", "Regnskab", "Ejerskab", "Ledelse", "Risiko", "Historik", "Kontakt"].map((l) => ({ id: l.toLowerCase(), label: l }));
  const [value, setValue] = useState("overblik");
  return <CompanyHead company={BYG} actions={headActions(false)} below={<Tabs level={1} items={items} value={value} onChange={setValue} ariaLabel="Sektioner" className="lasso-headtabs" />} />;
}

/** 08.1 (Paper I4C-0 + variantrække MOR-0): navnet alene ved Aktiv; afvigende status efter navnet i farvegruppen. */
function CompanyHeads() {
  return (
    <Stack>
      <CompanyHead company={BYG} actions={headActions(false)} />
      <Labelled label="Variant: status er ikke Aktiv/Normal: status efter navnet i sin farvegruppe">
        <CompanyHead company={{ ...BYG, status: "Under konkurs", statusKind: "warning", statusDate: undefined }} actions={headActions(false)} />
      </Labelled>
    </Stack>
  );
}

function LiveNumberStates() {
  const now = Date.now();
  const base: ContactVM = { lassoId: B, phone: "86123456", email: "kontakt@eksempelbyg.dk", website: "https://eksempelbyg.dk", source: "CVR", updated: "2026-09-28" };
  const withNumbers: ContactVM = {
    ...base,
    verifiedAt: new Date(now - 5_000).toISOString(),
    verifiedNumbers: [
      { phoneNumber: "86123456", callable: true, sources: ["CVR", "Website"], score: 98 },
      { phoneNumber: "86123499", callable: true, sources: ["Website"], score: 70, expired: "2026-08-14" },
    ],
  } as ContactVM;
  const stale: ContactVM = {
    ...base,
    verifiedAt: new Date(now - 12 * 86_400_000).toISOString(),
    verifiedNumbers: [{ phoneNumber: "86123456", callable: true, sources: ["CVR"], score: 90 }],
  } as ContactVM;
  return (
    // Blokken står i kontaktkolonnens bredde (ca. 380 px), som i Paper.
    <div style={{ maxWidth: 380 }}>
    <Stack>
      {/* Jakob 01.10: ingen verificeringsnoter; kun et udgået nummer markeres. */}
      <Labelled label="Udgået nummer (gennemstreget)">
        <LassoContact contact={withNumbers} now={now} onCopy={noop} foldExtra={false} />
      </Labelled>
      <Labelled label="Verificerede numre (ingen markering)">
        <LassoContact contact={stale} now={now} onCopy={noop} foldExtra={false} />
      </Labelled>
    </Stack>
    </div>
  );
}

const Y = (year: number, revenue: number | null, grossProfit: number, profit: number, equity: number, employees: number) => ({ year, revenue, grossProfit, profit, equity, employees });
const FIN_FULL: FinancialsVM = {
  lassoId: B,
  currency: "DKK",
  years: [Y(2021, 118_000_000, 33_000_000, 3_100_000, 21_000_000, 55), Y(2022, 126_000_000, 35_400_000, 3_900_000, 23_500_000, 58), Y(2023, 131_000_000, 36_900_000, 2_800_000, 25_100_000, 61), Y(2024, 140_500_000, 38_000_000, 4_200_000, 28_300_000, 64)],
  benchmark: { label: "branche 4120", change: { omsaetning: 3.1, resultat: -1.4, egenkapital: 4.0 } },
  quality: { ansatte: "Ansatte i regnskabet (64) afviger fra CVR (58)." },
} as FinancialsVM;
const FIN_MISSING: FinancialsVM = {
  lassoId: "CVR-1-99000005",
  currency: "DKK",
  years: [Y(2023, null, 19_800_000, 2_100_000, 6_000_000, 38), Y(2024, null, 21_000_000, 2_600_000, 7_400_000, 41)],
} as FinancialsVM;

/** 10b: tre tilstandskort side om side (Paper: 352 px, samme højde). */
function StateRow({ children, height }: { children: ReactNode; height: number }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: 24 }}>
      {(Array.isArray(children) ? children : [children]).map((c, i) => (
        <div key={i} style={{ display: "flex", width: 352, minHeight: height }}>
          {c}
        </div>
      ))}
    </div>
  );
}

function ScoreStates() {
  const s = (x: Partial<ScoreVM>): ScoreVM => ({ lassoId: B, score: null, source: "Lasso", ...x }) as ScoreVM;
  // Scoremåleren tegner sin egen sektion; rammen (10b regel 1) er galleriets kort om hver tilstand.
  const card = (node: ReactNode) => <div className="lasso-framewrap" style={{ flex: 1 }}>{node}</div>;
  return (
    <StateRow height={232}>
      {card(<ScoreGauge score={s({ state: "notfetched" })} onFetch={noop} />)}
      {card(<ScoreGauge score={s({ state: "fetching" })} />)}
      {card(<ScoreGauge score={s({ state: "unavailable", reason: "Virksomheden er under konkurs. Der beregnes ikke en score for virksomheder under konkurs eller tvangsopløsning." })} />)}
    </StateRow>
  );
}

/** C6 (Ø6): låste tilstande (abonnement/modul) og ikke tilgængelige branchetal; tekster fra register.liveNote. */
function LockedStates() {
  const wrap = (node: ReactNode) => <div className="lasso-framewrap" style={{ flex: 1 }}>{node}</div>;
  const SUB = "Kræver Creditsafe-abonnement. Score og kreditvurdering vises, når Creditsafe er tilføjet Lasso-abonnementet.";
  const fin = { lassoId: B, years: [] } as unknown as FinancialsVM;
  return (
    <Stack>
      <StateRow height={200}>
        {wrap(<ScoreGauge score={{ lassoId: B, score: null, state: "unavailable", reason: SUB }} onFetch={noop} />)}
        {wrap(<ScoreHistory history={{ lassoId: B, points: [], reason: SUB }} onFetch={noop} />)}
        {wrap(<KeyFigureGauge financials={fin} industry={{ lassoId: B, state: "unavailable", reason: "Lasso har ingen branchetal for virksomhedens branche endnu.", years: [] }} />)}
      </StateRow>
      {wrap(<Livestock livestock={{ lassoId: B, herds: [], events: [], unavailableReason: "Kræver Ejendomme-modulet i Lasso-abonnementet" }} />)}
    </Stack>
  );
}

function NumberFormats() {
  const rows: [string, string][] = [
    ["Beløb, mio.", formatAmount(140_500_000)],
    ["Beløb, t. kr.", formatAmount(842_000)],
    ["Negativt beløb (ægte minus)", formatAmount(-2_300_000)],
    ["Procent med fortegn", formatPercent(7.3)],
    ["Negativ procent", formatPercent(-1.4)],
    ["Beløb, mia.", formatAmount(2_400_000_000)],
    ["Antal", formatNumber(1_234)],
    ["Dato", formatDate("2026-09-29")],
    ["Relativ tid (under 7 dage)", "for 3 dage siden"],
  ];
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "220px auto", gap: "10px 24px", margin: 0 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt className="lasso-small" style={{ color: "var(--lasso-text-muted)" }}>{k}</dt>
          <dd style={{ margin: 0, fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{v}</dd>
        </div>
      ))}
      <dt className="lasso-small" style={{ color: "var(--lasso-text-muted)" }}>Udvikling (▲ grøn, ▼ rød)</dt>
      <dd style={{ margin: 0, fontVariantNumeric: "tabular-nums", fontWeight: 500, display: "flex", gap: 16 }}>
        <Delta from={100} to={107.5} />
        <Delta from={100} to={96.6} />
      </dd>
    </dl>
  );
}

/**
 * 13.1: fem seriefarver med brugsbeskrivelse og et sjette felt "Semantik" (grøn/gul/rød i ét felt),
 * som kun bruges til vurdering, aldrig som serie. Øvrige-grå hører til 13.8 (surface-muted), ikke her.
 */
function Palette() {
  const sw: [string, string, string][] = [
    ["--lasso-chart-1", "Serie 1, koral", "virksomheden selv, seneste år"],
    ["--lasso-chart-2", "Serie 2, dyb blå", "sammenligningsvirksomhed, sekundær post"],
    ["--lasso-chart-3", "Serie 3, lys blå", "tredje serie, kortfristet gæld"],
    ["--lasso-chart-4", "Serie 4, lys koral", "tidligere år, spænd i intervaller"],
    ["--lasso-chart-5", "Serie 5, neutral", "branche og benchmark, andre virksomheder"],
  ];
  const swatch = { height: 56, borderRadius: 8, border: "1px solid var(--lasso-border)" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
      {sw.map(([v, name, use]) => (
        <div key={v} style={{ display: "grid", gap: 4, alignContent: "start" }}>
          <div style={{ ...swatch, background: `var(${v})` }} />
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{name}</div>
          <div className="lasso-small" style={{ color: "var(--lasso-muted)" }}>{use}</div>
        </div>
      ))}
      <div style={{ display: "grid", gap: 4, alignContent: "start" }}>
        <div style={{ ...swatch, display: "flex", overflow: "hidden" }}>
          <span style={{ flex: 1, background: "var(--lasso-positive)" }} />
          <span style={{ flex: 1, background: "var(--lasso-warning)" }} />
          <span style={{ flex: 1, background: "var(--lasso-negative)" }} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Semantik</div>
        <div className="lasso-small" style={{ color: "var(--lasso-muted)" }}>kun til vurdering, aldrig som serie</div>
      </div>
    </div>
  );
}

/**
 * 13.9 og 26b.7: sparkline-tilstandene som 44 px rækker med etiket, sparkline og værdi til højre.
 * Sparklinen er altid koral; krydser værdierne 0, står en stiplet nullinje; sparsøjler til
 * kvartalstal; under 3 datapunkter står "-" i stedet for en sparkline.
 */
export function SparkList({ title, rows }: { title?: string; rows: { label: string; values: number[]; value: string; kind?: "line" | "bars"; negative?: boolean }[] }) {
  return (
    <Section title={title}>
      <ul className="lasso-rows">
        {rows.map((r) => (
          <li key={r.label} className="lasso-row" style={{ minHeight: 44, padding: "6px 0" }}>
            <div className="lasso-row__main">
              <div className="lasso-row__name lasso-row__name--regular">{r.label}</div>
            </div>
            <div style={{ flex: "none", display: "flex", alignItems: "center" }}>
              <Sparkline values={r.values} tone="accent" kind={r.kind} bare />
            </div>
            <div className="lasso-row__value" style={{ minWidth: 56, color: r.negative ? "var(--lasso-negative)" : undefined }}>{r.value}</div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Sparklines() {
  return (
    <SparkList
      rows={[
        { label: "Stigende", values: [7.9, 15.5, 17.7, 17.5, 18.8], value: "18,8" },
        { label: "Krydser nul", values: [120, 64, -40, -210, -338], value: "−338", negative: true },
        { label: "Sparsøjler (ansatte pr. kvartal)", values: [14, 15, 15, 16, 17, 17, 18, 19], value: "19", kind: "bars" },
        { label: "Under 3 datapunkter - ingen sparkline", values: [4.2, 4.7], value: "4,7" },
      ]}
    />
  );
}

/* ---------- Indgange ---------- */

export const entries: GalleryEntry[] = [
  // 08 Virksomhed
  { nr: "08.1", title: "Virksomhedshoved", node: "I4C-0", render: () => <CompanyHeads />, note: "Runde 6: navnet står alene ved Aktiv/Normal; ved alle andre statusser står statussen efter navnet (14/500, 12 px) i sin farvegruppe (05.7). Navn, status og ikonknapper på én linje, lodret centreret; ingen ekstra luft under hovedet (sektionsmellemrummet følger)." },
  { nr: "08.2", title: "Sektionsfaner", node: "9S7-0", render: () => <SectionTabs />, note: "Fanerne leveres af værten (LassoView.headTabs); her tegnet med CompanyHead + Tabs niveau 1 med 8 faner." },
  { nr: "08.3", title: "Kontaktblok", node: "9SV-0", spec: co("Eksempel Byg A/S", [{ type: "LassoContact", company: B }]) },
  { nr: "08.4", title: "Genveje", node: "9TL-0", spec: co("Eksempel Byg A/S", [{ type: "LassoShortcuts", company: B }]) },
  { nr: "08.5", title: "Live-nummer (kontaktblok med realtidsverifikation)", node: "BJJ-0", render: () => <LiveNumberStates /> },
  { nr: "08.6", title: "Kontaktpersoner, blok på siden", node: "I6B-0", spec: co("Eksempel Byg A/S", [{ type: "LassoContactPersons", company: B }]) },
  {
    nr: "08.7",
    title: "Se alle-panel",
    node: "L75-0",
    render: () => <SeeAllPanel />,
    only: "desktop",
    note: "Se flere (Jakob 01.10): panelet glider ind fra højre og dækker de højre 2/3 af visningen; sidens første kolonne står synlig. Stillinger pr. afdeling i midten, den valgte person med kopiér og kilder til højre. Luk fader ud.",
  },
  {
    nr: "08.8",
    title: "Hovedvarianter (status og overvåger-tilstand)",
    node: "I50-0",
    render: () => (
      <Stack>
        <Labelled label="Konkurs/likvidation">
          <CompanyHead company={ENERGI} actions={headActions(false)} />
        </Labelled>
        <Labelled label="Overvåger-tilstand">
          <CompanyHead company={BYG} actions={headActions(true)} />
        </Labelled>
        <Labelled label="Kompakt (56 px)">
          <CompanyHead company={BYG} variant="compact" actions={headActions(false)} />
        </Labelled>
        <Labelled label="Ophørt (kompakt række)">
          <CompanyHead company={CAFE} variant="compact" actions={headActions(false)} onHistory={noop} />
        </Labelled>
      </Stack>
    ),
  },
  { nr: "08.9", title: "Se alle-panel, tablet 768", node: "MCE-0", render: () => <SeeAllPanel minHeight={760} />, only: "desktop", desktopWidth: 768 },
  { nr: "08.10", title: "Se alle-ark, mobil liste", node: "MES-0", render: () => <SeeAllPanel view="list" minHeight={760} />, only: "mobile" },
  { nr: "08.11", title: "Se alle-ark, mobil detalje", node: "MGT-0", render: () => <SeeAllPanel minHeight={760} />, only: "mobile" },

  // 09 Nøgletal
  { nr: "09.1", title: "Nøgletalskort", node: "9UM-0", spec: co("Eksempel Byg A/S", [{ type: "LassoKeyFigureCards", company: B }]) },
  { nr: "09.2", title: "Nøgle-værdi-liste", node: "9VU-0", spec: co("Eksempel Byg A/S", [{ type: "LassoKeyValueList", company: B, variant: "company" }]) },
  { nr: "09.3", title: "Talformat", node: "9XW-0", render: () => <NumberFormats />, note: "Tegnet med formatAmount/formatPercent/formatNumber/formatDate fra @lasso/spec." },
  {
    nr: "09.4",
    title: "Nøgletalskort, varianter",
    node: "BKI-0",
    note: "Henter: skeletterne er i bevægelse (et lyst skær glider fra venstre mod højre, 1,6 s; stille ved prefers-reduced-motion). Billedet her er statisk.",
    render: () => (
      <Stack>
        <Labelled label="Med sparkline, branche og kvalitetsflag (ansatte)">
          <KeyFigureCards financials={FIN_FULL} />
        </Labelled>
        <Labelled label="Henter">
          <KeyFigureCards />
        </Labelled>
        <Labelled label="Ikke oplyst (klasse B uden omsætning)">
          <KeyFigureCards financials={FIN_MISSING} metrics={["omsaetning", "bruttofortjeneste", "resultat", "ansatte"]} />
        </Labelled>
      </Stack>
    ),
  },
  {
    nr: "09.5",
    title: "Nøgle-værdi-liste med årsvælger",
    node: "9WR-0",
    spec: co("Eksempel Byg A/S", [{ type: "LassoKeyValueList", company: B, variant: "financials" }]),
    note: "Med årsrapportens PDF-link i datasættet: 'Hent regnskabet' øverst i elementet og 'Se alle' under listen (Jakob 29.09).",
    mutate: (ds) => {
      ds.financialStatements[B] = { lassoId: B, currency: "DKK", incomeStatement: [], balanceSheet: [], cashFlow: [], pdfUrl: "https://example.com/aarsrapport.pdf" };
    },
  },

  // 10 Score og tabeller
  { nr: "10.1", title: "Scoremåler", node: "9ZT-0", spec: co("Eksempel Byg A/S", [{ type: "LassoScoreGauge", company: B, width: "half" }]), note: "Måleren i en ½-kolonne som i Paper (ca. 540 px)." },
  { nr: "10.2", title: "Flerårstabel", node: "A0Q-0", spec: co("Eksempel Byg A/S", [{ type: "LassoMultiYearTable", company: B, metrics: ["omsaetning", "bruttofortjeneste", "resultat", "egenkapital"], years: 5 }]) },
  {
    nr: "10.3",
    title: "Datatilstande (fælles tilstandssprog, 10b)",
    node: "LEQ-0",
    note: "10b (Paper LDP-0): samme ramme og overskrift i alle tilstande. Henter: skelet af nøgle-værdi-listen med shimmer (1,4 s, lineært, uendeligt; stille ved prefers-reduced-motion); billedet her er statisk.",
    render: () => (
      <StateRow height={264}>
        <Section title="Risikovurdering" frame>
          <DataState state="ondemand" reason="Lassos egen vurdering ud fra regnskab, ledelse og ejerskab. Tager et par sekunder." actionLabel="Beregn risiko" onAction={noop} />
        </Section>
        <Section title="Risikovurdering" frame>
          <DataState state="loading" shape="keyvalue" note="Shimmer: lyst bånd glider venstre→højre, 1,4 s, uendeligt. Statisk ved prefers-reduced-motion." />
        </Section>
        <Section title="Risikovurdering" frame>
          <DataState state="empty" title="Ingen regnskaber endnu" reason="Virksomheden er stiftet for under et år siden. Første regnskab forventes 30.06.2027." action={{ label: "Overvåg og få besked", onClick: noop }} />
        </Section>
      </StateRow>
    ),
  },
  { nr: "10.4", title: "Scoremåler, tilstande (10b)", node: "LG2-0", note: "10b: ikke beregnet, henter (skelet af måleren med shimmer), ikke tilgængelig. Lassos risikoscore, ingen Creditsafe.", render: () => <ScoreStates /> },
  { nr: "10.5", title: "Låst og ikke tilgængelig med årsag (C6)", note: "Ø6: score og scorehistorik låst uden Creditsafe-abonnement (ingen knap), CHR låst uden Ejendomme-modulet, branchetal ikke tilgængelige med årsag.", render: () => <LockedStates /> },
  {
    nr: "16.6",
    title: "Stamoplysninger i ½ (to kolonner)",
    note: "C6/Ø13: fra ½ fordeles nøgle/værdi-rækkerne i to kolonner (container query).",
    gridWidth: 564,
    render: () => (
      <div style={{ width: 564 }}>
        <PersonFacts person={{ lassoId: "CVR-3-4000000001", name: "Mette Nielsen", zip: "8600", city: "Silkeborg", municipality: "Viborg", roles: [] } as never} />
      </div>
    ),
  },

  // 11 Personer og ejere
  {
    nr: "11.1",
    title: "Rolleliste, kompakt",
    node: "A3I-0",
    spec: co("Eksempel Byg A/S", [{ type: "LassoRelations", company: B }]),
    note: "Eksempel: flere ejere end tre, reelle ejere uden adgang og én produktionsenhed. Typografi (regel 11, Jakob 30.09): gruppenavn 13/600, navne 14/400 i tekstfarve (også i sideskabelonens kolonner), '(formand)' og 'og N flere' 13/400 muted.",
    mutate: (ds) => {
      const own = ds.ownership[B];
      if (own) {
        const base = own.owners[0]!;
        own.owners = [...own.owners, ...["Prøve Invest ApS", "Carla Prøve", "Dan Prøve", "Eva Prøve"].map((name) => ({ ...base, name, lassoId: undefined }))];
      }
      ds.errors[`beneficialOwnership:${B}`] = "Reelle ejere kræver adgang (403).";
      ds.productionUnits[B] = { lassoId: B, units: [], total: 1 };
    },
  },
  { nr: "11.2", title: "Personliste, udfoldet", node: "A4F-0", gridWidth: 564, spec: co("Eksempel Byg A/S", [{ type: "LassoPersonList", company: B, show: "all" }]) },
  { nr: "11.3", title: "Ejerliste", node: "A5X-0", spec: co("Eksempel Byg A/S", [{ type: "LassoOwnerList", company: B }]) },
  { nr: "11.4", title: "Reelle ejere", node: "B33-0", spec: co("Eksempel Byg A/S", [{ type: "LassoBeneficialOwners", company: B }]) },

  // 12 Tekst og historik
  { nr: "12.1", title: "Tekstsektioner", node: "A83-0", spec: co("Eksempel Byg A/S", [{ type: "LassoTextSections", company: B }]) },
  {
    nr: "12.2",
    title: "Resumé",
    node: "A8H-0",
    spec: co("Eksempel Byg A/S", [
      {
        type: "LassoSummary",
        title: "Vurdering",
        source: "Lasso, regnskab 2024 og CVR",
        updated: "2026-09-28",
        text:
          "Eksempel Byg A/S er en sund, mellemstor entreprenør med stabil vækst. Bruttofortjenesten er steget med 7 % om året de seneste fem år og var 38 mio. kr. i 2024, mens resultatet efter skat steg til 4,2 mio. kr.\n\nSoliditetsgraden ligger over branchens median, og egenkapitalen er vokset hvert år, fordi overskuddet i vid udstrækning er blevet i selskabet. Likviditeten er tilfredsstillende, men arbejdskapitalen er bundet i igangværende arbejder, som er typisk for branchen.\n\nEjerkredsen er stabil: Eksempel Holding ApS ejer mellem 66,67 og 89,99 %, og direktøren Anne Eksempel ejer resten. Der er ingen risikoobservationer over 50, og revisor har afgivet en blank påtegning.\n\nSamlet set er virksomheden en lav-risiko samarbejdspartner. Hold øje med ordrebeholdningen, da byggeriet generelt har vist faldende aktivitet i 2026.",
      },
    ]),
  },
  { nr: "12.3", title: "Tidslinje (CVR-ændringer)", node: "A8Z-0", spec: co("Eksempel Byg A/S", [{ type: "LassoTimeline", company: B }]) },
  {
    nr: "12.4",
    title: "Nyhedsliste",
    node: "LMF-0",
    spec: co("Eksempel Byg A/S", [{ type: "LassoNews", company: B, limit: 3 }]),
    note: "Paper LMF-0 (runde 5): kildevisning 12/16 muted, overskrift 14/500/18 som historikkens begivenhed (12.3), uddrag 13/18 klippet efter 2 linjer, virksomheden i fed i uddraget, 'Vis flere' nederst. Papers eksempeltekster.",
    mutate: (ds) => {
      const ago = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
      ds.news[B] = {
        lassoId: B,
        items: [
          {
            source: "Børsen",
            url: "https://borsen.dk/nyheder/eksempel",
            time: ago(3),
            headline: "Datavirksomhed lander aftale med finanssektoren",
            excerpt: "Aftalen giver bankerne adgang til opdaterede virksomhedsdata, oplyser Lasso X i en pressemeddelelse. Selskabet kalder aftalen en milepæl",
            extractSegments: [{ text: "Aftalen giver bankerne adgang til opdaterede virksomhedsdata, oplyser " }, { text: "Lasso X", highlight: true }, { text: " i en pressemeddelelse. Selskabet kalder aftalen en milepæl" }],
          },
          { source: "Lasso News", time: "2026-04-15", headline: "Ny årsrapport: bruttofortjenesten stiger 7,5 %", excerpt: "Skrevet ud fra regnskabet for 2025. Resultat efter skat -201 t. kr., egenkapital 3,2 mio. kr." },
          {
            source: "Tech.eu",
            url: "https://tech.eu/eksempel",
            time: "2026-01-12",
            language: "engelsk",
            headline: "Nordic data startups to watch in 2026",
            excerpt: "among the Copenhagen names, Lasso X stands out for its CVR-based risk tooling",
            extractSegments: [{ text: "among the Copenhagen names, " }, { text: "Lasso X", highlight: true }, { text: " stands out for its CVR-based risk tooling" }],
          },
          { source: "Lasso News", time: "2025-11-02", headline: "Ny direktør tiltræder", excerpt: "Skrevet ud fra CVR-registreringen." },
        ],
      };
    },
  },

  // 13 Grafer
  { nr: "13.1", title: "Seriefarver (palet)", node: "ABI-0", render: () => <Palette /> },
  { nr: "13.2", title: "Søjlegraf", node: "9YI-0", spec: co("Eksempel Byg A/S", [{ type: "LassoBarChart", company: B, metric: "bruttofortjeneste", years: 5 }]) },
  {
    nr: "13.3",
    title: "Rangliste (vandrette søjler)",
    node: "BFK-0",
    spec: { title: "Bruttofortjeneste", components: [{ type: "LassoRanking", companies: [B, "CVR-1-99000004", "CVR-1-99000008", "CVR-1-99000007", "CVR-1-99000005", "CVR-1-99000002"], metric: "bruttofortjeneste" }] },
  },
  { nr: "13.4", title: "Grupperede søjler", node: "ACE-0", spec: co("Eksempel Byg A/S", [{ type: "LassoGroupedBarChart", company: B, metrics: ["omsaetning", "bruttofortjeneste", "resultat"], years: 5 }]), note: "Hover-tilstanden (tooltip) kan ikke vises statisk på desktop; mobilen viser det faste valgfelt." },
  { nr: "13.5", title: "Stablede søjler (balance)", node: "ADW-0", spec: co("Eksempel Byg A/S", [{ type: "LassoStackedBarChart", company: B, years: 5 }]) },
  { nr: "13.6", title: "Linjegraf med benchmark", node: "AF3-0", spec: co("Eksempel Byg A/S", [{ type: "LassoLineChart", company: B, metric: "bruttofortjeneste", years: 5, benchmark: "CVR-1-99000008" }]), note: "Hover med hårlinje kan ikke vises statisk på desktop." },
  { nr: "13.7", title: "Vandfald", node: "AGI-0", spec: co("Eksempel Byg A/S", [{ type: "LassoWaterfallChart", company: B }]) },
  { nr: "13.8", title: "Fordeling (donut + andelsbjælker)", node: "AHT-0", spec: co("Eksempel Byg A/S", [{ type: "LassoShareBars", company: B, variant: "ejerkreds" }]) },
  { nr: "13.9", title: "Sparklines", node: "AJ2-0", render: () => <Sparklines /> },
  { nr: "13.10", title: "Nøgletalsmåler (interval med branchemærke)", node: "AJY-0", spec: co("Eksempel Byg A/S", [{ type: "LassoKeyFigureGauge", company: B }]) },
  { nr: "13.11", title: "Heatmap", node: "AKQ-0", spec: { title: "Aktivitet i Kunder", components: [{ type: "LassoHeatmap", list: "Kunder", months: 12 }] } },
  { nr: "13.12", title: "Kort", node: "AMO-0", spec: co("Eksempel Byg A/S", [{ type: "LassoMap", company: B }]) },
];
