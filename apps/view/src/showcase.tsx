import { useCallback, useEffect, useRef, useState } from "react";
import { NO_ALTERNATIVE_REASON, PORTAL_MODULES, type ComponentType, type Dataset, type ShowcaseItem, type ViewComponent, type ViewSpec } from "@lasso/spec";
import { LassoView, ToastProvider, Toasts, type HostCapabilities } from "@lasso/ui";
import type { ShowcaseBoot } from "./boot.js";
import { usePrefersDark } from "./web.js";

/** De Lasso-ID'er, komponenten peger på (company, person, companies). */
function idsOf(c: ViewComponent): string[] {
  const x = c as { company?: string; person?: string; companies?: string[] };
  return [x.company, x.person, ...(x.companies ?? [])].filter((v): v is string => typeof v === "string");
}

/** Udsnittet af datasættet, komponenten bruger: de krævede nøgler, afgrænset til komponentens ID'er. */
export function dataSlice(item: ShowcaseItem, ds: Dataset): Record<string, unknown> {
  const ids = idsOf(item.component);
  const out: Record<string, unknown> = {};
  for (const key of item.kraeverData) {
    const v = (ds as unknown as Record<string, unknown>)[key];
    if (v && typeof v === "object" && !Array.isArray(v) && ids.length) {
      const picked = Object.fromEntries(ids.filter((id) => id in (v as object)).map((id) => [id, (v as Record<string, unknown>)[id]]));
      out[key] = Object.keys(picked).length ? picked : v;
    } else out[key] = v;
  }
  const errors = Object.entries(ds.errors ?? {}).filter(([k]) => ids.some((id) => k.includes(id)) || item.kraeverData.some((d) => k.startsWith(d)));
  if (errors.length) out["fejl"] = Object.fromEntries(errors);
  return out;
}

const json = (v: unknown, max = 6000) => {
  const s = JSON.stringify(v, null, 2) ?? "undefined";
  return s.length > max ? `${s.slice(0, max)}\n… (${s.length - max} tegn mere)` : s;
};

/** Som i Claude: knapper og handlinger tegnes (klik gør intet her), så Genveje og Opfølgning vises. */
const HOST: HostCapabilities = { prompt: true, save: true, savePage: true, refine: true, drillDown: true, export: true, monitor: true, openSection: true, verifyContact: true, refresh: true, fullscreen: true };

const LIVE: Record<string, string> = { altid: "altid live", "naar-data": "live når data findes", abonnement: "kræver abonnement", "ikke-endnu": "ikke live endnu", portal: "kun portal" };

/** Hvad komponenten reelt viste: i brug, eller hvorfor ikke. */
export type ItemStatus = { used: true } | { used: false; kind: "intet" | "ikke-tilgaengelig" | "fejl" | "tom" | "paa-forespoergsel"; reason: string };

const clean = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim();

/** Læser komponentens DOM: tom, en tilstand (ikke tilgængelig, fejl, tom, beregnes på forespørgsel) eller rigtigt indhold. */
export function statusOf(el: HTMLElement): ItemStatus {
  const text = clean(el.textContent);
  if (text.length < 3 && !el.querySelector("svg:not(.lasso-state__icon),canvas,img")) return { used: false, kind: "intet", reason: "Viser intet: komponenten udelades, når der ikke er data." };
  const state = el.querySelector<HTMLElement>(".lasso-state--unavailable, .lasso-state--error, .lasso-state--ondemand, .lasso-state-panel, .lasso-state:not(.lasso-state--positive)");
  if (!state) return { used: true };
  // En tilstand midt i en komponent med rigtigt indhold (fx én tom fane) tæller ikke: kun når tilstanden er næsten alt.
  const rest = text.length - clean(state.textContent).length;
  if (rest > 80) return { used: true };
  const reason = clean(state.textContent) || "Ingen data.";
  const cls = state.className;
  const kind = cls.includes("--unavailable") ? "ikke-tilgaengelig" : cls.includes("--error") ? "fejl" : cls.includes("--ondemand") ? "paa-forespoergsel" : "tom";
  return { used: false, kind, reason };
}

const KIND_LABEL: Record<Exclude<ItemStatus, { used: true }>["kind"], string> = {
  intet: "Viser intet",
  "ikke-tilgaengelig": "Ikke tilgængelig",
  fejl: "Fejl",
  tom: "Tom",
  "paa-forespoergsel": "Beregnes på forespørgsel",
};

