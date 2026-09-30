import { useEffect, useMemo, useRef, useState } from "react";
import { GRID_RULES, WIDTHS, type ComponentType, type Width } from "@lasso/spec";
import type { Ctx } from "../App.js";
import { Frame } from "../Frame.js";
import type { Report } from "../inspect.js";
import { ModuleView, reportKey, useReports, type ModuleInfo } from "../modules.js";
import { allowedWidths, moduleGroups, slugOf, VIEWPORTS, WIDTH_LABEL, type Viewport } from "../structure.js";
import { Chip, PageHead, Seg } from "../ui.js";

interface Job {
  key: string;
  m: ModuleInfo;
  vp: Viewport;
  width: Width;
}

/** Kolonnerne i matrixen: hver bredde på desktop-gitteret og standardbredden på de andre skærme. */
const COLUMNS: { id: string; label: string; vp: string; width?: Width }[] = [
  ...WIDTHS.map((w) => ({ id: `desktop:${w}`, label: WIDTH_LABEL[w], vp: "desktop", width: w })),
  { id: "portal", label: "Portal", vp: "portal" },
  { id: "chat", label: "Chat", vp: "chat" },
  { id: "tablet", label: "Tablet", vp: "tablet" },
  { id: "mobil", label: "Mobil", vp: "mobil" },
];

function jobsFor(modules: ModuleInfo[], scope: "tilladte" | "alle"): Job[] {
  const jobs: Job[] = [];
  for (const m of modules) {
    const option = m.options[0];
    if (!option) continue;
    const std = GRID_RULES[m.type]?.std ?? "full";
    for (const c of COLUMNS) {
      const vp = VIEWPORTS.find((v) => v.id === c.vp)!;
      const width = c.width ?? std;
      if (c.width && scope === "tilladte" && !allowedWidths(m.type).includes(c.width)) continue;
      jobs.push({ key: reportKey(m.type, vp.id, width, option.id), m, vp, width });
    }
  }
  return jobs;
}

const CONCURRENCY = 4;
const JOB_TIMEOUT_MS = 15000;

/**
 * Validering af alle moduler: hvert modul tegnes i hver bredde og på hver skærm, og rammen tjekkes for
 * overløb, vandret rulning og afkortet tekst. Resultaterne deles med modulsiderne (samme nøgler).
 */
