import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GRID_RULES, TYPE_WIDTH_FULL, WIDTHS, type ComponentType, type Width } from "@lasso/spec";
import type { Ctx } from "../App.js";
import { Frame } from "../Frame.js";
import { ENTRIES } from "../gallery.js";
import type { Report } from "../inspect.js";
import { ModuleView, reportKey, showsData, STATE_LABEL, stateDataset, useReports, type DataOption, type ModuleInfo, type StateMode } from "../modules.js";
import { dataSlice } from "../../showcase.js";
import { SOURCE } from "../source.js";
import { allowedWidths, slugOf, VIEWPORTS, WIDTH_LABEL, WIDTH_NAME, WIDTH_PX, type Viewport } from "../structure.js";
import { Chip, PageHead, ReportChip, Seg, SourceRef, Tabs, Toggle } from "../ui.js";
import { CommentButton, type CommentTarget } from "../comments.js";
import { LIVE_LABEL, PROFILE_LABEL } from "./Modules.js";

type TabId = "bredder" | "tilstande" | "tekster" | "brug" | "data";

const HEIGHT_LABEL: Record<string, string> = { low: "Lav (≤ 176 px)", medium: "Mellem (177–320 px)", high: "Høj (321–640 px)", "very-high": "Meget høj (> 640 px)" };
const ROUTE_LABEL: Record<string, string> = { ask: "Spørgsmål (topic)", focus: "Fokus i show_company", person: "show_person", render_view: "render_view", search_companies: "search_companies", search_persons: "search_persons", compare_companies: "compare_companies", saved: "Gemte sider" };

/** Variantundtagelser fra gitterreglen: widthOf i packages/spec/src/spec.ts og komponisten (compose.ts). */
const VARIANT_WIDTH_NOTES: Partial<Record<ComponentType, string>> = {
  LassoTimeline: "Med filterColumn: true står tidslinjen altid i fuld bredde (filtre ¼ + strøm ¾).",
  LassoNews: "Med layout 'grid' står nyhederne i fuld bredde som kortgitter i to kolonner (når width ikke er sat).",
  LassoFinancialStatements: "show_company focus regnskab lægger regnskabet i fuld bredde som egen række.",
};

/** Hvor modulet står uden for gitterreglen (GRID_RULES): fuld bredde på spørgsmålssider og i bestemte varianter. */
function widthExceptions(type: ComponentType): string[] {
  const rule = GRID_RULES[type];
  const out: string[] = [];
  if (TYPE_WIDTH_FULL.has(type)) {
    const beyond = rule && rule.max !== "full" ? `, selv om gitterreglen ellers giver højst ${WIDTH_LABEL[rule.max]}` : "";
    out.push(`Står i fuld bredde som egen række på spørgsmålssider (show_company og show_person med et spørgsmål)${beyond}.`);
  }
  const variant = VARIANT_WIDTH_NOTES[type];
  if (variant) out.push(variant);
  return out;
}

/** Én ramme med modulet, dets mål og valideringens resultat. */
function ModuleFrame({
  m,
  option,
  vp,
  width,
  mode = "fyldt",
  caption,
  tags,
  theme,
  mark,
  fit,
}: {
  m: ModuleInfo;
  option: DataOption;
  vp: Viewport;
  width?: Width;
  mode?: StateMode;
  caption: ReactNode;
  tags?: ReactNode;
  theme: "light" | "dark";
  mark: boolean;
  fit: boolean;
}) {
  const { reports, put } = useReports();
  const key = reportKey(m.type, vp.id, width ?? GRID_RULES[m.type]?.std ?? "full", option.id, mode);
  const dataset = useMemo(() => stateDataset(option.dataset, option.component, m.catalog.register?.kraeverData ?? m.item?.kraeverData ?? [], mode), [option, m, mode]);
  const report = reports[key];
  const w = width ?? GRID_RULES[m.type]?.std ?? "full";
  const comment: CommentTarget = {
    target: `modul:${m.type}:${vp.id}:${w}:${mode}`,
    label: `${m.n} ${m.title}, ${vp.label} ${vp.vw}, ${WIDTH_LABEL[w]} (${report?.cellWidth ?? WIDTH_PX[w]} px), ${STATE_LABEL[mode].toLowerCase()}`,
    context: { kind: "modul", ref: m.type, viewport: vp.id, vw: vp.vw, width: w, mode, data: option.label },
  };
  return (
    <figure className={`dg-mframe${report?.verdict === "problem" ? " is-problem" : ""}`}>
      <figcaption className="dg-mframe__cap">
        <span className="dg-mframe__title">{caption}</span>
        {tags}
        <span className="dg-mframe__grow" />
        {report ? <span className="dg-meta">{report.cellWidth} px</span> : null}
        <ReportChip report={report} />
        <CommentButton target={comment} small />
      </figcaption>
      <Frame vw={vp.vw} crop=".lasso-cell" mark={mark} fit={fit} comment={comment} onReport={(r: Report) => put(key, r)} label={`${m.title}, ${vp.label} ${vp.vw}${width ? `, ${WIDTH_NAME[width]}` : ""}`}>
        <ModuleView component={option.component} dataset={dataset} title={m.title} width={width} theme={theme} />
      </Frame>
      {report && report.findings.some((f) => f.kind !== "state") ? (
        <ul className="dg-findings">
          {report.findings
            .filter((f) => f.kind !== "state")
            .map((f, i) => (
              <li key={i} className={`dg-finding dg-finding--${f.kind}`}>
                {f.text}
              </li>
            ))}
        </ul>
      ) : null}
    </figure>
  );
}

