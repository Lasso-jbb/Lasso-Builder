import { useMemo, useState, type ReactNode } from "react";
import type { Dataset, ViewComponent } from "@lasso/spec";
import type { Ctx } from "../App.js";
import { CommentButton, type CommentTarget } from "../comments.js";
import { Frame } from "../Frame.js";
import { Markdown } from "../Markdown.js";
import { SOURCE } from "../source.js";
import { PageHead, Seg, SourceRef } from "../ui.js";
import { tokensOf } from "./PortalFrame.js";
import { ChoicePanel } from "../../portal2/ChoicePanel.js";
import { AskField, DropButton, IconButton, LassoTab, ModuleTab, RemoveTemplateDialog, Suggestions, TemplatePin } from "../../portal2/parts.js";
import { EmptyState, type EmptyKind } from "../../portal2/chat/EmptyState.js";
import { Fullscreen } from "../../portal2/chat/Fullscreen.js";
import { NoticeRow } from "../../portal2/chat/Message.js";
import { ScrollDown, Thread } from "../../portal2/chat/Thread.js";
import {
  CHOICE,
  EMPTY,
  FIXTURE_AT,
  FIXTURE_COMPANY,
  FIXTURE_PERSON,
  FULLSCREEN,
  LONG_THREAD_PAGE,
  SCENES,
  TEMPLATE,
  TEMPLATE_ADDED,
} from "../../portal2/chat/fixtures.js";
import type { Turn } from "../../portal2/thread.js";
import exportHtml from "../../../../../docs/design/chat/chat-designguide.html?raw";
import portalCss from "../../portal2/portal2.css?raw";
import "../../portal2/portal2.css";
import "../../portal2/chat/chat.css";

/**
 * Chatten (docs/design/CHAT.md): samtalen med de rigtige komponenter (apps/view/src/portal2/chat/) og eksempelsamtaler
 * (fixtures.ts), i fire bredder. Kortene får guidens egne data (ctx.boot.showcase). Paper-eksporten ligger nederst
 * som historisk kilde; koden er sandheden.
 */

export const CHAT_DOC = "docs/design/CHAT.md";

const WIDTHS = [
  { id: "1440", label: "Portal 1440", vw: 1440 },
  { id: "1200", label: "Desktop 1200", vw: 1200 },
  { id: "834", label: "Tablet 834", vw: 834 },
  { id: "390", label: "Mobil 390", vw: 390 },
] as const;

const MODULES = {
  company: ["Overblik", "Økonomi", "Regnskab", "Ejerskab", "Risiko", "Historik", "Kontakt"],
  person: ["Overblik", "Roller", "Netværk", "Ejerskab", "Risiko", "Historik"],
  global: [] as string[],
};

/** Guidens data i kortene: id'erne i fixtures byttes med showcase-virksomheden og -personen, og hvert kort får det datasæt, der kan tegne det. */
function useFill(ctx: Ctx) {
  return useMemo(() => {
    const sc = ctx.boot.showcase;
    const companyTab = sc.tabs.find((t) => t.id === "virksomhed");
    const personTab = sc.tabs.find((t) => t.id === "person");
    const table = ctx.modules.get("LassoCompanyTable" as never)?.options.find((o) => o.id === "sammenligning");
    return (turns: readonly Turn[]): Turn[] =>
      turns.map((t) => ({
        ...t,
        answer: {
          ...t.answer,
          parts: t.answer.parts.map((p) => {
            if (p.kind !== "view") return p;
            let json = JSON.stringify(p.spec);
            let dataset: Dataset = p.dataset;
            if (json.includes(FIXTURE_PERSON) && personTab) {
              json = json.split(FIXTURE_PERSON).join(personTab.entity);
              dataset = personTab.dataset;
            } else if (json.includes(FIXTURE_COMPANY) && companyTab) {
              json = json.split(FIXTURE_COMPANY).join(companyTab.entity);
              dataset = companyTab.dataset;
            } else if (table) {
              const spec = JSON.parse(json) as typeof p.spec;
              spec.components = [table.component as ViewComponent] as typeof spec.components;
              return { ...p, spec, dataset: table.dataset };
            }
            return { ...p, spec: JSON.parse(json) as typeof p.spec, dataset };
          }),
        },
      }));
  }, [ctx.boot.showcase, ctx.modules]);
}

