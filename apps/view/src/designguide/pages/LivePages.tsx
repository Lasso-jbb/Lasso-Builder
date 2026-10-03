import { useEffect, useState } from "react";
import { FOCUS_LABELS, PERSON_FOCUS_LABELS } from "@lasso/spec";
import { LassoView } from "@lasso/ui";
import type { ViewSpec } from "@lasso/spec";
import type { Ctx } from "../App.js";
import { Frame } from "../Frame.js";
import type { Report } from "../inspect.js";
import { HOST } from "../modules.js";
import { CommentButton, type CommentTarget } from "../comments.js";
import { fetchPage, type LivePage } from "../source.js";
import { VIEWPORTS } from "../structure.js";
import { PageHead, ReportChip, Seg, Toggle } from "../ui.js";

/** Print-eksemplet: A4 ved 96 dpi, som serverens Chromium tegner side-PDF'en. */
const PRINT_VP = { id: "print", label: "Print (A4)", vw: 900, note: "Side-PDF'en: forside, alt foldet ud, ingen knapper; sidehoved med logo og navnelogo på hvert ark" };

/**
 * Hele sider, som show_company og show_person bygger dem for hvert fokus, med live-data og på hver
 * skærm. Viser, hvordan modulerne pakkes i gitteret og foldes, ikke kun hvordan de ser ud alene.
 */
export function LivePagesPage({ ctx, kind, focus }: { ctx: Ctx; kind: "company" | "person"; focus: string }) {
  const focuses = kind === "company" ? ctx.boot.focuses.company : ctx.boot.focuses.person;
  const labels: Record<string, string> = kind === "company" ? FOCUS_LABELS : PERSON_FOCUS_LABELS;
  const current = focuses.includes(focus) ? focus : focuses[0]!;
  const [vp, setVp] = useState<string>("desktop");
  const [mark, setMark] = useState(true);
  const [page, setPage] = useState<LivePage | null>(null);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | undefined>();
  useEffect(() => {
    setPage(null);
    setError("");
    setReport(undefined);
    fetchPage(kind, current).then(setPage, (e: Error) => setError(e.message));
  }, [kind, current]);
  useEffect(() => setReport(undefined), [vp]);
  // Jakob 01.10 (27.1): print-eksempler: siden, som den kommer ud i PDF'en (A4, 794 px), med forside og alt foldet ud.
  const viewport = vp === PRINT_VP.id ? PRINT_VP : VIEWPORTS.find((v) => v.id === vp)!;
  const print = vp === PRINT_VP.id;
  const name = kind === "company" ? ctx.boot.showcase.tabs.find((t) => t.id === "virksomhed")?.label : ctx.boot.showcase.tabs.find((t) => t.id === "person")?.label;
  const pageTarget: CommentTarget = {
    target: `side:${kind}:${current}:${vp}`,
    label: `Hel side: ${name}, ${labels[current] ?? current}, ${viewport.label} ${viewport.vw}`,
    context: { kind: "side", ref: `${kind === "company" ? "show_company" : "show_person"} focus ${current}`, viewport: vp, vw: viewport.vw, data: name },
  };
  const set = (k: string, f: string) => (location.hash = `#/sider?type=${k === "company" ? "virksomhed" : "person"}&fokus=${f}`);
  return (
    <div className="dg-page dg-page--wide">
      <PageHead eyebrow="Mønstre og sider" title="Hele sider med live-data" lead="Siderne, som Lasso bygger dem i chatten og på de delte links (show_company og show_person), for hvert fokus. Her ses, hvordan modulerne pakkes i gitteret og foldes på hver skærm." />
      <div className="dg-controls">
        <Seg
          label="Side"
          value={kind}
          onChange={(k) => set(k, "overblik")}
          items={[
            { id: "company", label: "Virksomhed" },
            { id: "person", label: "Person" },
          ]}
        />
        <Seg label="Skærm" value={vp} onChange={setVp} items={[...VIEWPORTS, PRINT_VP].map((v) => ({ id: v.id, label: v.id === PRINT_VP.id ? v.label : `${v.label} ${v.vw}` }))} />
        <Toggle checked={mark} onChange={setMark}>
          Markér problemer
        </Toggle>
      </div>
      <div className="dg-focusbar" role="tablist" aria-label="Fokus">
        {focuses.map((f) => (
          <button key={f} role="tab" aria-selected={f === current} className={`dg-focus${f === current ? " is-on" : ""}`} onClick={() => set(kind, f)}>
            {labels[f] ?? f}
          </button>
        ))}
      </div>
      <div className="dg-pageframe">
        <div className="dg-pageframe__cap">
          <strong>
            {name}, {labels[current] ?? current}
          </strong>
          <span className="dg-meta">
            {viewport.label} {viewport.vw} px. {viewport.note}.
          </span>
          <span className="dg-mframe__grow" />
          {page ? <ReportChip report={report} /> : null}
          <CommentButton small target={pageTarget} />
        </div>
        {error ? <p className="dg-note dg-note--warn">Siden kunne ikke hentes: {error}</p> : null}
        {!page && !error ? <div className="dg-loading">Henter siden med live-data …</div> : null}
        {page ? (
          <Frame key={`${kind}${current}${vp}`} comment={pageTarget} vw={viewport.vw} mark={mark} eager onReport={setReport} minHeight={400} label={`${name}, ${labels[current]}, ${viewport.label}`}>
            {print ? (
              <div className="dg-printsheet">
                <LassoView print spec={{ ...page.spec, components: page.spec.components.filter((c) => c.type !== "LassoFollowUps") }} dataset={page.dataset} host={{}} onAction={() => undefined} theme="light" />
              </div>
            ) : (
              <LassoView spec={page.spec} dataset={page.dataset} host={HOST} onAction={() => undefined} theme={ctx.theme} />
            )}
          </Frame>
        ) : null}
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
      </div>
      {kind === "company" ? <LassoV1Section ctx={ctx} viewport={viewport} vp={vp} mark={mark} /> : null}
    </div>
  );
}

