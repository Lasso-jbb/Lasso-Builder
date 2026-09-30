import type { Ctx } from "../App.js";
import { headingId, Markdown } from "../Markdown.js";
import { SOURCE } from "../source.js";
import { PageHead, SourceRef } from "../ui.js";

/** Et designdokument fra docs/design, læst ved build (README.md er principperne). */
export function DocPage({ ctx: _ctx, file }: { ctx: Ctx; file: string }) {
  const doc = SOURCE.docs.find((d) => d.file === file);
  if (!doc) return <div className="dg-page"><PageHead title="Dokumentet findes ikke" /></div>;
  const toc = [...doc.markdown.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1]!);
  const isReadme = file.endsWith("README.md");
  return (
    <div className="dg-page dg-page--doc">
      <PageHead eyebrow={isReadme ? "Kom i gang" : "Dokument"} title={isReadme ? "Principper og regler" : doc.title} lead={isReadme ? "De faste regler, alle moduler og sider følger. Reglerne står i koden sammen med komponenterne; det her er dem, som de står nu." : undefined}>
        <SourceRef file={doc.file} />
      </PageHead>
      <div className="dg-doc">
        <Markdown source={doc.markdown} skipTitle />
        {toc.length > 2 ? (
          <aside className="dg-toc">
            <div className="dg-toc__title">På siden</div>
            {toc.map((t) => (
              <a key={t} href={`#${headingId(t)}`} onClick={(e) => { e.preventDefault(); document.getElementById(headingId(t))?.scrollIntoView({ behavior: "smooth" }); }}>
                {t.replace(/[`*]/g, "")}
              </a>
            ))}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