const noop = () => undefined;

interface SceneProps {
  theme: "light" | "dark";
  mobile: boolean;
  kind?: "company" | "person" | "global";
  /** Fanens indhold (tråden eller tom tilstand). */
  children: ReactNode;
  /** Over spørgefeltet (afklaringen). */
  panel?: ReactNode;
  /** Forslagene under feltet; udeladt = ingen. */
  sugg?: readonly string[];
  pending?: boolean;
  /** Elementer over tråden i rullefladen (rul-ned-knap, fuld skærm). */
  overlay?: ReactNode;
  /** Højde på rullefladen (fuld skærm kræver en fast højde). */
  height?: number;
  /** Skabelonmodulet i modulrækken, med den røde nål. */
  template?: { title: string; kind: "company" | "person" } | null;
  dialog?: ReactNode;
}

/** Portalens flade omkring en samtale: modulrækken (Lasso først), tråden og spørgefeltet, med portalens egen stil. */
function Scene({ theme, mobile, kind = "company", children, panel, sugg, pending = false, overlay, height, template, dialog }: SceneProps) {
  const mods = MODULES[kind];
  return (
    <div className="p3 lasso-root p3-specimen p3-chat-specimen" data-theme={theme}>
      <div className="mods">
        <div className="col">
          <LassoTab on />
          {mods.length ? (
            mobile ? (
              <DropButton label={template ? template.title : "Overblik"} className="sel-btn" />
            ) : (
              <div className="mlist" role="tablist" aria-label="Moduler">
                {mods.map((m) => (
                  <ModuleTab key={m} id={m} label={m} selected={false} />
                ))}
                {template ? <ModuleTab id={`tpl:${TEMPLATE.id}`} label={template.title} selected /> : null}
              </div>
            )
          ) : null}
          {kind !== "global" ? (
            <div className="rgroup">
              {template ? <TemplatePin kind={template.kind} title={template.title} /> : null}
              <IconButton icon="rss" label="Følg" disabled />
              <IconButton icon="book" label="Gem på din liste" />
            </div>
          ) : null}
        </div>
      </div>
      <div className="scrollbox chat-specimen__box" style={height ? { height } : undefined}>
        <div className="scroll chat-specimen__scroll">
          <div className="col content is-chat">{children}</div>
        </div>
        {overlay}
      </div>
      <div className={`ask is-chat${sugg ? "" : " no-sugg"}`}>
        {panel}
        <AskField value="" placeholder="Spørg Lasso" pending={pending} />
        {sugg ? <Suggestions items={sugg} /> : null}
      </div>
      {dialog}
    </div>
  );
}

/** Tråden med handlingerne på kortene (hent, fuld skærm og Tilføj som fane), uden at noget sker. */
function Conversation({ turns, mobile, now, onAdd = true, pageSize, theme, currentId, after }: { turns: Turn[]; mobile: boolean; now?: number; onAdd?: boolean; pageSize?: number; theme: "light" | "dark"; currentId?: string; after?: (t: Turn) => ReactNode }) {
  return (
    <div className="chat">
      <Thread
        turns={turns}
        now={now}
        mobile={mobile}
        currentId={currentId}
        pageSize={pageSize}
        onUndo={noop}
        onRetry={noop}
        afterTurn={after}
        cardProps={(part) => ({ headless: true, theme, onDownload: noop, onFullscreen: noop, onAddTab: onAdd && part.form === "page" ? noop : undefined })}
      />
    </div>
  );
}

interface SceneDef {
  id: string;
  title: string;
  note: string;
  /** Fast bredde (mobilsektionen), ellers den valgte. */
  fixed?: number;
  min?: number;
  render: (c: { theme: "light" | "dark"; mobile: boolean; fill: (t: readonly Turn[]) => Turn[] }) => ReactNode;
}