/**
 * Jakob 03.10: "Lasso v1 moduler". Lassos nuværende virksomhedsside (portalen, Overblik og Stamoplysninger)
 * genskabt med de nye komponenter, så den kan sammenlignes med siden ovenfor, som komponisten bygger.
 * Komponenterne og data kommer fra showcasens Lasso-side (portalPages i @lasso/spec), så de to steder ikke glider fra hinanden.
 */
function LassoV1Section({ ctx, viewport, vp, mark }: { ctx: Ctx; viewport: { label: string; vw: number; note: string }; vp: string; mark: boolean }) {
  const portal = ctx.boot.showcase.portal;
  const [pageId, setPageId] = useState<string>("overblik");
  const [report, setReport] = useState<Report | undefined>();
  useEffect(() => setReport(undefined), [pageId, vp]);
  if (!portal?.pages?.length) return null;
  const current = portal.pages.find((p) => p.id === pageId) ?? portal.pages[0]!;
  const spec = { version: 2, kind: "company", title: portal.name, layout: current.layout, criteria: [], components: current.components } as unknown as ViewSpec;
  const target: CommentTarget = {
    target: `side:lasso-v1:${current.id}:${vp}`,
    label: `Lasso v1 moduler: ${portal.name}, ${current.label}, ${viewport.label} ${viewport.vw}`,
    context: { kind: "side", ref: `portalPages ${current.id}`, viewport: vp, vw: viewport.vw, data: portal.name },
  };
  return (
    <section className="dg-v1">
      <PageHead
        eyebrow="Lasso v1 moduler"
        title="Lassos virksomhedsside genskabt med de nye komponenter"
        lead="Portalens nuværende side (v1), bygget af de samme komponenter som chatten og de delte links: tre spalter med identitet, genveje og kreditvurdering til venstre, relationer og virksomhedsprofil i midten, og virksomhedsoplysninger, regnskabsoplysninger og erhvervsresume til højre. Brug den til at se, hvor de nye komponenter allerede rammer v1, og hvor de afviger."
      />
      <div className="dg-focusbar" role="tablist" aria-label="Lasso v1 modul">
        {portal.pages.map((p) => (
          <button key={p.id} role="tab" aria-selected={p.id === current.id} className={`dg-focus${p.id === current.id ? " is-on" : ""}`} onClick={() => setPageId(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="dg-pageframe">
        <div className="dg-pageframe__cap">
          <strong>
            {portal.name}, {current.label} (v1)
          </strong>
          <span className="dg-meta">
            {viewport.label} {viewport.vw} px. Komponenterne fra portalPages, samme data som Lasso-siden i showcasen.
          </span>
          <span className="dg-mframe__grow" />
          <ReportChip report={report} />
          <CommentButton small target={target} />
        </div>
        <Frame key={`v1${current.id}${vp}`} comment={target} vw={viewport.vw} mark={mark} eager onReport={setReport} minHeight={400} label={`Lasso v1, ${current.label}, ${viewport.label}`}>
          <LassoView spec={spec} dataset={current.dataset} host={HOST} onAction={() => undefined} theme={ctx.theme} frameless />
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
      </div>
    </section>
  );
}
