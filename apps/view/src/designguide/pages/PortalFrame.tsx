import { useEffect, useRef, useState } from "react";
import type { Ctx } from "../App.js";
import { Markdown } from "../Markdown.js";
import { SOURCE } from "../source.js";
import { PageHead, Seg, SourceRef } from "../ui.js";
import portalCss from "../../portal2/portal2.css?raw";

/**
 * Portalens ramme (docs/design/PORTAL.md): den kørende /portal i rigtige skærmbredder, reglerne fra
 * dokumentet og portalens farver læst direkte fra portal2.css. Så findes rammen kun ét sted: i koden,
 * og guiden viser den, som den er.
 */

export const PORTAL_DOC = "docs/design/PORTAL.md";

const SCREENS = [
  { id: "desktop", label: "Desktop 1440", vw: 1440, vh: 900 },
  { id: "smal", label: "Smal 1000", vw: 1000, vh: 800 },
  { id: "mobil", label: "Mobil 390", vw: 390, vh: 844 },
] as const;
type ScreenId = (typeof SCREENS)[number]["id"];

/** Tokens fra en CSS-blok, fx `.p3 { --frame: #fafafb; … }`. */
export function tokensOf(css: string, selector: string): [string, string][] {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) return [];
  const body = css.slice(at, css.indexOf("}", at));
  return [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]);
}

/** Den kørende portal i en iframe på skærmens bredde, skaleret ned til pladsen. */
function LivePortal({ src, vw, vh, title }: { src: string; vw: number; vh: number; title: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);
  useEffect(() => {
    const el = host.current!;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    setAvail(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const scale = avail ? Math.min(1, avail / vw) : 1;
  return (
    <div ref={host} className="dg-portalframe" style={{ height: vh * scale }}>
      <iframe title={title} src={src} width={vw} height={vh} style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }} loading="lazy" />
    </div>
  );
}

export function PortalFramePage({ ctx }: { ctx: Ctx }) {
  const [screen, setScreen] = useState<ScreenId>("desktop");
  const s = SCREENS.find((x) => x.id === screen)!;
  const doc = SOURCE.docs.find((d) => d.file === PORTAL_DOC);
  // Rammerne åbner guidens egne eksempler: portalens virksomhed og, hvis der er en, personen.
  const company = ctx.boot.showcase.portal.company;
  const personTab = ctx.boot.showcase.tabs.find((t) => t.id === "person");
  const person = personTab ? Object.keys(personTab.dataset.persons ?? {})[0] : undefined;
  const ids = [person, company].filter((x): x is string => Boolean(x && /^CVR-[134]-\d+$/i.test(x)));
  const src = `/portal?${new URLSearchParams({ ...(ids.length ? { aaben: ids.join(",") } : {}), tema: ctx.theme }).toString()}`;
  const light = tokensOf(portalCss, ".p3");
  const dark = new Map(tokensOf(portalCss, '.p3[data-theme="dark"]'));
  const colors = light.filter(([, v]) => /^#|^rgba?\(/.test(v));
  const sizes = light.filter(([, v]) => /px$/.test(v));

  return (
    <div className="dg-page dg-page--doc">
      <PageHead
        eyebrow="Portalen"
        title="Portalens ramme"
        lead="Rammen om modulerne: topbjælke med søgning, skinne, åbne faner, modulrække og spørgefelt. Rammerne herunder er den kørende portal (/portal), ikke et billede; ret i koden, og guiden følger med."
      >
        <SourceRef file="apps/view/src/portal2/Portal2App.tsx" /> <SourceRef file="apps/view/src/portal2/portal2.css" /> <SourceRef file={PORTAL_DOC} />
      </PageHead>

      <section className="dg-section">
        <div className="dg-toolbar">
          <Seg label="Skærm" value={screen} items={SCREENS.map((x) => ({ id: x.id, label: x.label }))} onChange={setScreen} />
          <a className="dg-linkbtn" href={src} target="_blank" rel="noopener noreferrer">
            Åbn portalen i et nyt vindue
          </a>
        </div>
        <LivePortal key={`${screen}:${ctx.theme}`} src={src} vw={s.vw} vh={s.vh} title={`Portalen, ${s.label}`} />
        <p className="dg-note">
          Rammen åbner {ids.length ? "guidens eksempler som faner" : "forsiden"}. Søgning, faner, moduler og spørgefelt virker; på mobil skal der rulles i rammen for at se topbjælken klappe sammen. Spørgefeltet bruger chatten (Claude) og koster derfor et kald.
        </p>
      </section>

      <section className="dg-section">
        <h2 className="dg-h2">Farver og mål</h2>
        <p className="dg-lead">Portalens egne tokens (prototypens), læst fra portal2.css. Modulerne indeni bruger fortsat Lasso-tokens fra Fundament.</p>
        <table className="dg-ptable">
          <thead>
            <tr>
              <th>Token</th>
              <th>Lys</th>
              <th>Mørk</th>
            </tr>
          </thead>
          <tbody>
            {colors.map(([name, value]) => (
              <tr key={name}>
                <td>
                  <code>{name}</code>
                </td>
                <td>
                  <span className="dg-swatch" style={{ background: value }} /> <code>{value}</code>
                </td>
                <td>
                  {dark.get(name) ? (
                    <>
                      <span className="dg-swatch" style={{ background: dark.get(name) }} /> <code>{dark.get(name)}</code>
                    </>
                  ) : (
                    <span className="dg-ptable__same">samme</span>
                  )}
                </td>
              </tr>
            ))}
            {sizes.map(([name, value]) => (
              <tr key={name}>
                <td>
                  <code>{name}</code>
                </td>
                <td colSpan={2}>
                  <code>{value}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {doc ? (
        <section className="dg-section dg-doc">
          <Markdown source={doc.markdown} skipTitle />
        </section>
      ) : null}
    </div>
  );
}
