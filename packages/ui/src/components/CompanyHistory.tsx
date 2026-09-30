import { useState } from "react";
import {
  formatDate,
  isPersonId,
  RELATION_GROUP_LABELS,
  RELATION_GROUP_ORDER,
  type BeneficialOwnershipVM,
  type CompanyHistoryVM,
  type RelationEntryVM,
  type RelationGroup,
} from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, stateForError } from "../primitives.js";

/** "2014-06-01" -> "01.06.2014"; tom = "". */
const d = (v?: string) => (v ? formatDate(v) : "");

function Name({ e, onOpen }: { e: { name: string; lassoId?: string }; onOpen?: (a: ViewAction) => void }) {
  if (onOpen && e.lassoId && (e.lassoId.startsWith("CVR-1-") || isPersonId(e.lassoId))) {
    const kind = e.lassoId.startsWith("CVR-1-") ? "open-company" : "open-person";
    return (
      <button type="button" className="lasso-link" onClick={() => onOpen({ kind, lassoId: e.lassoId!, name: e.name })}>
        {e.name}
      </button>
    );
  }
  return <span className="lasso-reltable__name">{e.name}</span>;
}

/** Periode højrestillet som i portalen: "01.06.2014  -" eller "14.05.2012  -  31.05.2014". */
function Period({ from, to }: { from?: string; to?: string }) {
  return (
    <span className="lasso-reltable__period">
      <span>{d(from)}</span>
      <span className="lasso-reltable__dash">-</span>
      <span>{d(to)}</span>
    </span>
  );
}

/** Ét afsnit (nuværende eller historiske) med grupperne som rækker og en foldeknap i overskriften. */
function RelationsBlock({ title, entries, groups, beneficial, current, onOpen }: { title: string; entries: RelationEntryVM[]; groups: readonly RelationGroup[]; beneficial?: BeneficialOwnershipVM; current: boolean; onOpen?: (a: ViewAction) => void }) {
  const [open, setOpen] = useState(true);
  const byGroup = groups
    .map((g) => ({ g, rows: entries.filter((e) => e.group === g).sort((a, b) => (b.from ?? "").localeCompare(a.from ?? "")) }))
    .filter((x) => x.rows.length || (x.g === "reelle-ejere" && current));
  return (
    <div className="lasso-reltable">
      <button type="button" className="lasso-reltable__head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className="lasso-reltable__chev" aria-hidden="true">{open ? "⌃" : "⌄"}</span>
      </button>
      {open ? (
        byGroup.length === 0 ? (
          <div className="lasso-reltable__empty lasso-small lasso-muted">Ingen relationer.</div>
        ) : (
          byGroup.map(({ g, rows }) => (
            <div className="lasso-reltable__group" key={g}>
              <div className="lasso-reltable__label">
                {RELATION_GROUP_LABELS[g]}
                {g === "reelle-ejere" ? <div className="lasso-reltable__sublabel">Egenregistrering</div> : null}
              </div>
              <div className="lasso-reltable__rows">
                {g === "reelle-ejere" && rows.length === 0 ? (
                  <div className="lasso-reltable__row">
                    {beneficial?.owners.length ? (
                      <span>{beneficial.owners.map((o) => o.name).join(", ")}</span>
                    ) : (
                      // Som portalen: reelle ejere er skjult uden tilkøbet (401); forklaringen står i tooltip.
                      <span className="lasso-reltable__hidden" title="Information om reelle ejere er skjult for jeres organisation. Kontakt Lasso for at høre nærmere.">
                        Reelle ejere skjult
                      </span>
                    )}
                  </div>
                ) : (
                  rows.map((e, i) => (
                    <div className="lasso-reltable__row" key={`${e.name}-${e.from ?? i}`}>
                      <div>
                        <Name e={e} onOpen={onOpen} />
                        {e.role ? <span className="lasso-reltable__role"> ({e.role})</span> : null}
                        {g === "legale-ejere" && (e.share || e.votes) ? (
                          <div className="lasso-reltable__share">
                            {e.share ? `Ejer: ${e.share.replace(/\s?%$/, "%")}` : ""}
                            {e.share && e.votes ? ", " : ""}
                            {e.votes ? `Stemmeret: ${e.votes.replace(/\s?%$/, "%")}` : ""}
                          </div>
                        ) : null}
                      </div>
                      <Period from={e.from} to={e.to} />
                    </div>
                  ))
                )}
              </div>
            </div>
          ))
        )
      ) : null}
    </div>
  );
}