function Item({ item, dataset, tabId, onStatus }: { item: ShowcaseItem; dataset: Dataset; tabId: string; onStatus?: (key: string, s: ItemStatus) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<ItemStatus | undefined>();
  useEffect(() => {
    const t = setTimeout(() => {
      if (!ref.current) return;
      const s = statusOf(ref.current);
      setStatus(s);
      onStatus?.(`${tabId}:${item.n}`, s);
    }, 1500);
    return () => clearTimeout(t);
  }, []);
  const spec = { version: 2, kind: "custom", title: item.title, layout: "stack", criteria: [], components: [item.component] } as unknown as ViewSpec;
  return (
    <section className="sc-item" id={`${tabId}-k${item.n}`}>
      <header className="sc-head">
        <span className="sc-n">{item.n}</span>
        <div>
          <div className="sc-title">
            {item.title} <code>{item.type}</code>
            {status && !status.used ? <span className="sc-badge">{KIND_LABEL[status.kind]}</span> : null}
          </div>
          <div className="sc-desc">{item.formaal}</div>
          <div className="sc-data">
            Data: {item.kraeverData.length ? item.kraeverData.join(", ") : "ingen (teksten står i props)"} · {LIVE[item.live] ?? item.live}
            {item.liveNote ? ` · ${item.liveNote}` : ""}
          </div>
        </div>
      </header>
      <div className="sc-comp" ref={ref}>
        <LassoView spec={spec} dataset={dataset} host={HOST} onAction={() => undefined} frameless />
      </div>
      {status && !status.used && status.kind === "intet" ? <div className="sc-empty">{status.reason} Se dataudsnittet nedenfor.</div> : null}
      <details className="sc-details">
        <summary>Se props og de data, komponenten fik</summary>
        <div className="sc-label">Props (det modellen sender)</div>
        <pre>{json(item.component)}</pre>
        <div className="sc-label">Data (udsnit af datasættet)</div>
        <pre>{json(dataSlice(item, dataset))}</pre>
      </details>
    </section>
  );
}

const specOf = (c: ViewComponent, title: string) => ({ version: 2, kind: "custom", title, layout: "stack", criteria: [], components: [c] }) as unknown as ViewSpec;

/**
 * Den tomme komponent med rigtige data: tegnes skjult med hver alternativ virksomhed, og den første,
 * der viser data (statusOf), vises. Ingen af dem → årsagen.
 */
function AltRender({ type, title, variants, names, dataset }: { type: ComponentType; title: string; variants: { id: string; component: ViewComponent }[]; names: Record<string, string>; dataset: Dataset }) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [chosen, setChosen] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    const t = setTimeout(() => {
      const i = refs.current.findIndex((el) => el && statusOf(el).used);
      setChosen(i >= 0 ? i : null);
    }, 1500);
    return () => clearTimeout(t);
  }, []);
  const fixed = NO_ALTERNATIVE_REASON[type];
  if (!variants.length || (fixed && type !== "LassoLivestock")) return <div className="sc-alt-none">{fixed ?? "Komponenten kan ikke vises med en anden virksomhed."}</div>;
  return (
    <>
      {chosen === undefined ? <div className="sc-alt-none">Finder en virksomhed med data …</div> : null}
      {chosen === null ? (
        <div className="sc-alt-none">
          {fixed ?? `Heller ikke ${variants.map((v) => names[v.id] ?? v.id).join(", ")} har data til komponenten lige nu.`}
        </div>
      ) : null}
      {chosen != null ? <div className="sc-alt-label">Vist med rigtige data fra {names[variants[chosen]!.id] ?? variants[chosen]!.id}</div> : null}
      {variants.map((v, i) => (
        <div key={v.id} ref={(el) => void (refs.current[i] = el)} className="sc-comp" style={chosen === i ? undefined : { position: "absolute", left: -99999, width: 1200, visibility: "hidden" }}>
          <LassoView spec={specOf(v.component, title)} dataset={dataset} host={HOST} onAction={() => undefined} frameless />
        </div>
      ))}
    </>
  );
}