export function ValidationPage({ ctx }: { ctx: Ctx }) {
  const { reports, put } = useReports();
  const [scope, setScope] = useState<"tilladte" | "alle">("tilladte");
  const [filter, setFilter] = useState<"alle" | "problemer">("alle");
  const ordered = useMemo(() => moduleGroups().flatMap((g) => g.types.map((t) => ctx.modules.get(t as ComponentType)).filter((m): m is ModuleInfo => Boolean(m))), [ctx.modules]);
  const jobs = useMemo(() => jobsFor(ordered, scope), [ordered, scope]);
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState<Job[]>([]);
  const queue = useRef<Job[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const done = jobs.filter((j) => reports[j.key]).length;
  const start = (onlyMissing: boolean) => {
    queue.current = jobs.filter((j) => !onlyMissing || !reports[j.key]);
    setActive([]);
    setRunning(true);
  };
  const finish = (job: Job, r?: Report) => {
    clearTimeout(timers.current[job.key]);
    delete timers.current[job.key];
    if (r) put(job.key, r);
    setActive((a) => a.filter((x) => x.key !== job.key));
  };
  // Fyld op til CONCURRENCY rammer ad gangen.
  useEffect(() => {
    if (!running) return;
    if (active.length < CONCURRENCY && queue.current.length) {
      const next = queue.current.splice(0, CONCURRENCY - active.length);
      for (const j of next) timers.current[j.key] = setTimeout(() => finish(j, { verdict: "info", label: "Ingen måling", state: "intet", findings: [{ kind: "empty", text: "Rammen blev ikke færdig inden for 15 sekunder." }], cellWidth: 0 }), JOB_TIMEOUT_MS);
      setActive((a) => [...a, ...next]);
    } else if (!active.length && !queue.current.length) setRunning(false);
  }, [running, active]);
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const cell = (m: ModuleInfo, c: (typeof COLUMNS)[number]) => {
    const option = m.options[0];
    if (!option) return <td key={c.id} className="dg-vcell dg-vcell--na" />;
    const allowed = !c.width || allowedWidths(m.type).includes(c.width);
    const r = reports[reportKey(m.type, c.vp, c.width ?? GRID_RULES[m.type]?.std ?? "full", option.id)];
    const std = !c.width || c.width === GRID_RULES[m.type]?.std;
    if (!r) return <td key={c.id} className={`dg-vcell${allowed ? "" : " dg-vcell--outside"}`}>{allowed ? "·" : ""}</td>;
    const icon = r.verdict === "problem" ? "!" : r.verdict === "info" ? "i" : r.state !== "fyldt" ? "–" : "✓";
    return (
      <td key={c.id} className={`dg-vcell dg-vcell--${r.verdict}${r.state !== "fyldt" ? " dg-vcell--state" : ""}${allowed ? "" : " dg-vcell--outside"}${std && c.width ? " dg-vcell--std" : ""}`} title={`${r.label}${r.findings.length ? `\n${r.findings.map((f) => f.text).join("\n")}` : ""}`}>
        <a href={`#/moduler/${slugOf(m.type)}`}>{icon}</a>
      </td>
    );
  };

  const rows = ordered.filter((m) => filter === "alle" || COLUMNS.some((c) => reports[reportKey(m.type, c.vp, c.width ?? GRID_RULES[m.type]?.std ?? "full", m.options[0]?.id ?? "")]?.verdict === "problem"));
  const all = jobs.map((j) => reports[j.key]).filter((r): r is Report => Boolean(r));
  const problems = all.filter((r) => r.verdict === "problem").length;
  const infos = all.filter((r) => r.verdict === "info").length;
  return (
    <div className="dg-page dg-page--wide">
      <PageHead eyebrow="Kvalitet" title="Validering" lead="Hvert modul tegnes med rigtige data i hver bredde på gitteret og på portal, chat, tablet og mobil i en rigtig skærmbredde. Rammen tjekkes for elementer, der løber ud over cellen, vandret rulning og afkortet tekst." />
      <div className="dg-controls">
        <button className="dg-btn dg-btn--primary" disabled={running} onClick={() => start(false)}>
          {running ? `Tjekker … ${done} af ${jobs.length}` : done ? "Kør igen" : `Kør validering (${jobs.length} rammer)`}
        </button>
        {!running && done > 0 && done < jobs.length ? (
          <button className="dg-btn" onClick={() => start(true)}>
            Tjek de manglende {jobs.length - done}
          </button>
        ) : null}
        <Seg
          label="Bredder"
          value={scope}
          onChange={setScope}
          items={[
            { id: "tilladte", label: "Tilladte bredder" },
            { id: "alle", label: "Alle bredder" },
          ]}
        />
        <Seg
          label="Vis"
          value={filter}
          onChange={setFilter}
          items={[
            { id: "alle", label: "Alle moduler" },
            { id: "problemer", label: "Kun med overløb" },
          ]}
        />
      </div>
      <div className="dg-vsummary">
        <div className="dg-vstat">
          <span className="dg-vstat__n">
            {done}/{jobs.length}
          </span>
          <span>rammer målt</span>
        </div>
        <div className="dg-vstat dg-vstat--problem">
          <span className="dg-vstat__n">{problems}</span>
          <span>med overløb</span>
        </div>
        <div className="dg-vstat dg-vstat--info">
          <span className="dg-vstat__n">{infos}</span>
          <span>afkortet eller ruller</span>
        </div>
        <div className="dg-vlegend">
          <Chip tone="ok">✓ Passer</Chip>
          <Chip tone="problem">! Overløb</Chip>
          <Chip tone="info">i Afkortet eller ruller</Chip>
          <Chip tone="muted">– Tom, henter eller fejl</Chip>
          <span className="dg-meta">Fed kant = standardbredde. Grå = uden for reglen.</span>
        </div>
      </div>
      {running ? <div className="dg-progress"><span style={{ width: `${(done / Math.max(1, jobs.length)) * 100}%` }} /></div> : null}
      <div className="dg-vtable-wrap">
        <table className="dg-vtable">
          <thead>
            <tr>
              <th className="dg-vtable__name">Modul</th>
              <th colSpan={6} className="dg-vtable__group">
                Desktop 1200, bredde på gitteret
              </th>
              <th colSpan={4} className="dg-vtable__group">
                Standardbredde på skærm
              </th>
            </tr>
            <tr>
              <th />
              {COLUMNS.map((c) => (
                <th key={c.id}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.type}>
                <th className="dg-vtable__name">
                  <a href={`#/moduler/${slugOf(m.type)}`}>
                    <span className="dg-nr">{m.n}</span> {m.title}
                  </a>
                </th>
                {COLUMNS.map((c) => cell(m, c))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Rammerne, der måles lige nu: tegnes uden for skærmen i fuld størrelse. */}
      <div className="dg-offscreen" aria-hidden="true">
        {active.map((j) => (
          <div key={j.key} style={{ width: j.vp.vw }}>
            <Frame vw={j.vp.vw} crop=".lasso-cell" eager fit={false} onReport={(r) => finish(j, r)}>
              <ModuleView component={j.m.options[0]!.component} dataset={j.m.options[0]!.dataset} title={j.m.title} width={j.width} theme={ctx.theme} />
            </Frame>
          </div>
        ))}
      </div>
    </div>
  );
}
