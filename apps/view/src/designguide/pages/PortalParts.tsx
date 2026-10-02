import type { ReactNode } from "react";
import { LassoWordmark } from "@lasso/ui";
import { P2_ICON_NAMES, P2Icon } from "../../portal2/icons.js";
import type { SearchRow } from "../../portal2/model.js";
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
} from "../../portal2/parts.js";
import "../../portal2/portal2.css";

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

        <Spec label="Søgeresultater, varianter" note="Statusfilter åbent og inaktivt firma · personer · seneste · ingen match">
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

        <Spec label="Åbne faner" note="Inaktiv · aktiv · Lasso henter (mærket bevæger sig) · Flere">
          <div className="spec-tabs">
            <div className="otabs">
              <OpenTab name="Eksempel Transport A/S" sub="Vejle, CVR 99000004" active={false} />
              <OpenTab name="Eksempel Byg A/S" sub="Silkeborg, CVR 99000001" active />
              <OpenTab name="Anne Eksempel" active={false} busy />
            </div>
            <DropButton label="Flere" className="openall" />
          </div>
        </Spec>

        <Spec label="Åben fane, eneste synlige" note="Når kun den aktive er plads til, bliver den en dropdown med alle åbne">
          <div className="spec-tabs">
            <div className="otabs">
              <OpenTab name="Eksempel Byg A/S" active solo />
            </div>
          </div>
        </Spec>

        <Spec label="Modulrække" note="Lasso-fanen (slået fra uden svar), moduler, Flere, Følg (kommer senere) og Gem">
          <div className="mods">
            <div className="col">
              <LassoTab on={false} disabled />
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

        <Spec label="Modulrække, Lassos svar" note="Lasso-fanen valgt · mens Lasso henter · Gemt">
          <div className="dg-specrow dg-specrow--stack">
            <div className="mods">
              <div className="col">
                <LassoTab on />
                <div className="mlist">
                  {MODULES.slice(0, 4).map((m) => (
                    <ModuleTab key={m} id={m} label={m} selected={false} />
                  ))}
                </div>
                <div className="rgroup">
                  <IconButton icon="rss" label="Følg" disabled />
                  <IconButton icon="book" label="Gemt" on pressed />
                </div>
              </div>
            </div>
            <div className="mods">
              <div className="col">
                <LassoTab on busy />
                <div className="mlist">
                  {MODULES.slice(0, 4).map((m) => (
                    <ModuleTab key={m} id={m} label={m} selected={false} />
                  ))}
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

        <Spec label="Menu" note="Åbne faner (flueben på den aktive, luk på de andre) og Luk alle andre · modulmenu · telefonens ⋯">
          <div className="dg-specrow">
            <div className="dd">
              <MenuItem icon="build" label="Eksempel Byg A/S" current />
              <MenuItem icon="build" label="Eksempel Transport A/S" onClose={() => undefined} />
              <MenuItem icon="user" label="Anne Eksempel" onClose={() => undefined} />
              <hr />
              <MenuItem label="Luk alle andre faner" muted />
            </div>
            <div className="dd">
              <MenuItem label="Lassos svar" />
              {MODULES.slice(4).map((m, i) => (
                <MenuItem key={m} label={m} current={i === 0} />
              ))}
            </div>
            <div className="dd">
              <MenuItem icon="theme" label="Mørkt tema" />
              <MenuItem icon="bell" label="Notifikationer (kommer senere)" />
              <MenuItem icon="user" label="Jakob" />
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

        <Spec label="Spørgefelt" note="Tomt med pladsholder · med tekst · Lasso svarer (Stop) · slået fra · forslag">
          <div className="ask">
            <AskField value="" placeholder="Spørg om Eksempel Byg A/S" />
            <AskField value="Hvem ejer firmaet?" placeholder="" />
            <AskField value="" placeholder="Spørg om Eksempel Byg A/S" pending />
            <AskField value="" placeholder="Chatten er ikke slået til" disabled />
            <Suggestions items={["Hvordan går det økonomisk?", "Hvem ejer Eksempel Byg A/S?", "Er der røde flag?"]} />
          </div>
        </Spec>

        <Spec label="Bundbjælke (telefon)" note="Lasso-knappen åbner spørgefeltet; kapslen har Søg, Værktøjer og Lister">
          <div className="dg-specrow">
            <BottomBar homeOn />
            <BottomBar busy searchOn />
          </div>
        </Spec>

        <Spec label="Ikoner" note="24 × 24, streg 1,5, runde ender; farven følger knappen">
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