const CSS = `
.sc{font-family:"Poppins",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--bg:#f6f7f9;--card:#fff;--ink:#16181d;--mute:#5b6270;--line:#e2e5ea;--accent:#e8604c;background:var(--bg);color:var(--ink);min-height:100vh}
.sc[data-theme=dark]{--bg:#101215;--card:#181b20;--ink:#eceef2;--mute:#9aa1ad;--line:#2a2f37}
.sc-top{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);padding:16px 16px 0}
.sc-wrap{max-width:1232px;margin:0 auto}
.sc-h1{font-size:20px;font-weight:600;margin:0 0 4px}
.sc-sub{color:var(--mute);font-size:13px;margin-bottom:12px}
.sc-tabs{display:flex;gap:4px}
.sc-tab{border:0;background:none;color:var(--mute);font:inherit;font-size:15px;padding:10px 14px;border-bottom:2px solid transparent;cursor:pointer}
.sc-tab[aria-selected=true]{color:var(--ink);border-bottom-color:var(--accent);font-weight:600}
.sc-list{padding:16px;display:flex;flex-direction:column;gap:24px}
.sc-item{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.sc-head{display:flex;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line)}
.sc-n{flex:none;min-width:36px;height:36px;border-radius:18px;background:var(--accent);color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:15px}
.sc-title{font-weight:600;font-size:16px}
.sc-title code{font-size:12px;color:var(--mute);font-weight:400;margin-left:6px}
.sc-desc{font-size:14px;margin-top:2px}
.sc-data{font-size:13px;color:var(--mute);margin-top:4px}
.sc-comp{padding:16px}
.sc-empty{margin:0 16px 14px;padding:10px 12px;border-radius:8px;background:var(--bg);color:var(--mute);font-size:13px}
.sc-details{border-top:1px solid var(--line);padding:10px 16px;font-size:13px}
.sc-details summary{cursor:pointer;color:var(--mute)}
.sc-label{font-weight:600;margin:10px 0 4px}
.sc-details pre{background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;overflow:auto;max-height:420px;font-size:12px;white-space:pre}
.sc-badge{display:inline-block;margin-left:8px;font-size:11px;font-weight:600;color:#8a4b00;background:#fff1dc;border-radius:10px;padding:2px 8px;vertical-align:2px}
.sc[data-theme=dark] .sc-badge{color:#ffcf8a;background:#3a2a12}
.sc-unused{padding:16px;display:flex;flex-direction:column;gap:24px}
.sc-unused h2{font-size:16px;margin:0 0 8px}
.sc-unused .sc-sum{color:var(--mute);font-size:13px;margin-bottom:8px}
.sc-table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:14px}
.sc-table th,.sc-table td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
.sc-table th{font-size:12px;color:var(--mute);font-weight:600}
.sc-table td.sc-num{width:44px;font-weight:700;color:var(--accent)}
.sc-linkbtn{border:0;background:none;color:var(--accent);font:inherit;cursor:pointer;padding:0;margin-left:6px}
.sc-table button{border:0;background:none;color:var(--accent);font:inherit;cursor:pointer;padding:0;text-align:left}
.sc-alt{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;position:relative}
.sc-alt-why{font-size:13px;color:var(--mute);margin-top:4px}
.sc-alt-label{margin:14px 16px 0;font-size:13px;font-weight:600;color:var(--accent)}
.sc-alt-none{margin:14px 16px;padding:10px 12px;border-radius:8px;background:var(--bg);color:var(--mute);font-size:13px}
.sc-portal{margin:16px auto;max-width:1760px;width:calc(100% - 32px);background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.sc-portal__bar{display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid var(--line);padding:0 8px}
.sc-portal__mod{border:0;background:none;font:inherit;font-size:14px;font-weight:600;color:var(--ink);padding:16px 12px;border-bottom:2px solid transparent;white-space:nowrap;cursor:pointer}
.sc-portal__mod[aria-current=page]{color:var(--accent);border-bottom-color:var(--accent)}
.sc-portal__mod:disabled{color:var(--mute);opacity:.55;cursor:default}
.sc-portal__page{padding:8px 0}
/* Lasso-siden (Jakob 30.09): mere luft fra tekst til kolonnernes kanter i begge sider (40 px i stedet for 24/0). */
.sc-portal__page .lasso-columns > .lasso-column > .lasso-column__item{padding-left:40px;padding-right:40px}
.sc-portal__page{padding-left:0;padding-right:0}
/* Højre kolonne: værdien står tæt på nøglen (fast nøglekolonne, venstrestillet tal) i stedet for yderst til højre. */
.sc-portal__page .lasso-column:last-child .lasso-kv-row__label{width:200px;flex:none}
.sc-portal__page .lasso-column:last-child .lasso-kv-list--financials .lasso-kv-row__value{text-align:left;flex:1}
/* Samme vægt på navnene i Relationer som på al anden brødtekst på siden (06.1-reglen gav 500). */
.sc-portal__page .lasso-content--columns .lasso-relations__name{font-weight:400}
.sc-wait{color:var(--mute);font-size:14px;padding:16px}
.sc-index{display:flex;flex-wrap:wrap;gap:6px;padding:12px 16px 0}
.sc-index a{font-size:12px;color:var(--mute);text-decoration:none;border:1px solid var(--line);border-radius:10px;padding:2px 8px}
`;

