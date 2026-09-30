import type { Ctx } from "../App.js";
import { ENTRIES } from "../gallery.js";
import { SOURCE } from "../source.js";
import { FOUNDATION, moduleGroups, slugOf } from "../structure.js";
import { fmtDate } from "../ui.js";

export function HomePage({ ctx }: { ctx: Ctx }) {
  const { boot, modules } = ctx;
  const sc = boot.showcase;
  const entities = [...sc.tabs.map((t) => t.label), ...sc.alt.companies.map((c) => c.name)];
  const stats = [
    { n: modules.size, label: "moduler", sub: "i alle bredder med rigtige data", path: "moduler" },
    { n: ENTRIES.length, label: "elementer", sub: "fra galleriet, med katalognummer", path: "galleri/05" },
    { n: SOURCE.tokens.length, label: "tokens", sub: "farver, typografi, afstande", path: "fundament/tokens" },
    { n: SOURCE.texts.length, label: "tekster", sub: "al brugervendt tekst i koden", path: "tekster" },
  ];
  return (
    <div className="dg-page dg-home">
      <section className="dg-hero">
        <div className="dg-eyebrow">Lasso designsystem</div>
        <h1 className="dg-hero__title">Én kilde til, hvordan Lasso ser ud, lyder og opfører sig.</h1>
        <p className="dg-hero__lead">
          Designguiden er bygget direkte fra koden. Hvert modul, hvert token og hver tekst her er det samme, som kører i Lasso, og modulerne er tegnet med rigtige data i hver bredde, de kan stå i. Ændres koden, ændres guiden ved næste udrulning.
        </p>
        <div className="dg-hero__actions">
          <a className="dg-btn dg-btn--primary" href="#/moduler">
            Se modulerne
          </a>
          <a className="dg-btn" href="#/validering">
            Kør validering
          </a>
          <a className="dg-btn dg-btn--ghost" href="#/principper">
            Læs principperne
          </a>
        </div>
      </section>

      <section className="dg-stats">
        {stats.map((s) => (
          <a key={s.label} className="dg-stat" href={`#/${s.path}`}>
            <span className="dg-stat__n">{s.n.toLocaleString("da-DK")}</span>
            <span className="dg-stat__label">{s.label}</span>
            <span className="dg-stat__sub">{s.sub}</span>
          </a>
        ))}
      </section>

      <section className="dg-section">
        <h2 className="dg-h2">Sådan bruger du guiden</h2>
        <div className="dg-steps">
          <div className="dg-step">
            <span className="dg-step__n">1</span>
            <h3>Find modulet</h3>
            <p>Moduler er grupperet efter emne. Hvert modul viser formål, hvornår det bruges, og hvilke data det kræver.</p>
          </div>
          <div className="dg-step">
            <span className="dg-step__n">2</span>
            <h3>Se det i alle bredder</h3>
            <p>Modulet tegnes i hver bredde, gitteret tillader (¼ til fuld), og på portal, desktop, chat, tablet og mobil i en rigtig skærmbredde.</p>
          </div>
          <div className="dg-step">
            <span className="dg-step__n">3</span>
            <h3>Validér udfaldene</h3>
            <p>Hver ramme tjekkes automatisk for overløb, vandret rulning og afkortet tekst. Skift virksomhed og tilstand for at se tom, henter og fejl.</p>
          </div>
          <div className="dg-step">
            <span className="dg-step__n">4</span>
            <h3>Tjek teksterne</h3>
            <p>Al tekst, brugeren kan se, står under hvert modul og samlet under Tekster, med filen og linjen den kommer fra.</p>
          </div>
        </div>
      </section>

      <section className="dg-section">
        <div className="dg-h2row">
          <h2 className="dg-h2">Moduler</h2>
          <a href="#/moduler">Alle {modules.size} moduler →</a>
        </div>
        <div className="dg-groupcards">
          {moduleGroups().map((g) => (
            <a key={g.id} className="dg-groupcard" href={`#/moduler?gruppe=${g.id}`}>
              <span className="dg-groupcard__count">{g.types.length}</span>
              <span className="dg-groupcard__title">{g.label}</span>
              <span className="dg-groupcard__intro">{g.intro}</span>
              <span className="dg-groupcard__list">
                {g.types
                  .slice(0, 4)
                  .map((t) => modules.get(t)?.title ?? t)
                  .join(", ")}
                {g.types.length > 4 ? ` og ${g.types.length - 4} flere` : ""}
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="dg-section">
        <h2 className="dg-h2">Fundament</h2>
        <div className="dg-foundcards">
          {FOUNDATION.map((f) => (
            <a key={f.id} className="dg-foundcard" href={`#/fundament/${f.id}`}>
              <span className="dg-foundcard__title">{f.label}</span>
              <span className="dg-foundcard__intro">{f.intro}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="dg-section dg-about">
        <div>
          <h2 className="dg-h2">Om data og version</h2>
          <dl className="dg-facts">
            <dt>Data</dt>
            <dd>
              {boot.source === "live" ? "Live-data fra Lassos API" : "Demodata (serveren har ingen Lasso-nøgler)"}, hentet {fmtDate(sc.generatedAt)}. <a href="?frisk=1">Hent igen</a>
            </dd>
            <dt>Virksomheder og personer</dt>
            <dd>{entities.join(", ")}</dd>
            <dt>Galleriet</dt>
            <dd>Elementerne i galleriet er tegnet med faste demodata, så hver tilstand kan vises. Modulerne og hele sider bruger rigtige data. Har ingen rigtig virksomhed data til et modul (fx Statstidende, BBR, CHR eller gemte sider), vises det med fiktive data og mærkes tydeligt.</dd>
            <dt>Bygget</dt>
            <dd>
              {fmtDate(SOURCE.generatedAt)}
              {SOURCE.commit ? `, commit ${SOURCE.commit}` : ""}
              {boot.version && boot.version !== "lokal" ? `, udrullet ${boot.version}` : ""}. Tokens fra styles.css ({SOURCE.stylesLines.toLocaleString("da-DK")} linjer), tekster fra {new Set(SOURCE.texts.map((t) => t.f)).size} kildefiler.
            </dd>
          </dl>
        </div>
        <div className="dg-about__quick">
          <h3>Genveje</h3>
          <a href={`#/moduler/${slugOf("LassoShareBars")}`}>Fordeling af balancen i alle bredder</a>
          <a href="#/sider">Hele virksomhedssider med live-data</a>
          <a href="#/fundament/farver">Farver i lys og mørk</a>
          <a href="#/tekster">Alle tekster</a>
        </div>
      </section>
    </div>
  );
}