const SUGG = EMPTY.suggestions;

function scenes(): SceneDef[] {
  return [
    {
      id: "anatomi",
      title: "Samtalen, anatomi",
      note: "Tråden er 800 px og centreret over inputfeltet: brugeren til højre i en grå boble, Lasso til venstre uden boble med mærket som avatar. Tidspunkt og kopiér-ikon står småt under tekstsvar.",
      render: ({ theme, mobile, fill }) => (
        <Scene theme={theme} mobile={mobile} sugg={SUGG}>
          <Conversation turns={fill(SCENES.anatomy)} mobile={mobile} theme={theme} currentId={FIXTURE_COMPANY} />
        </Scene>
      ),
    },
    {
      id: "tekst",
      title: "Svarform A, tekst",
      note: "Tekst: afsnit og punkter, tidspunkt og kopiér-ikon under svaret.",
      render: ({ theme, mobile, fill }) => (
        <Scene theme={theme} mobile={mobile} sugg={SUGG}>
          <Conversation turns={fill(SCENES.formText)} mobile={mobile} theme={theme} />
        </Scene>
      ),
    },
    {
      id: "element",
      title: "Svarform B, et element",
      note: "Et enkelt element har titel, undertitel, download og fuld skærm i rammen. Ingen Tilføj som fane.",
      render: ({ theme, mobile, fill }) => (
        <Scene theme={theme} mobile={mobile} sugg={SUGG}>
          <Conversation turns={fill(SCENES.formElement)} mobile={mobile} theme={theme} />
        </Scene>
      ),
    },
    {
      id: "side",
      title: "Svarform C, en hel side",
      note: "En sammensætning af flere elementer har desuden Tilføj som fane (primær knap; et orange ikon på mobil).",
      render: ({ theme, mobile, fill }) => (
        <Scene theme={theme} mobile={mobile} sugg={SUGG}>
          <Conversation turns={fill(SCENES.formPage)} mobile={mobile} theme={theme} />
        </Scene>
      ),
    },
    {
      id: "skabelon",
      title: "Tilføjet som fane: skabelonmodul og rød pin",
      note: "Siden er gemt som sideskabelon: den står som ekstra modul efter de indbyggede på alle virksomheder, og pinnen er rød (tilføjet på alle virksomheder).",
      render: ({ theme, mobile, fill }) => (
        <Scene theme={theme} mobile={mobile} sugg={SUGG} template={TEMPLATE}>
          <Conversation
            turns={fill(TEMPLATE_ADDED.turns)}
            mobile={mobile}
            theme={theme}
            onAdd={false}
            after={(t) => (t.id === TEMPLATE_ADDED.afterTurnId ? <NoticeRow text={TEMPLATE_ADDED.notice} /> : null)}
          />
        </Scene>
      ),
    },
    {
      id: "fjern",
      title: "Den røde pin klikket: Fjern modulet?",
      note: "Bekræftelsen fjerner skabelonen fra alle virksomheder og kan ikke fortrydes.",
      min: 460,
      render: ({ theme, mobile, fill }) => (
        <Scene
          theme={theme}
          mobile={mobile}
          sugg={SUGG}
          template={TEMPLATE}
          dialog={<RemoveTemplateDialog open kind={TEMPLATE.kind} title={TEMPLATE.title} onCancel={noop} onConfirm={noop} />}
        >
          <Conversation turns={fill(TEMPLATE_ADDED.turns)} mobile={mobile} theme={theme} onAdd={false} />
        </Scene>
      ),
    },
    {
      id: "fuldskaerm",
      title: "Fuld skærm",
      note: "Elementet i hele fladen under modulrækken: titel 18/500 med undertitel, download og kryds. Inputfeltet bliver stående.",
      render: ({ theme, mobile, fill }) => {
        const part = fill([{ id: "fs", question: "", askedAt: FIXTURE_AT, answer: { parts: [FULLSCREEN.part], pending: false } }])[0]!.answer.parts[0]!;
        return (
          <Scene
            theme={theme}
            mobile={mobile}
            sugg={undefined}
            height={mobile ? 560 : 520}
            overlay={part.kind === "view" ? <Fullscreen part={part} at={FULLSCREEN.at} mobile={mobile} theme={theme} headless onDownload={noop} onClose={noop} /> : null}
          >
            <div />
          </Scene>
        );
      },
    },
    {
      id: "bliv",
      title: "Situation 1, bliv i fanen",
      note: "Spørgsmålet giver mening i fanens kontekst, selv om det nævner en anden. Meddelelsesrækken siger, hvor svaret står.",
      render: ({ theme, mobile, fill }) => (
        <Scene theme={theme} mobile={mobile} sugg={SUGG}>
          <Conversation turns={fill(SCENES.stay)} mobile={mobile} theme={theme} currentId={FIXTURE_COMPANY} />
        </Scene>
      ),
    },
    {
      id: "ny-foer",
      title: "Situation 2, ny fane (før)",
      note: "\"Vis mig alt om …\": den gamle samtale får en meddelelsesrække med Fortryd i 10 sekunder.",
      render: ({ theme, mobile, fill }) => (
        <Scene theme={theme} mobile={mobile} sugg={SUGG}>
          <Conversation turns={fill(SCENES.newTabBefore)} mobile={mobile} now={FIXTURE_AT} theme={theme} currentId={FIXTURE_COMPANY} />
        </Scene>
      ),
    },
    {
      id: "ny-efter",
      title: "Situation 2, ny fane (efter)",
      note: "Personens egen fane med spørgsmålet som første besked og modul-links med orange ikon.",
      render: ({ theme, mobile, fill }) => (
        <Scene theme={theme} mobile={mobile} kind="person" sugg={SUGG}>
          <Conversation turns={fill(SCENES.newTabAfter)} mobile={mobile} theme={theme} currentId={FIXTURE_PERSON} />
        </Scene>
      ),
    },
    {
      id: "afklaring",
      title: "Afklaring, flere mulige match",
      note: "Et panel lige over inputfeltet, 720 px bredt (på telefon et ark): kun titel og beskrivelse, \"(Anbefalet)\", Andet-række, Spring over og Vælg.",
      min: 520,
      render: ({ theme, mobile, fill }) => (
        <Scene theme={theme} mobile={mobile} panel={<ChoicePanel choice={CHOICE} disabled={false} variant={mobile ? "sheet" : "panel"} onSend={noop} onSkip={noop} />}>
          <Conversation turns={fill(SCENES.clarify)} mobile={mobile} theme={theme} currentId={FIXTURE_COMPANY} />
        </Scene>
      ),
    },
    {
      id: "global",
      title: "Situation 3, global fane",
      note: "Spørgsmål uden ét firma eller én person: en fane med et generisk navn og Lasso-mærket som ikon. Den viser kun Lasso-modulet.",
      render: ({ theme, mobile, fill }) => (
        <Scene theme={theme} mobile={mobile} kind="global" sugg={SUGG}>
          <Conversation turns={fill(SCENES.global)} mobile={mobile} theme={theme} />
        </Scene>
      ),
    },
    {
      id: "tom",
      title: "Tom tilstand",
      note: "Hilsen med fanens navn og fire forslag som piller med pil. Forslagene under feltet skjules.",
      render: ({ theme, mobile }) => (
        <Scene theme={theme} mobile={mobile}>
          <EmptyState name={EMPTY.name} kind={EMPTY.kind as EmptyKind} suggestions={EMPTY.suggestions} />
        </Scene>
      ),
    },
    {
      id: "taenker",
      title: "Tænker",
      note: "Tre orange prikker og \"Tænker…\"; feltet er slået fra, mens Lasso svarer.",
      render: ({ theme, mobile, fill }) => (
        <Scene theme={theme} mobile={mobile} sugg={SUGG} pending>
          <Conversation turns={fill(SCENES.thinking)} mobile={mobile} theme={theme} />
        </Scene>
      ),
    },
    {
      id: "laengere",
      title: "Længere opgave",
      note: "Værktøjets titel i ord, et skelet med shimmer og Stop.",
      render: ({ theme, mobile, fill }) => (
        <Scene theme={theme} mobile={mobile} sugg={SUGG} pending>
          <Conversation turns={fill(SCENES.longTask)} mobile={mobile} theme={theme} />
        </Scene>
      ),
    },
    {
      id: "fejl",
      title: "Fejl",
      note: "Fejl står som almindelig tekst med mindst én handling: Prøv igen, eller et modul-link.",
      render: ({ theme, mobile, fill }) => (
        <Scene theme={theme} mobile={mobile} sugg={SUGG}>
          <Conversation turns={fill(SCENES.error)} mobile={mobile} theme={theme} currentId={FIXTURE_COMPANY} />
        </Scene>
      ),
    },
    {
      id: "lang",
      title: "Lang samtale",
      note: "De ældste ture hentes ind, når man ruller op (\"Indlæser ældre beskeder…\"). Rullet op vises den runde knap med pil ned.",
      render: ({ theme, mobile, fill }) => (
        <Scene theme={theme} mobile={mobile} sugg={SUGG} overlay={<ScrollDown />}>
          <Conversation turns={fill(SCENES.longThread)} mobile={mobile} theme={theme} pageSize={LONG_THREAD_PAGE} currentId={FIXTURE_COMPANY} />
        </Scene>
      ),
    },
  ];
}