type TabId = "virksomhed" | "person" | "ikke-i-brug" | "lasso-side";
const TAB_IDS: TabId[] = ["virksomhed", "person", "ikke-i-brug", "lasso-side"];

/**
 * Fanen "Lasso-side": Lassos virksomhedsside (portalen) genskabt af komponenterne. Modulbjælken som
 * i portalen; Overblik og Stamoplysninger er genskabt, de øvrige moduler står dæmpet.
 */
function PortalView({ portal }: { portal: ShowcaseBoot["portal"] }) {
  const pick = () => (location.hash.includes("stamoplysninger") ? "stamoplysninger" : "overblik");
  const [page, setPage] = useState<string>(pick);
  useEffect(() => {
    const on = () => setPage(pick());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const current = portal.pages.find((p) => p.id === page) ?? portal.pages[0]!;
  const spec = { version: 2, kind: "company", title: portal.name, layout: current.layout, ...(current.columns ? { columns: current.columns } : {}), criteria: [], components: current.components } as unknown as ViewSpec;
  return (
    <div className="sc-portal">
      <nav className="sc-portal__bar" aria-label="Moduler">
        {PORTAL_MODULES.map((m) => {
          const id = m.toLowerCase();
          const live = portal.pages.some((p) => p.id === id);
          return (
            <button key={m} className="sc-portal__mod" aria-current={id === current.id ? "page" : undefined} disabled={!live} title={live ? undefined : "Ikke genskabt endnu"} onClick={() => (location.hash = `lasso-side/${id}`)}>
              {m}
            </button>
          );
        })}
      </nav>
      <div className={`sc-portal__page sc-portal__page--${current.id}`} key={current.id}>
        <LassoView spec={spec} dataset={current.dataset} host={HOST} onAction={() => undefined} frameless />
      </div>
    </div>
  );
}

/** /komponenter: to faner (virksomhed og person) og en tredje med de komponenter, der ikke er i brug; fanen huskes i adressen. */
export function ShowcaseView({ boot }: { boot: ShowcaseBoot }) {
  const dark = usePrefersDark();
  const pick = (): TabId => TAB_IDS.find((t) => location.hash.slice(1).startsWith(t)) ?? "virksomhed";
  const [tab, setTab] = useState<TabId>(pick);
  const [statuses, setStatuses] = useState<Record<string, ItemStatus>>({});
  const onStatus = useCallback((key: string, st: ItemStatus) => setStatuses((prev) => ({ ...prev, [key]: st })), []);
  useEffect(() => {
    document.body.style.background = dark ? "#101215" : "#f6f7f9";
    const on = () => setTab(pick());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, [dark]);
  // Komponenter med faner (fx regnskabet) ruller sig selv i syne ved første tegning; siden skal starte
  // øverst, indtil brugeren selv ruller.
  useEffect(() => {
    let user = false;
    const mark = () => (user = true);
    const events = ["wheel", "touchstart", "keydown", "mousedown"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const timers = [50, 400, 1200, 2000].map((ms) => setTimeout(() => !user && window.scrollTo(0, 0), ms));
    return () => {
      timers.forEach(clearTimeout);
      events.forEach((e) => window.removeEventListener(e, mark));
    };
  }, [tab]);
  const total = new Set(boot.tabs.flatMap((t) => t.items.map((x) => x.type))).size;
  const allItems = boot.tabs.reduce((n, t) => n + t.items.length, 0);
  const measured = Object.keys(statuses).length;
  const unused = boot.tabs.map((t) => ({ tab: t, rows: t.items.flatMap((x) => { const st = statuses[`${t.id}:${x.n}`]; return st && !st.used ? [{ item: x, st }] : []; }) }));
  const unusedCount = unused.reduce((n, u) => n + u.rows.length, 0);
  const when = new Date(boot.generatedAt).toLocaleString("da-DK", { dateStyle: "medium", timeStyle: "short" });
  const go = (tabId: string, n: number) => {
    location.hash = tabId;
    setTimeout(() => document.getElementById(`${tabId}-k${n}`)?.scrollIntoView({ behavior: "smooth" }), 2100);
  };
  const current = boot.tabs.find((t) => t.id === tab);
  const altNames: Record<string, string> = Object.fromEntries([
    ...boot.alt.companies.map((c) => [c.id, c.name]),
    ...Object.values(boot.alt.dataset.companies).map((c) => [c.lassoId, c.name]),
    [boot.tabs[0]!.entity, boot.tabs[0]!.label],
  ]);
  return (
    <ToastProvider container={false}>
      <style>{CSS}</style>
      <div className="sc lasso-root" data-theme={dark ? "dark" : "light"}>
        <div className="sc-top">
          <div className="sc-wrap">
            <h1 className="sc-h1">Lassos komponenter med live-data</h1>
            <div className="sc-sub">
              {total} komponenter, nummereret efter kataloget. Data hentet {when}; <a href="?frisk=1">hent igen</a>.
            </div>
            <div className="sc-tabs" role="tablist">
              {boot.tabs.map((t) => (
                <button key={t.id} role="tab" className="sc-tab" aria-selected={t.id === tab} onClick={() => (location.hash = t.id)}>
                  {t.label} ({t.items.length})
                </button>
              ))}
              <button role="tab" className="sc-tab" aria-selected={tab === "ikke-i-brug"} onClick={() => (location.hash = "ikke-i-brug")}>
                Ikke i brug ({measured < allItems ? "…" : unusedCount})
              </button>
              <button role="tab" className="sc-tab" aria-selected={tab === "lasso-side"} onClick={() => (location.hash = "lasso-side")}>
                Lasso-side
              </button>
            </div>
          </div>
        </div>
        <div className="sc-wrap">
          {current ? (
            <nav className="sc-index">
              {current.items.map((x) => (
                <a key={x.n} href={`#${current.id}-k${x.n}`} onClick={(e) => { e.preventDefault(); document.getElementById(`${current.id}-k${x.n}`)?.scrollIntoView({ behavior: "smooth" }); }}>
                  {x.n} {x.title}
                </a>
              ))}
            </nav>
          ) : null}
          {/* Begge faner tegnes altid (kun den valgte vises), så fanen "Ikke i brug" kender alle komponenters status. */}
          {boot.tabs.map((t) => (
            <main className="sc-list" key={t.id} style={t.id === tab ? undefined : { display: "none" }}>
              {t.items.map((x) => (
                <Item key={`${t.id}-${x.n}`} item={x} dataset={t.dataset} tabId={t.id} onStatus={onStatus} />
              ))}
            </main>
          ))}
          {tab === "ikke-i-brug" ? (
            <div className="sc-unused">
              {measured < allItems ? <div className="sc-wait">Tjekker komponenterne …</div> : null}
              <section>
                <h2>Sammenligning af rigtige virksomheder</h2>
                <div className="sc-sum">Komponenterne til flere virksomheder, vist med {boot.alt.compare.length ? [...new Set(boot.alt.compare.flatMap((x) => { const c = x.component as { companies?: string[]; company?: string; benchmark?: string }; return c.companies ?? [c.company, c.benchmark]; }))].filter(Boolean).map((id) => altNames[id!] ?? id).join(", ") : ""}.</div>
                <div className="sc-list" style={{ padding: 0 }}>
                  {boot.alt.compare.map((x) => (
                    <Item key={`cmp-${x.n}`} item={x} dataset={boot.alt.dataset} tabId="sammenligning" />
                  ))}
                </div>
              </section>
              {unused.map(({ tab: t, rows }) => (
                <section key={t.id}>
                  <h2>{t.label}</h2>
                  <div className="sc-sum">
                    {rows.length} af {t.items.length} komponenter viser ikke data for {t.label}; {t.items.length - rows.length} er i brug.
                  </div>
                  {rows.map(({ item, st }) => (
                    <div key={item.n} className="sc-alt" id={`ikke-i-brug-k${item.n}`}>
                      <header className="sc-head">
                        <span className="sc-n">{item.n}</span>
                        <div>
                          <div className="sc-title">
                            {item.title} <code>{item.type}</code>
                            <span className="sc-badge">{KIND_LABEL[st.kind]}</span>
                          </div>
                          <div className="sc-desc">{item.formaal}</div>
                          <div className="sc-alt-why">
                            Hos {t.label}: {st.reason} <button className="sc-linkbtn" onClick={() => go(t.id, item.n)}>Se på fanen</button>
                          </div>
                        </div>
                      </header>
                      {t.id === "virksomhed" ? (
                        <AltRender type={item.type} title={item.title} variants={boot.alt.variants[item.type] ?? []} names={altNames} dataset={boot.alt.dataset} />
                      ) : (
                        <div className="sc-alt-none">{NO_ALTERNATIVE_REASON[item.type] ?? "Personkomponenterne vises kun for Jakob Bech Benediktson."}</div>
                      )}
                    </div>
                  ))}
                </section>
              ))}
            </div>
          ) : null}
        </div>
        {/* Lasso-siden bruger hele skærmbredden som portalen (ikke sidens 1232 px), så tre kolonner får plads. */}
        {tab === "lasso-side" ? <PortalView portal={boot.portal} /> : null}
        <Toasts />
      </div>
    </ToastProvider>
  );
}
