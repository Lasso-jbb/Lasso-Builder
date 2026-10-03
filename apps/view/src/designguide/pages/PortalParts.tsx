import type { ReactNode } from "react";
import { LassoMark, LassoWordmark } from "@lasso/ui";
import { P2_ICON_NAMES, P2Icon } from "../../portal2/icons.js";
import { LASSO_TAB, suggestions, type OpenItem, type SearchRow } from "../../portal2/model.js";
import {
  AskField,
  BottomBar,
  DropButton,
  IconButton,
  LassoTab,
  MenuItem,
  ModuleTab,
  OpenTab,
  SearchEmpty,
  SearchField,
  SearchResultRow,
  SearchTabs,
  StatusFilterMenu,
  Suggestions,
  TemplatePin,
} from "../../portal2/parts.js";
import { AssistantMessage, UserBubble } from "../../portal2/chat/Message.js";
import { FIXTURE_AT } from "../../portal2/chat/fixtures.js";
import "../../portal2/portal2.css";
import "../../portal2/chat/chat.css";

/**
 * Portalens elementer og knapper i alle tilstande (designguidens side "Portalens ramme"). Det er de samme
 * komponenter, portalen er bygget af (apps/view/src/portal2/parts.tsx), med eksempeldata og uden handlinger.
 */

const ROWS: SearchRow[] = [
  { kind: "company", id: "1", name: "Eksempel Byg A/S", meta: "Silkeborg, CVR 99000001" },
  { kind: "company", id: "2", name: "Eksempel Revision Midt ApS", meta: "Aarhus C, CVR 99000002" },
  { kind: "company", id: "3", name: "Eksempel Transport A/S", meta: "Vejle, CVR 99000004" },
];
const INACTIVE: SearchRow = { kind: "company", id: "4", name: "Eksempel Tømrer ApS", meta: "Viborg, CVR 99000006", status: "Ophørt" };
const PERSON: SearchRow = { kind: "person", id: "5", name: "Anne Eksempel", meta: "Silkeborg" };
const MODULES = ["Overblik", "Økonomi", "Regnskab", "Ejerskab", "Risiko", "Historik", "Kontakt"];
const LONG = ["Eksempel Byg A/S", "Eksempel Revision Midt ApS", "Eksempel Transport A/S", "Eksempel Maskinfabrik A/S", "Anne Eksempel"];

/** Forslagene under spørgefeltet, side for side, læst fra model.ts (suggestions). */
const SUGGESTION_PAGES: { label: string; item?: OpenItem }[] = [
  { label: "Forsiden" },
  ...[
    ["overblik", "Overblik"],
    ["oekonomi", "Økonomi"],
    ["regnskab", "Regnskab"],
    ["ejerskab", "Ejerskab"],
    ["risiko", "Risiko"],
    ["historik", "Historik"],
    ["kontakt", "Kontakt"],
    [LASSO_TAB, "Lasso"],
  ].map(([tab, label]) => ({ label: `Firma · ${label}`, item: { key: "CVR-1-99000001", kind: "company" as const, name: "Eksempel Byg A/S", tab: tab! } })),
  ...[
    ["overblik", "Overblik"],
    ["roller", "Roller"],
    ["netvaerk", "Netværk"],
    ["ejerskab", "Ejerskab"],
    ["risiko", "Risiko"],
    ["historik", "Historik"],
  ].map(([tab, label]) => ({ label: `Person · ${label}`, item: { key: "CVR-3-1", kind: "person" as const, name: "Anne Eksempel", tab: tab! } })),
  { label: "Resultat (søgning, liste, sammenligning)", item: { key: "result:1", kind: "result", name: "Søgning", tab: LASSO_TAB } },
];

function Spec({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <div className="dg-spec">
      <div className="dg-spec__label">
        {label}
        {note ? <span className="dg-spec__note">{note}</span> : null}
      </div>
      <div className="dg-spec__body">{children}</div>
    </div>
  );
}

