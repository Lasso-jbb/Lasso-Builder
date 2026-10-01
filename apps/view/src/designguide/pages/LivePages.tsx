import { useEffect, useState } from "react";
import { FOCUS_LABELS, PERSON_FOCUS_LABELS } from "@lasso/spec";
import { LassoView } from "@lasso/ui";
import type { Ctx } from "../App.js";
import { Frame } from "../Frame.js";
import type { Report } from "../inspect.js";
import { HOST } from "../modules.js";
import { CommentButton, type CommentTarget } from "../comments.js";
import { fetchPage, type LivePage } from "../source.js";
import { VIEWPORTS } from "../structure.js";
import { PageHead, ReportChip, Seg, Toggle } from "../ui.js";

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
  const viewport = VIEWPORTS.find((v) => v.id === vp)!;
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
        <Seg label="Skærm" value={vp} onChange={setVp} items={VIEWPORTS.map((v) => ({ id: v.id, label: `${v.label} ${v.vw}` }))} />
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
            <LassoView spec={page.spec} dataset={page.dataset} host={HOST} onAction={() => undefined} theme={ctx.theme} />
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
    </div>
  );
}
