import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { APPROVED_FORMATS, formatRanges, GRID_RULES, LAYOUT_FORMATS, pickFormat, WIDTHS, type ComponentType, type LayoutFormat } from "@lasso/spec";
import { ApprovedFormatsProvider } from "@lasso/ui";
import { Frame } from "../Frame.js";
import type { Report } from "../inspect.js";
import { ModuleView, stateDataset, useReports, type DataOption, type ModuleInfo } from "../modules.js";
import { DEVICES, frameWidthFor, portalModuleWidth, WIDTH_LABEL, WIDTH_PX } from "../structure.js";
import { IdentityForm, useComments, CommentButton, type CommentTarget } from "../comments.js";
import { Chip, ReportChip, Seg } from "../ui.js";

/**
 * "Fra største til mindste": alle former, et modul kan tegnes i (packages/spec/src/layoutFormats.ts), og
 * modulet tegnet i hver bredde fra den største og hele vejen ned, med skærmenes navne. Formerne godkendes
 * her; kun godkendte bruges. Godkendelserne gemmes på serveren (/designguide/api/formater) og skrives ind i
 * koden (APPROVED_FORMATS), så de følger med udrulningen.
 */

const API = "/designguide/api/formater";

interface Saved {
  type: string;
  approved: string[];
  author: string;
  updatedAt?: string;
}

let cache: Promise<Saved[]> | undefined;
const loadSaved = () => (cache ??= fetch(API, { cache: "no-store" }).then((r) => (r.ok ? (r.json() as Promise<Saved[]>) : [])).catch(() => []));