export function PortalParts({ theme }: { theme: "light" | "dark" }) {
  return (
    <div className="p3 p3-specimen" data-theme={theme}>
      <div className="dg-specgrid">
        <Spec label="Topbjælke" note="Logo, søgefelt, tema, notifikationer (kommer senere) og profil">
          <div className="top spec-top">
            <LassoWordmark className="wordmark" />
            <div className="searchwrap">
              <SearchField value="" />
            </div>
            <div className="right">
              <IconButton icon="theme" label="Tema" />
              <IconButton icon="bell" label="Notifikationer" disabled />
              <IconButton icon="user" label="Profil" />
            </div>
          </div>
        </Spec>

        <Spec label="Søgefelt" note="Tom · med fokus · med tekst, mens Lasso søger (spinner og ryd)">
          <div className="dg-specrow">
            <div className="searchwrap">
              <SearchField value="" />
            </div>
            <div className="searchwrap">
              <SearchField value="" focus />
            </div>
            <div className="searchwrap">
              <SearchField value="Eksempel" focus busy />
            </div>
          </div>
        </Spec>

        <Spec label="Søgeresultater" note="Faner med antal, statusfilter, valgt række med genveje (Økonomi, Ejerskab, Historik), Se alle">
          <div className="sdrop">
            <div className="sr-head">
              <SearchTabs type="f" counts={{ f: 13, p: 12 }} />
              <StatusFilterMenu status="Aktive" open={false} />
            </div>
            <div className="sr-list">
              {ROWS.map((r, i) => (
                <SearchResultRow key={r.id} row={r} query="Eksempel" selected={i === 0} />
              ))}
            </div>
            <div className="sr-foot">
              <button type="button" className="seeall">
                Se alle firmaer for "Eksempel"
              </button>
            </div>
          </div>
        </Spec>

        <Spec label="Søgeresultater, varianter" note="Statusfilter åbent og inaktivt firma (status lige efter navnet) · personer · seneste · ingen match">
          <div className="dg-specrow">
            <div className="sdrop">
              <div className="sr-head">
                <SearchTabs type="f" counts={{ f: 2, p: 0 }} />
                <StatusFilterMenu status="Alle" open />
              </div>
              <div className="sr-list">
                <SearchResultRow row={INACTIVE} query="Eksempel" selected={false} showStatus />
              </div>
            </div>
            <div className="sdrop">
              <div className="sr-head">
                <SearchTabs type="p" counts={{ f: 13, p: 12 }} />
              </div>
              <div className="sr-list">
                <SearchResultRow row={PERSON} query="Eksempel" selected />
              </div>
            </div>
            <div className="sdrop">
              <div className="sr-list">
                <div className="sr-label">
                  Seneste
                  <button type="button">Ryd</button>
                </div>
                <SearchResultRow row={ROWS[2]!} query="" selected={false} />
              </div>
            </div>
            <div className="sdrop">
              <SearchEmpty query="hvem leverer kaffe i Aarhus" />
            </div>
          </div>
        </Spec>

        <Spec label="Åbne faner" note="Inaktiv · aktiv · Lasso henter (mærket bevæger sig); er der mere end én fane, har alle samme bredde">
          <div className="spec-tabs spec-even">
            <div className="otabs">
              <OpenTab name="Eksempel Transport A/S" sub="Vejle, CVR 99000004" active={false} />
              <OpenTab name="Eksempel Byg A/S" sub="Silkeborg, CVR 99000001" active />
              <OpenTab name="Anne Eksempel" active={false} busy />
            </div>
          </div>
        </Spec>

        <Spec label="Åben fane, eneste synlige" note="Når kun den aktive er plads til, bliver den en dropdown med alle åbne">
          <div className="spec-tabs">
            <div className="otabs">
              <OpenTab name="Eksempel Byg A/S" active solo />
            </div>
          </div>
        </Spec>

        <Spec label="Modulrække" note="Lasso-modulet (altid slået til), moduler, Flere, Følg (kommer senere) og Gem">
          <div className="mods">
            <div className="col">
              <LassoTab on={false} />
              <div className="mlist">
                {MODULES.slice(0, 5).map((m, i) => (
                  <ModuleTab key={m} id={m} label={m} selected={i === 0} />
                ))}
                <DropButton label="Flere" className="tab more" />
              </div>
              <div className="rgroup">
                <IconButton icon="rss" label="Følg" disabled />
                <IconButton icon="book" label="Gem" />
              </div>
            </div>
          </div>
        </Spec>

        <Spec label="Modulrække, Lasso" note="Lasso-modulet valgt · med skabelonmodul og rød pin · mens Lasso henter · Gemt">
          <div className="dg-specrow dg-specrow--stack">
            <div className="mods">
              <div className="col">
                <LassoTab on />
                <div className="mlist">
                  {MODULES.slice(0, 5).map((m) => (
                    <ModuleTab key={m} id={m} label={m} selected={false} />
                  ))}
                  <DropButton label="Flere" className="tab more" />
                </div>
                <div className="rgroup">
                  <IconButton icon="rss" label="Følg" disabled />
                  <IconButton icon="book" label="Gemt" on pressed />
                </div>
              </div>
            </div>
            <div className="mods">
              <div className="col">
                <LassoTab on />
                <div className="mlist">
                  {MODULES.slice(0, 5).map((m) => (
                    <ModuleTab key={m} id={m} label={m} selected={false} />
                  ))}
                  <ModuleTab id="tpl:fx" label="KYC-overblik" selected={false} />
                  <DropButton label="Flere" className="tab more" />
                </div>
                <div className="rgroup">
                  <TemplatePin kind="company" title="KYC-overblik" />
                  <IconButton icon="rss" label="Følg" disabled />
                  <IconButton icon="book" label="Gem" />
                </div>
              </div>
            </div>
            <div className="mods">
              <div className="col">
                <LassoTab on busy />
                <div className="mlist">
                  {MODULES.slice(0, 5).map((m) => (
                    <ModuleTab key={m} id={m} label={m} selected={false} />
                  ))}
                  <DropButton label="Flere" className="tab more" />
                </div>
                <div className="rgroup">
                  <IconButton icon="rss" label="Følg" disabled />
                  <IconButton icon="book" label="Gem" />
                </div>
              </div>
            </div>
          </div>
        </Spec>

        <Spec label="Modulvælger" note="Er der plads til færre end to moduler (fx telefon), bliver rækken en vælger">
          <div className="mods" style={{ maxWidth: 390 }}>
            <div className="col">
              <LassoTab on={false} />
              <DropButton label="Overblik" className="sel-btn" />
              <div className="rgroup">
                <IconButton icon="rss" label="Følg" disabled />
                <IconButton icon="book" label="Gem" />
              </div>
            </div>
          </div>
        </Spec>

        <Spec label="Menu" note="Åbne faner (flueben på den aktive, luk på de andre) og Luk alle andre · Flere (de skjulte moduler) · modulvælgeren (Lasso og alle moduler)">
          <div className="dg-specrow">
            <div className="dd">
              <MenuItem icon="build" label="Eksempel Byg A/S" current />
              <MenuItem icon="build" label="Eksempel Transport A/S" onClose={() => undefined} />
              <MenuItem icon="user" label="Anne Eksempel" onClose={() => undefined} />
              <hr />
              <MenuItem label="Luk alle andre faner" muted />
            </div>
            <div className="dd">
              {MODULES.slice(5).map((m, i) => (
                <MenuItem key={m} label={m} current={i === 0} />
              ))}
            </div>
            <div className="dd">
              <MenuItem label="Lasso" />
              {MODULES.map((m, i) => (
                <MenuItem key={m} label={m} current={i === 0} />
              ))}
            </div>
          </div>
        </Spec>

        <Spec label="Ikonknapper og skinne" note="Normal · valgt (koral) · kommer senere (dæmpet) · tooltip">
          <div className="dg-specrow">
            <IconButton icon="book" label="Gem" />
            <IconButton icon="book" label="Gemt" on />
            <IconButton icon="rss" label="Følg" disabled />
            <nav className="rail">
              <IconButton icon="grid" label="Værktøjer" tip="Værktøjer" on />
              <span className="show-tip">
                <IconButton icon="folder" label="Lister" tip="Lister" />
              </span>
              <IconButton icon="bolt" label="Handlinger" tip="Handlinger" disabled />
              <hr />
              <IconButton icon="user" label="Profil" tip="Profil" disabled />
              <IconButton icon="card" label="Abonnement" tip="Abonnement" disabled />
              <IconButton icon="plug" label="Integrationer" tip="Integrationer" disabled />
              <IconButton icon="build" label="Firma" tip="Firma" disabled />
              <IconButton icon="layers" label="Moduler" tip="Moduler" disabled />
              <IconButton icon="users" label="Brugere" tip="Brugere" disabled />
            </nav>
          </div>
        </Spec>

        <Spec label="Spørgefelt" note="Tomt (altid &quot;Spørg Lasso&quot;) · med tekst · Lasso svarer (Stop) · slået fra · forslag efter siden">
          <div className="ask">
            <AskField value="" placeholder="Spørg Lasso" />
            <AskField value="Hvem ejer firmaet?" placeholder="" />
            <AskField value="" placeholder="Spørg Lasso" pending />
            <AskField value="" placeholder="Spørg Lasso" disabled />
            <Suggestions items={suggestions({ key: "CVR-1-99000001", kind: "company", name: "Eksempel Byg A/S", tab: "overblik" })} />
          </div>
        </Spec>

        <Spec label="Bundbjælke (telefon)" note="Værktøjer valgt · Lasso svarer (mærket bevæger sig). Lasso-knappen åbner spørgefeltet; kapslen har Søg, Værktøjer og Lister">
          <div className="dg-specrow">
            <BottomBar homeOn />
            <BottomBar busy />
          </div>
        </Spec>

        <Spec label="Åbne faner, mange" note="Ens bredde (højst 170 px, mindst 120 px); navnet bruger hele bredden, krydset ligger over navnets ende ved hover">
          <div className="spec-tabs spec-even">
            <div className="otabs">
              {LONG.map((n, i) => (
                <OpenTab key={n} name={n} active={i === 1} />
              ))}
            </div>
            <DropButton label="Flere" className="openall" />
          </div>
        </Spec>

        <Spec label="Forsiden" note="Når ingen fane er valgt (Værktøjer eller logoet; de åbne faner bliver stående); mærket bevæger sig, mens Lasso svarer">
          <div className="spec-page">
            <div className="home">
              <LassoMark className="home__mark" />
              <h1>Hvad vil du vide?</h1>
              <p>Søg efter et firma eller en person ovenfor, eller spørg Lasso nedenfor. Svaret vises her.</p>
            </div>
          </div>
        </Spec>

        <Spec label="Samtalen" note="Lassos svar, tænker og fejl, med de samme komponenter som chatten (hele samtalen står på siden Chatten)">
          <div className="dg-specrow dg-specrow--stack">
            <div className="spec-page chat-specimen">
              <div className="chat-thread">
                <div className="chat-turn">
                  <UserBubble text="Hvordan går det økonomisk?" />
                  <AssistantMessage answer={{ parts: [{ kind: "text", text: "Det går **godt**: omsætningen steg 12 % og overskuddet 8 % i seneste regnskab. Soliditeten er 41 %." }], pending: false, at: FIXTURE_AT }} />
                </div>
              </div>
            </div>
            <div className="spec-page chat-specimen">
              <div className="chat-thread">
                <div className="chat-turn">
                  <UserBubble text="Er der røde flag?" />
                  <AssistantMessage answer={{ parts: [], pending: true }} />
                </div>
              </div>
            </div>
            <div className="spec-page chat-specimen">
              <div className="chat-thread">
                <div className="chat-turn">
                  <UserBubble text="Sammenlign med branchen" />
                  <AssistantMessage answer={{ parts: [], pending: false, error: "Claude har travlt lige nu.", at: FIXTURE_AT }} onRetry={() => undefined} />
                </div>
              </div>
            </div>
          </div>
        </Spec>

        <Spec label="Besked" note="Kort besked øverst i indholdet ved fejl (fx når Gem fejler, chatten ikke er slået til, eller man er logget ud); lukkes med ×">
          <div className="spec-notice">
            <div className="notice" role="status">
              Du er logget ud. Genindlæs siden.
              <button type="button" aria-label="Luk">
                ×
              </button>
            </div>
          </div>
        </Spec>

        <Spec label="Forslag under spørgefeltet" note="Følger siden: forsiden, et resultat eller firmaets/personens modul (model.ts, suggestions)">
          <table className="dg-ptable spec-sugg">
            <thead>
              <tr>
                <th>Side</th>
                <th>Forslag</th>
              </tr>
            </thead>
            <tbody>
              {SUGGESTION_PAGES.map((p) => (
                <tr key={p.label}>
                  <td>{p.label}</td>
                  <td>{suggestions(p.item).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Spec>

        <Spec label="Ikoner" note="24 × 24, streg 1,25 (1,5 i topbjælke, skinne og bundbjælke), runde ender; farven følger knappen">
          <div className="spec-icons">
            {P2_ICON_NAMES.map((n) => (
              <div key={n}>
                <P2Icon name={n} />
                {n}
              </div>
            ))}
          </div>
        </Spec>
      </div>
    </div>
  );
}