function MobileScenes(): SceneDef[] {
  const mobile = (id: string, title: string, note: string, turns: keyof typeof SCENES, extra: Partial<SceneDef> = {}): SceneDef => ({
    id: `m-${id}`,
    title,
    note,
    fixed: 390,
    render: ({ theme, fill }) => (
      <Scene theme={theme} mobile sugg={SUGG}>
        <Conversation turns={fill(SCENES[turns])} mobile theme={theme} currentId={FIXTURE_COMPANY} />
      </Scene>
    ),
    ...extra,
  });
  return [
    mobile("traad", "Mobil, samtale", "16 px luft, bobler højst 280 px, inputpille 48 høj lige over bundlinjen, forslagene stablet.", "mobileThread"),
    mobile("element", "Mobil, et element", "Kun fuld skærm i rammen.", "mobileElement"),
    mobile("side", "Mobil, en side", "Tilføj som fane som et orange ikon ved siden af fuld skærm.", "mobilePage"),
    {
      id: "m-ark",
      title: "Mobil, afklaring",
      note: "Afklaringen er et ark fra bunden.",
      fixed: 390,
      min: 560,
      render: ({ theme, fill }) => (
        <Scene theme={theme} mobile panel={<ChoicePanel choice={CHOICE} disabled={false} variant="sheet" onSend={noop} onSkip={noop} />}>
          <Conversation turns={fill(SCENES.clarify)} mobile theme={theme} currentId={FIXTURE_COMPANY} />
        </Scene>
      ),
    },
  ];
}