function WidthsTab({ m, option, theme, mark, fit, outside }: { m: ModuleInfo; option: DataOption; theme: "light" | "dark"; mark: boolean; fit: boolean; outside: boolean }) {
  const rule = GRID_RULES[m.type];
  const allowed = allowedWidths(m.type);
  const widths = outside ? [...WIDTHS] : allowed;
  const exceptions = widthExceptions(m.type);
  const desktop = VIEWPORTS.find((v) => v.id === "desktop")!;
  const others = VIEWPORTS.filter((v) => v.id !== "desktop");
  return (
    <>
      <section className="dg-section">
        <div className="dg-h2row">
          <h2 className="dg-h2">Bredder på gitteret</h2>
          <span className="dg-meta">
            Desktop {desktop.vw} px. {desktop.note}. Modulet må stå fra {WIDTH_LABEL[rule?.min ?? "full"]} til {WIDTH_LABEL[rule?.max ?? "full"]}; standard er {WIDTH_LABEL[rule?.std ?? "full"]}.
          </span>
        </div>
        {exceptions.length ? <p className="dg-note">Undtagelser fra reglen: {exceptions.join(" ")}</p> : null}
        <div className="dg-mframes">
          {widths.map((w) => (
            <ModuleFrame
              key={w}
              m={m}
              option={option}
              vp={desktop}
              width={w}
              theme={theme}
              mark={mark}
              fit={fit}
              caption={
                <>
                  <strong>{WIDTH_LABEL[w]}</strong> {WIDTH_NAME[w].toLowerCase()}, {WIDTH_PX[w]} px
                </>
              }
              tags={
                <>
                  {w === rule?.std ? <Chip tone="accent">Standard</Chip> : null}
                  {!allowed.includes(w) ? <Chip tone="muted">Uden for reglen</Chip> : null}
                </>
              }
            />
          ))}
        </div>
      </section>
      <section className="dg-section">
        <div className="dg-h2row">
          <h2 className="dg-h2">På andre skærme</h2>
          <span className="dg-meta">Standardbredden, som siden folder den på hver skærm.</span>
        </div>
        <div className="dg-mframes dg-mframes--screens">
          {others.map((vp) => (
            <ModuleFrame
              key={vp.id}
              m={m}
              option={option}
              vp={vp}
              width={rule?.std}
              theme={theme}
              mark={mark}
              fit={fit}
              caption={
                <>
                  <strong>{vp.label}</strong> {vp.vw} px
                </>
              }
              tags={<span className="dg-meta">{vp.note}</span>}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function StatesTab({ m, option, theme, mark, fit }: { m: ModuleInfo; option: DataOption; theme: "light" | "dark"; mark: boolean; fit: boolean }) {
  const rule = GRID_RULES[m.type];
  const desktop = VIEWPORTS.find((v) => v.id === "desktop")!;
  const mobil = VIEWPORTS.find((v) => v.id === "mobil")!;
  // Moduler uden egne data (fx genveje og opfølgningsknapper) ser ens ud i alle tilstande; de vises kun fyldt.
  const fetches = (SOURCE.errPrefixes[m.type]?.length ?? 0) > 0;
  const modes: StateMode[] = fetches ? ["fyldt", "henter", "fejl", "ingen-adgang"] : ["fyldt"];
  return (
    <>
      <section className="dg-section">
        <div className="dg-h2row">
          <h2 className="dg-h2">Tilstande</h2>
          <span className="dg-meta">
            {fetches
              ? "Med data, henter, fejl og ingen adgang. Henter er lavet ved at fjerne modulets data, fejl og ingen adgang ved også at sætte en fejl på modulets datanøgler. Tomme udfald og \u201cIkke oplyst\u201d ses med de andre virksomheder nedenfor."
              : "Modulet henter ingen data og ser ens ud i alle tilstande, så kun den fyldte vises."}
          </span>
        </div>
        <div className="dg-mframes dg-mframes--states">
          {modes.map((mode) => (
            <ModuleFrame key={mode} m={m} option={option} vp={desktop} width={rule?.std} mode={mode} theme={theme} mark={mark} fit={fit} caption={<strong>{STATE_LABEL[mode]}</strong>} tags={<span className="dg-meta">Desktop, {WIDTH_LABEL[rule?.std ?? "full"]}</span>} />
          ))}
          {modes.map((mode) => (
            <ModuleFrame key={`m-${mode}`} m={m} option={option} vp={mobil} width={rule?.std} mode={mode} theme={theme} mark={mark} fit={fit} caption={<strong>{STATE_LABEL[mode]}</strong>} tags={<span className="dg-meta">Mobil 390</span>} />
          ))}
        </div>
      </section>
      <section className="dg-section">
        <div className="dg-h2row">
          <h2 className="dg-h2">Med andre rigtige data</h2>
          <span className="dg-meta">Samme modul med hver datakilde, så man ser både fyldte og tomme udfald.</span>
        </div>
        {m.noAlternative ? <p className="dg-note">{m.noAlternative}</p> : null}
        <div className="dg-mframes">
          {m.options.map((o) => (
            <ModuleFrame key={o.id} m={m} option={o} vp={desktop} width={rule?.std} theme={theme} mark={mark} fit={fit} caption={<strong>{o.label}</strong>} tags={<span className="dg-meta">Desktop, {WIDTH_LABEL[rule?.std ?? "full"]}</span>} />
          ))}
        </div>
      </section>
    </>
  );
}

const KIND_LABEL: Record<string, string> = { jsx: "Synlig tekst", attr: "Attribut", str: "Tekst i koden" };

export function TextList({ texts }: { texts: typeof SOURCE.texts }) {
  const byFile = new Map<string, typeof texts>();
  for (const t of texts) byFile.set(t.f, [...(byFile.get(t.f) ?? []), t]);
  return (
    <div className="dg-texts">
      {[...byFile.entries()].map(([file, list]) => (
        <section key={file} className="dg-texts__file">
          <div className="dg-texts__filehead">
            <SourceRef file={file} />
            <span className="dg-meta">{list.length} tekster</span>
          </div>
          <ul className="dg-texts__list">
            {list.map((t, i) => (
              <li key={i} className="dg-text">
                <span className="dg-text__t">{t.t.split(/(\{[^}]*\})/).map((part, k) => (part.startsWith("{") ? <span key={k} className="dg-text__var" title={part}>{"…"}</span> : part))}</span>
                <span className="dg-text__meta">
                  {t.a ? <code>{t.a}</code> : <span>{KIND_LABEL[t.k]}</span>}
                  <span>linje {t.l}</span>
                  <CommentButton small target={{ target: `tekst:${t.f}:${t.l}:${t.t.slice(0, 80)}`, label: `Tekst "${t.t.slice(0, 80)}" (${t.f.split("/").pop()}:${t.l})`, context: { kind: "tekst", ref: `${t.f}:${t.l}` } }} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TextsTab({ m }: { m: ModuleInfo }) {
  const files = SOURCE.componentFiles[m.type] ?? [];
  const texts = SOURCE.texts.filter((t) => files.includes(t.f));
  const reg = m.catalog.register;
  return (
    <>
      <section className="dg-section">
        <h2 className="dg-h2">Katalogtekster</h2>
        <p className="dg-p">Det, modellen og dokumentationen siger om modulet (packages/spec/src/catalog.ts og registeret).</p>
        <dl className="dg-facts">
          <dt>Titel</dt>
          <dd>{m.title}</dd>
          {reg ? (
            <>
              <dt>Formål</dt>
              <dd>{reg.formaal}</dd>
            </>
          ) : null}
          {reg?.liveNote ? (
            <>
              <dt>Tom eller låst tilstand</dt>
              <dd>{reg.liveNote}</dd>
            </>
          ) : null}
          {m.noAlternative ? (
            <>
              <dt>Uden data</dt>
              <dd>{m.noAlternative}</dd>
            </>
          ) : null}
        </dl>
      </section>
      <section className="dg-section">
        <div className="dg-h2row">
          <h2 className="dg-h2">Tekster i modulet</h2>
          <span className="dg-meta">
            {texts.length} tekster fra {files.length} {files.length === 1 ? "fil" : "filer"}. … står for en værdi, der sættes ind. Fælles tekster (tilstande, knapper) står under <a href="#/tekster">Tekster</a>.
          </span>
        </div>
        {texts.length ? <TextList texts={texts} /> : <p className="dg-note">Modulet har ingen egne tekster; teksten kommer fra data eller fra fælles komponenter.</p>}
      </section>
    </>
  );
}

function UsageTab({ m }: { m: ModuleInfo }) {
  const reg = m.catalog.register;
  const rule = GRID_RULES[m.type];
  const inGallery = ENTRIES.map((e, i) => ({ e, i })).filter(({ e }) => ((e.spec as { components?: { type: string }[] } | undefined)?.components ?? []).some((c) => c.type === m.type));
  return (
    <div className="dg-usage">
      <section className="dg-section">
        <h2 className="dg-h2">Brug det til</h2>
        <ul className="dg-list dg-list--do">{(reg?.bedstTil ?? []).map((x) => <li key={x}>{x}</li>)}</ul>
        <h2 className="dg-h2">Brug noget andet, når</h2>
        <ul className="dg-list dg-list--dont">{(reg?.undgaaNaar ?? []).map((x) => <li key={x}>{x}</li>)}</ul>
      </section>
      <section className="dg-section">
        <h2 className="dg-h2">Plads i gitteret</h2>
        <dl className="dg-facts">
          <dt>Standardbredde</dt>
          <dd>{rule ? `${WIDTH_LABEL[rule.std]} (${WIDTH_PX[rule.std]} px på 1200)` : "Fuld"}</dd>
          <dt>Min og maks</dt>
          <dd>{rule ? `${WIDTH_LABEL[rule.min]} til ${WIDTH_LABEL[rule.max]}` : "-"}</dd>
          {widthExceptions(m.type).length ? (
            <>
              <dt>Undtagelser</dt>
              <dd>{widthExceptions(m.type).join(" ")}</dd>
            </>
          ) : null}
          <dt>Højde</dt>
          <dd>
            {rule ? HEIGHT_LABEL[rule.height] : "-"}, {rule?.behavior === "growing" ? "vokser med data" : "fast"}
            {rule?.flex ? `, kan fylde restplads (${rule.flex})` : ""}
          </dd>
          <dt>Breddeprofil</dt>
          <dd>
            {reg ? PROFILE_LABEL[reg.bredde.profil] : "-"}
            {reg?.bredde.drivere ? `: ${Object.entries(reg.bredde.drivere).map(([k, v]) => `${k} ${v}`).join(", ")}` : ""}
          </dd>
        </dl>
      </section>
      <section className="dg-section">
        <h2 className="dg-h2">Data og veje ind</h2>
        <dl className="dg-facts">
          <dt>Kræver data</dt>
          <dd>{reg?.kraeverData.length ? reg.kraeverData.join(", ") : "Ingen (teksten står i props)"}</dd>
          <dt>Live</dt>
          <dd>
            {reg ? LIVE_LABEL[reg.live] : "-"}
            {reg?.liveNote ? `. ${reg.liveNote}` : ""}
          </dd>
          <dt>Veje ind</dt>
          <dd>{(reg?.veje ?? []).map((v) => ROUTE_LABEL[v] ?? v).join(", ") || "-"}</dd>
          <dt>Kildefiler</dt>
          <dd className="dg-srcs">
            {(SOURCE.componentFiles[m.type] ?? []).map((f) => (
              <SourceRef key={f} file={f} />
            ))}
          </dd>
        </dl>
      </section>
      {inGallery.length ? (
        <section className="dg-section">
          <h2 className="dg-h2">I galleriet</h2>
          <div className="dg-jump">
            {inGallery.map(({ e }) => (
              <a key={e.nr + e.title} href={`#/galleri/${(e.sortAs ?? e.nr).split(".")[0]}?e=${encodeURIComponent(e.nr)}`}>
                {e.nr} {e.title}
              </a>
            ))}
          </div>
        </section>
      ) : null}
      <section className="dg-section">
        <h2 className="dg-h2">Katalogbeskrivelse</h2>
        <p className="dg-p dg-p--small">Teksten, modellen får i værktøjsbeskrivelsen, og modulets props.</p>
        <pre className="dg-pre">{m.catalog.description}</pre>
        <pre className="dg-pre">{m.catalog.props}</pre>
      </section>
    </div>
  );
}

function DataTab({ m, option }: { m: ModuleInfo; option: DataOption }) {
  const json = (v: unknown, max = 20000) => {
    const s = JSON.stringify(v, null, 2) ?? "undefined";
    return s.length > max ? `${s.slice(0, max)}\n… (${(s.length - max).toLocaleString("da-DK")} tegn mere)` : s;
  };
  return (
    <div className="dg-split">
      <section>
        <h2 className="dg-h2">Props</h2>
        <p className="dg-p dg-p--small">Det, modellen sender for modulet.</p>
        <pre className="dg-pre">{json(option.component)}</pre>
      </section>
      <section>
        <h2 className="dg-h2">Data</h2>
        <p className="dg-p dg-p--small">Udsnittet af datasættet, modulet får ({option.label}).</p>
        <pre className="dg-pre">{m.item ? json(dataSlice(m.item, option.dataset)) : "Ingen data."}</pre>
      </section>
    </div>
  );
}

export function ModulePage({ ctx, module: m, tab }: { ctx: Ctx; module: ModuleInfo; tab: string }) {
  const [optionId, setOptionIdState] = useState(m.options[0]?.id ?? "");
  // Automatisk valg: viser en datakilde ikke modulet i brug (tom, fejl, intet), prøves den næste, til sidst
  // de fiktive data. Stopper, så snart brugeren selv vælger.
  const [auto, setAuto] = useState(true);
  const setOptionId = (id: string) => {
    setAuto(false);
    setOptionIdState(id);
  };
  const { reports, put } = useReports();
  const std = GRID_RULES[m.type]?.std ?? "full";
  const keyOf = (o: DataOption) => reportKey(m.type, "desktop", std, o.id);
  // Alle datakilder prøves samtidig i baggrunden (desktop, standardbredde); den første i rækkefølgen, der
  // viser modulet i brug, vælges. Ingen af dem → den første (modulets tomme tilstand).
  useEffect(() => {
    if (!auto) return;
    for (const o of m.options) {
      const r = reports[keyOf(o)];
      if (!r) return;
      if (showsData(r)) {
        setOptionIdState(o.id);
        setAuto(false);
        return;
      }
    }
    setAuto(false);
  }, [auto, reports]);
  const [mark, setMark] = useState(true);
  const [fit, setFit] = useState(true);
  const [outside, setOutside] = useState(false);
  const option = m.options.find((o) => o.id === optionId) ?? m.options[0];
  const rule = GRID_RULES[m.type];
  const reg = m.catalog.register;
  const current = (["bredder", "tilstande", "tekster", "brug", "data"] as TabId[]).includes(tab as TabId) ? (tab as TabId) : "bredder";
  const setTab = (t: TabId) => (location.hash = `#/moduler/${slugOf(m.type)}?fane=${t}`);
  const texts = SOURCE.texts.filter((t) => (SOURCE.componentFiles[m.type] ?? []).includes(t.f)).length;
  const all = [...ctx.modules.values()].sort((a, b) => a.n - b.n);
  const idx = all.findIndex((x) => x.type === m.type);
  const prev = all[idx - 1];
  const next = all[idx + 1];
  return (
    <div className="dg-page dg-page--wide">
      <PageHead eyebrow={<>Modul {m.n}</>} title={m.title} lead={reg?.formaal}>
        <div className="dg-headmeta">
          <code className="dg-typecode">{m.type}</code>
          {m.catalog.udgaaet ? (
            <Chip tone="muted" title="Udgået: modellen vælger den ikke, og show_company/show_person bruger den ikke længere. Typen findes stadig, så gemte visninger kan læses.">
              Udgået
            </Chip>
          ) : null}
          {rule ? <Chip>Standard {WIDTH_LABEL[rule.std]}</Chip> : null}
          {rule ? <Chip>
            {WIDTH_LABEL[rule.min]} til {WIDTH_LABEL[rule.max]}
          </Chip> : null}
          {reg ? <Chip>{PROFILE_LABEL[reg.bredde.profil]} profil</Chip> : null}
          {reg ? <Chip tone={reg.live === "altid" || reg.live === "naar-data" ? "plain" : "info"}>{LIVE_LABEL[reg.live]}</Chip> : null}
        </div>
      </PageHead>
      <Tabs
        value={current}
        onChange={setTab}
        items={[
          { id: "bredder", label: "Bredder" },
          { id: "tilstande", label: "Tilstande og udfald" },
          { id: "tekster", label: `Tekster (${texts})` },
          { id: "brug", label: "Brug og regler" },
          { id: "data", label: "Props og data" },
        ]}
      />
      {!option ? (
        <p className="dg-note">Modulet har ingen rigtige data i designguiden endnu. {m.noAlternative ?? ""}</p>
      ) : (
        <>
          {current === "bredder" || current === "tilstande" || current === "data" ? (
            <div className="dg-controls">
              <label className="dg-field">
                <span>Data</span>
                <select className="dg-select" value={option.id} onChange={(e) => setOptionId(e.target.value)}>
                  {m.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              {option.fictive ? (
                <Chip tone="accent" title="Ingen af de rigtige virksomheder har data til modulet lige nu, så det vises med fiktive demodata.">
                  Fiktive data
                </Chip>
              ) : null}
              {auto && m.options.length > 1 ? <span className="dg-meta">Finder data, der viser modulet …</span> : null}
              {current !== "data" ? (
                <>
                  <Toggle checked={mark} onChange={setMark}>
                    Markér problemer
                  </Toggle>
                  {current === "bredder" ? (
                    <Toggle checked={outside} onChange={setOutside}>
                      Vis også bredder uden for reglen
                    </Toggle>
                  ) : null}
                  <Seg
                    label="Størrelse"
                    value={fit ? "fit" : "actual"}
                    onChange={(v) => setFit(v === "fit")}
                    items={[
                      { id: "fit", label: "Tilpas" },
                      { id: "actual", label: "1:1" },
                    ]}
                  />
                </>
              ) : null}
            </div>
          ) : null}
          {(current === "bredder" || current === "tilstande") && auto && m.options.length > 1 ? <div className="dg-loading">Finder de data, der viser modulet i brug …</div> : null}
          {current === "bredder" && !(auto && m.options.length > 1) ? <WidthsTab m={m} option={option} theme={ctx.theme} mark={mark} fit={fit} outside={outside} /> : null}
          {current === "tilstande" && !(auto && m.options.length > 1) ? <StatesTab m={m} option={option} theme={ctx.theme} mark={mark} fit={fit} /> : null}
          {current === "data" ? <DataTab m={m} option={option} /> : null}
        </>
      )}
      {current === "tekster" ? <TextsTab m={m} /> : null}
      {current === "brug" ? <UsageTab m={m} /> : null}
      {auto && m.options.length > 1 ? (
        // Prøverne: hver datakilde tegnet uden for skærmen i desktop-standardbredden.
        <div className="dg-offscreen" aria-hidden="true">
          {m.options.map((o) => (
            <div key={o.id} style={{ width: 1200 }}>
              <Frame vw={1200} crop=".lasso-cell" eager fit={false} onReport={(r: Report) => put(keyOf(o), r)}>
                <ModuleView component={o.component} dataset={o.dataset} title={m.title} width={std} theme={ctx.theme} />
              </Frame>
            </div>
          ))}
        </div>
      ) : null}
      <nav className="dg-pager">
        {prev ? (
          <a href={`#/moduler/${slugOf(prev.type)}${current !== "bredder" ? `?fane=${current}` : ""}`}>
            <span className="dg-meta">Forrige</span>
            {prev.n} {prev.title}
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a className="dg-pager__next" href={`#/moduler/${slugOf(next.type)}${current !== "bredder" ? `?fane=${current}` : ""}`}>
            <span className="dg-meta">Næste</span>
            {next.n} {next.title}
          </a>
        ) : null}
      </nav>
    </div>
  );
}
