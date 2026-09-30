import { useMemo, useState } from "react";
import type { Ctx } from "../App.js";
import { SOURCE } from "../source.js";
import { slugOf } from "../structure.js";
import { PageHead, Seg } from "../ui.js";
import { TextList } from "./Module.js";

type Area = "alle" | "moduler" | "faelles" | "data";

/**
 * Al brugervendt tekst i koden, udtrukket ved build: synlig tekst i JSX, attributter (aria-label,
 * title, placeholder, reason …) og tekster i koden (overskrifter, tomme tilstande, formater).
 */
export function TextsPage({ ctx, query, file }: { ctx: Ctx; query: string; file: string }) {
  const [q, setQ] = useState(query);
  const [area, setArea] = useState<Area>("alle");
  const [visibleOnly, setVisibleOnly] = useState(false);
  const moduleOfFile = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [type, files] of Object.entries(SOURCE.componentFiles)) for (const f of files) m.set(f, [...(m.get(f) ?? []), type]);
    return m;
  }, []);
  const needle = q.trim().toLowerCase();
  const texts = SOURCE.texts.filter((t) => {
    if (file && t.f !== file) return false;
    if (visibleOnly && t.k !== "jsx") return false;
    if (area === "moduler" && !moduleOfFile.has(t.f)) return false;
    if (area === "faelles" && (moduleOfFile.has(t.f) || !t.f.startsWith("packages/ui/"))) return false;
    if (area === "data" && !t.f.startsWith("packages/spec/")) return false;
    return !needle || t.t.toLowerCase().includes(needle) || t.f.toLowerCase().includes(needle);
  });
  const files = new Set(texts.map((t) => t.f));
  const modulesHit = [...new Set([...files].flatMap((f) => moduleOfFile.get(f) ?? []))];
  return (
    <div className="dg-page">
      <PageHead
        eyebrow="Indhold"
        title="Tekster"
        lead="Al tekst, brugeren kan møde, som den står i koden: overskrifter, knapper, forklaringer, tomme tilstande, fejl og formater. … står for en værdi, der sættes ind. Teksterne udtrækkes ved hver udrulning."
      />
      <div className="dg-toolbar">
        <input className="dg-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søg i teksterne, fx Vis alle eller Ikke oplyst" aria-label="Søg i teksterne" />
        <Seg
          label="Område"
          value={area}
          onChange={setArea}
          items={[
            { id: "alle", label: "Alle" },
            { id: "moduler", label: "Moduler" },
            { id: "faelles", label: "Fælles UI" },
            { id: "data", label: "Formater og data" },
          ]}
        />
        <label className="dg-check">
          <input type="checkbox" checked={visibleOnly} onChange={(e) => setVisibleOnly(e.target.checked)} /> Kun synlig tekst i JSX
        </label>
      </div>
      <p className="dg-meta dg-count">
        {texts.length.toLocaleString("da-DK")} af {SOURCE.texts.length.toLocaleString("da-DK")} tekster i {files.size} filer
        {file ? (
          <>
            {" "}
            (filtreret på {file.split("/").pop()}, <a href="#/tekster">vis alle</a>)
          </>
        ) : null}
        .
        {modulesHit.length && modulesHit.length <= 8 ? (
          <>
            {" "}
            Moduler:{" "}
            {modulesHit.map((t, i) => (
              <span key={t}>
                {i ? ", " : ""}
                <a href={`#/moduler/${slugOf(t)}?fane=tekster`}>{ctx.modules.get(t as never)?.title ?? t}</a>
              </span>
            ))}
          </>
        ) : null}
      </p>
      <TextList texts={texts.slice(0, 1500)} />
      {texts.length > 1500 ? <p className="dg-note">Viser de første 1.500. Søg for at indsnævre.</p> : null}
    </div>
  );
}