function SceneFrame({ ctx, def, vw, fill }: { ctx: Ctx; def: SceneDef; vw: number; fill: (t: readonly Turn[]) => Turn[] }) {
  const width = def.fixed ?? vw;
  const mobile = width <= 760;
  const target: CommentTarget = {
    target: `chat:${def.id}:${width}`,
    label: `Chatten: ${def.title}, ${width} px`,
    context: { kind: "chat", ref: "apps/view/src/portal2/chat", viewport: String(width), vw: width, theme: ctx.theme },
  };
  return (
    <section className="dg-section dg-chatscene">
      <div className="dg-chatscene__head">
        <h2 className="dg-h2">{def.title}</h2>
        <CommentButton target={target} small />
      </div>
      <p className="dg-lead">{def.note}</p>
      <Frame key={`${def.id}:${width}`} vw={width} comment={target} minHeight={def.min ?? 200} label={`${def.title}, ${width} px`}>
        {def.render({ theme: ctx.theme, mobile, fill })}
      </Frame>
    </section>
  );
}

export function ChatPage({ ctx }: { ctx: Ctx }) {
  const [vw, setVw] = useState<string>("1440");
  const fill = useFill(ctx);
  const doc = SOURCE.docs.find((d) => d.file === CHAT_DOC);
  const current = WIDTHS.find((w) => w.id === vw)!;
  const list = useMemo(() => scenes(), []);
  const mobile = useMemo(() => MobileScenes(), []);
  const tokens = tokensOf(portalCss, ".p3").filter(([n]) => n.startsWith("--chat-"));
  const dark = new Map(tokensOf(portalCss, '.p3[data-theme="dark"]'));
  const html = exportHtml;
  return (
    <div className="dg-page dg-page--wide dg-page--doc">
      <PageHead
        eyebrow="Portalen"
        title="Chatten"
        lead="Samtalen med Lasso i portalens første modul: tråden, svarformerne, placeringen af svaret, afklaringen og tilstandene. Rammerne er de rigtige komponenter med eksempelsamtaler og guidens egne data; ret i koden, og guiden følger med."
      >
        <SourceRef file="apps/view/src/portal2/chat/" /> <SourceRef file="apps/view/src/portal2/chat/fixtures.ts" /> <SourceRef file="apps/view/src/portal2/chat/chat.css" /> <SourceRef file={CHAT_DOC} />
      </PageHead>

      <div className="dg-toolbar">
        <Seg label="Skærm" value={vw} items={WIDTHS.map((w) => ({ id: w.id, label: w.label }))} onChange={setVw} />
        <span className="dg-note">Rammerne tegnes i {current.vw} px; på 834 og 390 gælder telefonens og tablettens regler.</span>
      </div>

      {list.map((def) => (
        <SceneFrame key={def.id} ctx={ctx} def={def} vw={current.vw} fill={fill} />
      ))}

      <section className="dg-section">
        <h2 className="dg-h2">Mobil</h2>
        <p className="dg-lead">Altid i 390 px, uanset valget ovenfor.</p>
      </section>
      {mobile.map((def) => (
        <SceneFrame key={def.id} ctx={ctx} def={def} vw={390} fill={fill} />
      ))}

      <section className="dg-section">
        <h2 className="dg-h2">Tokens</h2>
        <p className="dg-lead">
          De nye mål i <code>.p3</code>-blokken i <code>portal2.css</code>, læst direkte derfra (lys og mørk). Resten kommer fra <code>--lasso-*</code> i Fundament.
        </p>
        <table className="dg-ptable">
          <thead>
            <tr>
              <th>Token</th>
              <th>Lys</th>
              <th>Mørk</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map(([name, value]) => (
              <tr key={name}>
                <td>
                  <code>{name}</code>
                </td>
                <td>
                  <code>{value}</code>
                </td>
                <td>{dark.get(name) ? <code>{dark.get(name)}</code> : <span className="dg-ptable__same">samme</span>}</td>
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

      <section className="dg-section">
        <h2 className="dg-h2">Paper-eksporten</h2>
        <p className="dg-lead">
          Den oprindelige designguide fra Paper (<code>docs/design/chat/chat-designguide.html</code>), som den blev eksporteret. Den er historisk kilde: koden og <code>CHAT.md</code> er sandheden, og eksporten afviger bevidst to steder (midterprikken og knapstørrelsen).
        </p>
        <div className="dg-toolbar">
          <button type="button" className="dg-linkbtn" onClick={() => openExport(html)}>
            Åbn i nyt vindue
          </button>
        </div>
        <iframe className="dg-export" title="Chat-designguiden fra Paper (eksport)" srcDoc={html} sandbox="allow-scripts allow-same-origin" loading="lazy" />
      </section>
    </div>
  );
}

function openExport(html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
