import { useEffect, useRef, useState } from "react";
import type { Dataset, ShowcaseItem, ViewComponent, ViewSpec } from "@lasso/spec";
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

function Item({ item, dataset }: { item: ShowcaseItem; dataset: Dataset }) {
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEmpty((ref.current?.textContent ?? "").trim().length < 3 && !ref.current?.querySelector("svg,canvas,img")), 1500);
    return () => clearTimeout(t);
  }, []);
  const spec = { version: 2, kind: "custom", title: item.title, layout: "stack", criteria: [], components: [item.component] } as unknown as ViewSpec;
  return (
    <section className="sc-item" id={`k${item.n}`}>
      <header className="sc-head">
        <span className="sc-n">{item.n}</span>
        <div>
          <div className="sc-title">
            {item.title} <code>{item.type}</code>
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
      {empty ? <div className="sc-empty">Komponenten viser intet her: den udelades, når der ikke er data (se dataudsnittet nedenfor).</div> : null}
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

const CSS = `
.sc{font-family:"Poppins",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--bg:#f6f7f9;--card:#fff;--ink:#16181d;--mute:#5b6270;--line:#e2e5ea;--accent:#e8604c;background:var(--bg);color:var(--ink);min-height:100vh;font-family:inherit}
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
.sc-index{display:flex;flex-wrap:wrap;gap:6px;padding:12px 16px 0}
.sc-index a{font-size:12px;color:var(--mute);text-decoration:none;border:1px solid var(--line);border-radius:10px;padding:2px 8px}
`;

/** /komponenter: to faner (virksomhed og person); fanen huskes i adressen (#person), så siden kan åbnes igen. */
export function ShowcaseView({ boot }: { boot: ShowcaseBoot }) {
  const dark = usePrefersDark();
  const pick = () => (location.hash.startsWith("#person") ? "person" : "virksomhed");
  const [tab, setTab] = useState<string>(pick);
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
  const current = boot.tabs.find((t) => t.id === tab) ?? boot.tabs[0]!;
  const total = new Set(boot.tabs.flatMap((t) => t.items.map((x) => x.type))).size;
  const when = new Date(boot.generatedAt).toLocaleString("da-DK", { dateStyle: "medium", timeStyle: "short" });
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
                <button key={t.id} role="tab" className="sc-tab" aria-selected={t.id === current.id} onClick={() => (location.hash = t.id === "person" ? "person" : "virksomhed")}>
                  {t.label} ({t.items.length})
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="sc-wrap">
          <nav className="sc-index">
            {current.items.map((x) => (
              <a key={x.n} href={`#${current.id === "person" ? "person" : "virksomhed"}-k${x.n}`} onClick={(e) => { e.preventDefault(); document.getElementById(`k${x.n}`)?.scrollIntoView({ behavior: "smooth" }); }}>
                {x.n} {x.title}
              </a>
            ))}
          </nav>
          <main className="sc-list" key={current.id}>
            {current.items.map((x) => (
              <Item key={`${current.id}-${x.n}`} item={x} dataset={current.dataset} />
            ))}
          </main>
        </div>
        <Toasts />
      </div>
    </ToastProvider>
  );
}