/**
 * Portalens nuværende og historiske relationer (Stamoplysninger, Jakob 30.09): grupper som rækker
 * (Adm. direktører, Direktion, Bestyrelse, Stiftere, Legale ejere med ejerandel og stemmeret, Reelle
 * ejere), navne som links og fra–til højrestillet.
 */
export function RelationsTable({
  history,
  beneficial,
  show = "current",
  groups = RELATION_GROUP_ORDER,
  title,
  error,
  onOpen,
}: {
  history?: CompanyHistoryVM;
  beneficial?: BeneficialOwnershipVM;
  show?: "current" | "former" | "all";
  groups?: readonly RelationGroup[];
  title?: string;
  error?: string;
  onOpen?: (a: ViewAction) => void;
}) {
  if (!history) {
    return (
      <Section title={title} span="full">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={8} />}
      </Section>
    );
  }
  const current = history.relations.filter((r) => r.current);
  const former = history.relations.filter((r) => !r.current);
  const blocks: { title: string; entries: RelationEntryVM[]; current: boolean }[] = [];
  if (show !== "former") blocks.push({ title: show === "current" && title ? title : "Nuværende relationer", entries: current, current: true });
  if (show !== "current") blocks.push({ title: show === "former" && title ? title : "Historiske relationer", entries: former, current: false });
  return (
    <div className="lasso-reltable-wrap">
      {blocks.map((b) => (
        <RelationsBlock key={b.title} title={b.title} entries={b.entries} groups={groups} beneficial={beneficial} current={b.current} onOpen={onOpen} />
      ))}
      {history.source === "current" && show !== "current" && former.length === 0 ? (
        <div className="lasso-reltable__note lasso-small lasso-muted">Historiske relationer kræver Lassos historik, som ikke kunne hentes. Fratrådte vises, når de findes i de nuværende data.</div>
      ) : null}
    </div>
  );
}

/**
 * Portalens "Stamdata historik": én række pr. oplysning (navn, adresse, ansatte, branche, kapital,
 * kontakt) med de seneste `limit` værdier og fra–til højrestillet; "Vis alle" folder resten ud.
 */
export function CompanyHistory({ history, fields, limit = 3, title = "Stamdata historik", error }: { history?: CompanyHistoryVM; fields?: readonly string[]; limit?: number; title?: string; error?: string }) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(true);
  if (!history) {
    return (
      <Section title={title} span="full">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={8} />}
      </Section>
    );
  }
  const list = fields ? fields.flatMap((k) => history.fields.filter((f) => f.key === k)) : history.fields;
  return (
    <div className="lasso-reltable">
      <button type="button" className="lasso-reltable__head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className="lasso-reltable__chev" aria-hidden="true">{open ? "⌃" : "⌄"}</span>
      </button>
      {open ? (
        list.length === 0 ? (
          <div className="lasso-reltable__empty">
            <DataState state="empty" inline reason={history.note || "Lasso har ingen stamdatahistorik for virksomheden."} />
          </div>
        ) : (
          list.map((f) => {
            const all = openKeys.has(f.key);
            const shown = all ? f.entries : f.entries.slice(0, limit);
            return (
              <div className="lasso-reltable__group" key={f.key}>
                <div className="lasso-reltable__label">{f.label}</div>
                <div className="lasso-reltable__rows">
                  {shown.map((e, i) => (
                    <div className="lasso-reltable__row" key={`${e.value}-${e.from ?? i}`}>
                      <span>{e.value}</span>
                      <Period from={e.from} to={e.to} />
                    </div>
                  ))}
                  {f.entries.length > limit ? (
                    <button type="button" className="lasso-link lasso-reltable__more" onClick={() => setOpenKeys((s) => { const n = new Set(s); if (n.has(f.key)) n.delete(f.key); else n.add(f.key); return n; })}>
                      {all ? "Vis færre" : "Vis alle"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )
      ) : null}
    </div>
  );
}