/** Godkendelserne for typen: serverens, ellers kodens. */
function useApprovals(type: ComponentType) {
  const { identity } = useComments();
  const code = APPROVED_FORMATS[type] ?? (LAYOUT_FORMATS[type] ?? []).map((f) => f.id);
  const [saved, setSaved] = useState<Saved | undefined>();
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void loadSaved().then((list) => live && setSaved(list.find((x) => x.type === type)));
    return () => {
      live = false;
    };
  }, [type]);
  const approved = saved?.approved ?? [...code];
  const save = useCallback(
    async (next: string[]) => {
      setError("");
      const prev = saved;
      setSaved({ type, approved: next, author: identity?.name ?? "", updatedAt: new Date().toISOString() });
      try {
        const r = await fetch(`${API}/${type}`, { method: "PUT", headers: { "content-type": "application/json", ...(identity?.key ? { "x-api-key": identity.key } : {}) }, body: JSON.stringify({ approved: next, author: identity?.name }) });
        if (r.status === 401) throw new Error("Forkert nøgle. Tjek nøglen under Kommentarer, Navn og nøgle.");
        if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${r.status}`);
        const s = (await r.json()) as Saved;
        setSaved(s);
        cache = undefined;
      } catch (e) {
        setSaved(prev);
        setError(`Godkendelsen blev ikke gemt: ${(e as Error).message}`);
      }
    },
    [identity, saved, type],
  );
  const differs = approved.join(",") !== code.join(",");
  return { approved, saved, save, error, differs, code };
}

/** Antal elementer, formernes bredder regnes for (nøgletal: de valgte tal, ellers fire). */
function countOf(option: DataOption): number {
  const c = option.component as { metrics?: unknown[] };
  return Math.min(Math.max(c.metrics?.length ?? 4, 1), 5);
}

const fmtRange = (from: number, to: number) => (from === to ? `${from} px` : `${from}–${to} px`);

/** Én ramme med modulet i præcis `width` px (fuld bredde i en ramme med 24/16 px sideluft). */
function WidthFrame({ m, option, width, approved, caption, tags, theme, mark, fit }: { m: ModuleInfo; option: DataOption; width: number; approved: readonly string[]; caption: ReactNode; tags?: ReactNode; theme: "light" | "dark"; mark: boolean; fit: boolean }) {
  const { reports, put } = useReports();
  const key = `format|${m.type}|${width}|${approved.join(",")}|${option.id}`;
  const report = reports[key];
  const dataset = useMemo(() => stateDataset(option.dataset, option.component, m.catalog.register?.kraeverData ?? m.item?.kraeverData ?? [], "fyldt"), [option, m]);
  const comment: CommentTarget = {
    target: `format:${m.type}:${width}`,
    label: `${m.n} ${m.title}, modulbredde ${width} px`,
    context: { kind: "modul", ref: m.type, vw: frameWidthFor(width), width: `${width}px`, data: option.label },
  };
  return (
    <figure className={`dg-mframe${report?.verdict === "problem" ? " is-problem" : ""}`}>
      <figcaption className="dg-mframe__cap">
        <span className="dg-mframe__title">{caption}</span>
        {tags}
        <span className="dg-mframe__grow" />
        {report && report.cellWidth !== width ? <span className="dg-meta">målt {report.cellWidth} px</span> : null}
        <ReportChip report={report} />
        <CommentButton target={comment} small />
      </figcaption>
      <Frame vw={frameWidthFor(width)} crop=".lasso-cell" mark={mark} fit={fit} comment={comment} onReport={(r: Report) => put(key, r)} label={`${m.title} i ${width} px`}>
        <ApprovedFormatsProvider value={{ [m.type]: approved }}>
          <ModuleView component={option.component} dataset={dataset} title={m.title} width="full" theme={theme} />
        </ApprovedFormatsProvider>
      </Frame>
    </figure>
  );
}

interface Stop {
  width: number;
  labels: string[];
  boundary?: string;
}

export function FormatsSection({ m, option, theme, mark, fit }: { m: ModuleInfo; option: DataOption; theme: "light" | "dark"; mark: boolean; fit: boolean }) {
  const formats = LAYOUT_FORMATS[m.type] ?? [];
  const { approved, saved, save, error, differs, code } = useApprovals(m.type);
  const { identity } = useComments();
  const [asking, setAsking] = useState<string[] | null>(null);
  const [view, setView] = useState<"godkendte" | "alle">("godkendte");
  const count = countOf(option);
  const rule = GRID_RULES[m.type];

  // Bredderne, modulet kan få: portalen på alle skærme og desktopgitterets celler fra typens min til maks.
  const gridWidths = rule ? WIDTHS.slice(WIDTHS.indexOf(rule.min), WIDTHS.indexOf(rule.max) + 1).filter((w) => w !== "full") : [];
  const maxW = WIDTH_PX.full;
  const minW = Math.min(...DEVICES.map((d) => portalModuleWidth(d.vw)), ...gridWidths.map((w) => WIDTH_PX[w]));
  const scaleMin = Math.max(200, minW - 60);
  const shown = view === "alle" ? formats.map((f) => f.id) : approved;
  const ranges = formatRanges(m.type, count, maxW, minW, shown);
  const natural = formatRanges(m.type, count, maxW, scaleMin, formats.map((f) => f.id));
  const x = (w: number) => `${((maxW - w) / (maxW - scaleMin)) * 100}%`;
  const idx = (f: LayoutFormat) => formats.findIndex((g) => g.id === f.id);

  const stops = useMemo(() => {
    const list: Stop[] = [];
    const add = (width: number, label?: string, boundary?: string) => {
      const hit = list.find((s) => Math.abs(s.width - width) <= 2);
      if (hit) {
        if (label) hit.labels.push(label);
        if (boundary) hit.boundary = boundary;
      } else list.push({ width, labels: label ? [label] : [], boundary });
    };
    add(maxW, "Desktop, fuld bredde (1200)");
    for (const d of DEVICES) add(portalModuleWidth(d.vw), `${d.label} ${d.vw}`);
    for (const w of gridWidths) add(WIDTH_PX[w], `Desktop ${WIDTH_LABEL[w]}`);
    ranges.forEach((r, i) => {
      if (i < ranges.length - 1) add(r.to, undefined, `Sidste bredde før "${ranges[i + 1]!.format.name.toLowerCase()}"`);
    });
    return list.filter((s) => s.width >= minW).sort((a, b) => b.width - a.width);
  }, [ranges.map((r) => `${r.format.id}${r.to}`).join(), minW]);

  const toggle = (id: string) => {
    const next = approved.includes(id) ? approved.filter((x) => x !== id) : formats.map((f) => f.id).filter((x) => x === id || approved.includes(x));
    if (!identity) return setAsking(next);
    void save(next);
  };

  return (
    <section className="dg-section">
      <div className="dg-h2row">
        <h2 className="dg-h2">Fra største til mindste</h2>
        <span className="dg-meta">
          Formen følger modulets egen bredde, ikke skærmen, og skifter kun én vej, når det bliver smallere. Regnet for {count} tal. Godkend de former, modulet må bruge; en form uden flueben springes over, så den næste overtager.
        </span>
      </div>

      <div className="dg-fruler" aria-label="Formerne langs modulets bredde">
        <div className="dg-fruler__track">
          {ranges.map((r) => (
            <div key={r.format.id} className={`dg-fruler__seg dg-fmt--${idx(r.format)}`} style={{ left: x(r.from), width: `calc(${x(r.to)} - ${x(r.from)} + ${100 / (maxW - scaleMin)}%)` }} title={`${r.format.name}: ${fmtRange(r.from, r.to)}`}>
              <span>{r.format.name}</span>
            </div>
          ))}
          <div className="dg-fruler__below" style={{ left: x(minW - 1) }} title="Under den mindste bredde, modulet kan få" />
        </div>
        <div className="dg-fruler__ticks">
          {stops.map((s) => (
            <div key={s.width} className={`dg-fruler__tick${s.labels.length ? "" : " is-edge"}`} style={{ left: x(s.width) }} title={`${s.width} px${s.labels.length ? `: ${s.labels.join(", ")}` : ""}`} />
          ))}
        </div>
        <div className="dg-fruler__ends">
          <span>{maxW} px</span>
          <span>Mindste bredde {minW} px</span>
        </div>
      </div>

      <table className="dg-ftable">
        <thead>
          <tr>
            <th>Modulbredde</th>
            <th>Hvor</th>
            <th>Form</th>
          </tr>
        </thead>
        <tbody>
          {stops.map((s) => {
            const f = pickFormat(m.type, s.width, count, shown);
            return (
              <tr key={s.width} className={s.labels.length ? "" : "is-edge"}>
                <td className="dg-ftable__px">{s.width} px</td>
                <td>{s.labels.length ? s.labels.join(", ") : <span className="dg-meta">{s.boundary}</span>}</td>
                <td>
                  {f ? (
                    <span className="dg-format__tag">
                      <span className={`dg-format__dot dg-fmt--${idx(f)}`} />
                      {f.name}
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="dg-formats">
        {formats.map((f) => {
          const on = approved.includes(f.id);
          const used = ranges.filter((r) => r.format.id === f.id);
          const own = natural.find((r) => r.format.id === f.id);
          const sample = own ? Math.max(own.to, minW) : minW;
          return (
            <div key={f.id} className={`dg-format${on ? "" : " is-off"}`}>
              <div className="dg-format__head">
                <label className="dg-format__check">
                  <input type="checkbox" checked={on} onChange={() => toggle(f.id)} />
                  <span className={`dg-format__dot dg-fmt--${idx(f)}`} />
                  <strong>{f.name}</strong>
                </label>
                {on ? used.length ? <Chip tone="ok">Godkendt, bruges {used.map((r) => fmtRange(r.from, r.to)).join(", ")}</Chip> : <Chip tone="muted">Godkendt, men bruges ikke i modulets bredder</Chip> : <Chip tone="muted">Ikke godkendt</Chip>}
                <span className="dg-meta">
                  Lovlig fra {f.minPx(count)} px
                  {own && own.from >= minW ? `; med alle former godkendt ${fmtRange(own.from, Math.max(own.to, minW))}` : own ? `; med alle former godkendt kun under modulets mindste bredde (${minW} px)` : ""}
                </span>
              </div>
              <p className="dg-p dg-p--small">{f.description}</p>
              <WidthFrame m={m} option={option} width={sample} approved={[f.id]} theme={theme} mark={mark} fit={fit} caption={<>Formen i sin mindste bredde, <strong>{sample} px</strong></>} />
            </div>
          );
        })}
      </div>
      {asking ? (
        <div className="dg-note">
          Skriv dit navn, så godkendelsen kan gemmes.
          <IdentityForm
            onDone={() => {
              const next = asking;
              setAsking(null);
              void save(next);
            }}
          />
        </div>
      ) : null}
      {error ? <p className="dg-note dg-note--warn">{error}</p> : null}
      {differs ? (
        <p className="dg-note">
          Godkendt i guiden{saved?.author ? ` af ${saved.author}` : ""}: {approved.length ? approved.join(", ") : "ingen"}. Koden bruger endnu {code.join(", ")}; godkendelsen skrives ind i packages/spec/src/layoutFormats.ts (APPROVED_FORMATS) og gælder i portalen og chatten fra næste udrulning. Rammerne her viser allerede den godkendte rækkefølge.
        </p>
      ) : null}

      <div className="dg-h2row dg-h2row--sub">
        <h3 className="dg-h3">Hele rækken ned</h3>
        <Seg
          label="Former"
          value={view}
          onChange={setView}
          items={[
            { id: "godkendte", label: "Kun godkendte" },
            { id: "alle", label: "Alle former" },
          ]}
        />
      </div>
      <div className="dg-mframes">
        {stops.map((s) => {
          const f = pickFormat(m.type, s.width, count, shown);
          return (
            <WidthFrame
              key={`${s.width}-${view}`}
              m={m}
              option={option}
              width={s.width}
              approved={shown}
              theme={theme}
              mark={mark}
              fit={fit}
              caption={
                <>
                  <strong>{s.width} px</strong> {s.labels.join(" · ")}
                </>
              }
              tags={
                <>
                  {f ? (
                    <span className="dg-format__tag">
                      <span className={`dg-format__dot dg-fmt--${idx(f)}`} />
                      {f.name}
                    </span>
                  ) : null}
                  {s.boundary ? <Chip tone="info">{s.boundary}</Chip> : null}
                  {f && !approved.includes(f.id) ? <Chip tone="muted">Ikke godkendt</Chip> : null}
                </>
              }
            />
          );
        })}
      </div>
    </section>
  );
}
