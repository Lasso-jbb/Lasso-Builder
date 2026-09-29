/**
 * Kriteriechips og redigering i bundark (15/26c.8) til tabellens værktøjslinje. FilterPanel.tsx er
 * det fulde filterpanel (02a/02b); dette er den kompakte udgave i tabellen.
 */
import { useMemo, useState } from "react";
import {
  FIELD_BY_KEY,
  FIELDS,
  formatCriterion,
  formatCriterionValue,
  formatNumber,
  operatorLabel,
  OPERATORS_BY_TYPE,
  validateCriteria,
  type Criterion,
  type FieldDef,
  type Operator,
} from "@lasso/spec";
import { Dialog } from "./Dialog.js";
import { ChoiceChips, Toggle } from "./Fields.js";

/**
 * Filterpanelet over et resultat: viser det, AI'en forstod, som tags og lader
 * brugeren rette det. Følger "Filterfelter" i designdokumentet: operatoren
 * står først og bestemmer rækken, under seks faste værdier bliver til chips,
 * "Ryd" tømmer feltet, og intet ændres, før man trykker "Opdater målgruppe".
 */

interface Draft {
  id: number;
  field: string;
  operator: Operator;
  values: string[];
  isNew: boolean;
}

const CHIP_LIMIT = 6;
let nextId = 1;

function isChipField(f: FieldDef | undefined): boolean {
  return f?.type === "enum" && (f.options?.length ?? 0) < CHIP_LIMIT;
}

function toDraft(c: Criterion, isNew = false): Draft {
  const f = FIELD_BY_KEY.get(c.field);
  const raw = Array.isArray(c.value) ? c.value : [c.value];
  let operator = c.operator;
  if (isChipField(f)) operator = operator === "neq" || operator === "not_in" ? "not_in" : "in";
  return { id: nextId++, field: c.field, operator, values: raw.map((v) => valueToText(f, v)), isNew };
}

function valueToText(f: FieldDef | undefined, v: string | number | boolean): string {
  if (typeof v === "number" && f?.type === "amount") return new Intl.NumberFormat("da-DK").format(v);
  if (typeof v === "string" && f?.type === "date") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  }
  return String(v);
}

/** "10.000.000", "10 mio", "2,5 mio." -> 10000000 osv. */
function parseAmount(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/kr\.?$/, "").trim();
  const m = /^(-?[\d.\s]*\d(?:,\d+)?)\s*(mia\.?|mio\.?|t\.?|tkr\.?)?$/.exec(t);
  if (!m) return null;
  const n = Number(m[1]!.replace(/[.\s]/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const unit = m[2] ?? "";
  const mult = unit.startsWith("mia") ? 1e9 : unit.startsWith("mio") ? 1e6 : unit.startsWith("t") ? 1e3 : 1;
  return Math.round(n * mult);
}

/** "dd.mm.åååå" (eller ÅÅÅÅ-MM-DD) -> "ÅÅÅÅ-MM-DD" */
function parseDate(text: string): string | null {
  const t = text.trim();
  let m = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  return m ? t : null;
}

function parseOne(f: FieldDef | undefined, text: string): string | number | null {
  const t = text.trim();
  if (!t) return null;
  if (f?.type === "amount") return parseAmount(t);
  if (f?.type === "number") {
    const n = Number(t.replace(/[.\s]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (f?.type === "date") return parseDate(t);
  return t;
}

function fromDraft(d: Draft): { criterion?: Criterion; error?: string } {
  const f = FIELD_BY_KEY.get(d.field);
  const values = d.values.map((v) => parseOne(f, v));
  if (values.length === 0 || values.every((v) => v === null)) return { error: "Mangler en værdi" };
  if (values.some((v) => v === null)) {
    return { error: f?.type === "date" ? "Skriv datoen som dd.mm.åååå" : f?.type === "amount" ? "Skriv et beløb, fx 10.000.000" : "Ugyldig værdi" };
  }
  const clean = values as (string | number)[];
  let operator = d.operator;
  let value: Criterion["value"];
  if (operator === "between") {
    if (clean.length < 2) return { error: "Udfyld begge felter" };
    value = [clean[0]!, clean[1]!];
  } else if (operator === "in" || operator === "not_in") {
    if (clean.length === 1 && isChipField(f)) operator = operator === "in" ? "eq" : "neq";
    value = operator === "eq" || operator === "neq" ? clean[0]! : clean;
  } else {
    value = clean[0]!;
  }
  const criterion: Criterion = { field: d.field, operator, value };
  const issue = validateCriteria([criterion])[0];
  return issue ? { error: issue.message } : { criterion };
}

/**
 * Redigering af kriterierne. "inline" står i rammen over resultatet (desktop); "sheet" er
 * indholdet i bundarket (26c.8): 48 px rækker, 36 px valgchips og en primær knap i fuld
 * bredde nederst, der viser antallet af filtre, med "Annuller" som tekstknap under.
 */
export function FilterEditor({
  criteria,
  onApply,
  onCancel,
  layout = "inline",
}: {
  criteria: readonly Criterion[];
  onApply: (c: Criterion[]) => void;
  onCancel: () => void;
  layout?: "inline" | "sheet";
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() => criteria.map((c) => toDraft(c)));
  const [showErrors, setShowErrors] = useState(false);
  const update = (id: number, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const results = useMemo(() => drafts.map(fromDraft), [drafts]);
  const unused = FIELDS.filter((f) => !drafts.some((d) => d.field === f.key));
  const onlyAdditions = drafts.length > criteria.length && drafts.slice(0, criteria.length).every((d, i) => JSON.stringify(fromDraft(d).criterion) === JSON.stringify(criteria[i]));

  const apply = () => {
    if (results.some((r) => r.error)) return setShowErrors(true);
    onApply(results.map((r) => r.criterion!));
  };
  const sheet = layout === "sheet";
  const count = drafts.length;

  return (
    <section className={`lasso-filters ${sheet ? "lasso-filters--sheet" : ""}`} aria-label="Filtre">
      {drafts.map((d, i) => {
        const f = FIELD_BY_KEY.get(d.field);
        const err = showErrors ? results[i]?.error : undefined;
        return (
          <div className="lasso-filter-row" key={d.id}>
            <div className="lasso-filter-row__name">
              {f?.label ?? d.field}
              {err ? <span className="lasso-required" aria-hidden="true">*</span> : null}
            </div>
            <div className="lasso-filter-row__control">
              <FieldControl draft={d} field={f} invalid={Boolean(err)} onChange={(patch) => update(d.id, patch)} />
            </div>
            <button className="lasso-btn lasso-btn--ghost lasso-filter-row__clear" onClick={() => setDrafts((ds) => ds.filter((x) => x.id !== d.id))}>
              Ryd
            </button>
            {err ? <div className="lasso-filter-row__error">{err}</div> : null}
          </div>
        );
      })}

      {unused.length > 0 ? (
        <div className="lasso-filter-add">
          <select
            className="lasso-select lasso-select--add"
            value=""
            aria-label="Tilføj filter"
            onChange={(e) => {
              const f = FIELD_BY_KEY.get(e.target.value);
              if (!f) return;
              const operator: Operator = isChipField(f) ? "in" : OPERATORS_BY_TYPE[f.type][0]!;
              setDrafts((ds) => [...ds, { id: nextId++, field: f.key, operator, values: [], isNew: true }]);
            }}
          >
            <option value="">＋ Tilføj filter</option>
            {unused.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {sheet ? (
        <div className="lasso-filters__sheetfoot">
          <button className="lasso-btn lasso-btn--primary lasso-filters__apply" onClick={apply}>
            {count === 0 ? "Vis alle virksomheder" : `Anvend ${count} filtre`.replace("1 filtre", "1 filter")}
          </button>
          <button className="lasso-btn lasso-btn--text lasso-filters__cancel" onClick={onCancel}>
            Annuller
          </button>
        </div>
      ) : (
        <div className="lasso-filters__footer">
          <span className="lasso-filters__effect">{drafts.length === 0 ? "Ingen filtre: alle virksomheder, der matcher søgningen." : ""}</span>
          <button className="lasso-btn lasso-btn--ghost" onClick={onCancel}>
            Annuller
          </button>
          <button className="lasso-btn lasso-btn--primary" onClick={apply}>
            {onlyAdditions ? "＋ Tilføj til målgruppen" : "Opdater målgruppe"}
          </button>
        </div>
      )}
    </section>
  );
}

/** Et felt i filterarket (26c.8): valgchips (36 px), række med værdi og chevron (48 px) eller kontakt. */
export interface SheetField {
  key: string;
  as?: "chips" | "row" | "toggle";
  /** Egen tekst, fx "Kun med risikoobservationer" på en kontakt. */
  label?: string;
  /** Egen feltdefinition, når feltet ikke står i FIELDS (fx en kontakt, der styres af appen). */
  def?: FieldDef;
  /** Valgchipsenes rækkefølge, når den afviger fra feltets. */
  options?: readonly string[];
}

/** Standardfelterne i filterarket (26c.8): status som valgchips, region og bruttofortjeneste som rækker. */
export const SHEET_FIELDS: readonly SheetField[] = [
  { key: "status", as: "chips", options: ["aktiv", "under konkurs", "under likvidation", "ophørt"] },
  { key: "region", as: "row" },
  { key: "bruttofortjeneste", as: "row" },
];

const cap = (t: string) => (t ? t[0]!.toLocaleUpperCase("da-DK") + t.slice(1) : t);

/** Værdien i en række uden feltnavnet: "Hovedstaden", "Er mindst 5 mio. kr.". Intet kriterie = "Alle". */
export function criterionSummary(c: Criterion | undefined, def?: FieldDef): string {
  if (!c) return "Alle";
  const f = def ?? FIELD_BY_KEY.get(c.field);
  if ((c.operator === "eq" && f?.type !== "date") || c.operator === "in") return cap(formatCriterionValue(f, c.value));
  const label = f?.label ?? c.field;
  const text = formatCriterion(c);
  return cap(text.startsWith(`${label} `) ? text.slice(label.length + 1) : text);
}

function chipValues(c: Criterion | undefined): string[] {
  if (!c) return [];
  const raw = Array.isArray(c.value) ? c.value : [c.value];
  return raw.map((v) => String(v));
}

/**
 * Filterarket (26c.8, node EM6-0): bundark (Dialog; på desktop en dialog på 520 px) med "Nulstil" i
 * koral til venstre og titlen "Filtre" centreret. Felterne er valgchips (36 px), 48 px rækker med
 * værdien og en chevron ("Region — Hovedstaden ›", tap åbner feltet) og kontakter (44×26). Den primære
 * knap i fuld bredde nederst viser antallet: "Vis 312 virksomheder". Intet ændres, før den trykkes.
 * Bruges af tabellens "Filtre"-knap og af FilterPanel under 560 px.
 */
export function FilterSheet({
  open,
  criteria,
  onApply,
  onClose,
  fields = SHEET_FIELDS,
  count,
  title = "Filtre",
  defaultEdit,
}: {
  open: boolean;
  criteria: readonly Criterion[];
  onApply: (c: Criterion[]) => void;
  onClose: () => void;
  /** Felterne i arket; aktive kriterier på andre felter vises som rækker under dem. */
  fields?: readonly SheetField[];
  /** Antal virksomheder for kladden ("Vis 312 virksomheder"); null/udeladt = "Vis virksomheder". */
  count?: number | ((c: readonly Criterion[]) => number | null | undefined);
  title?: string;
  /** Åbn ét felt fra start (statisk forhåndsvisning). */
  defaultEdit?: string;
}) {
  return (
    <Dialog open={open} title={title} onClose={onClose} className="lasso-dialog--filters lasso-dialog--fsheet">
      {open ? <FilterSheetBody criteria={criteria} fields={fields} count={count} title={title} defaultEdit={defaultEdit} onClose={onClose} onApply={(c) => (onApply(c), onClose())} /> : null}
    </Dialog>
  );
}

function FilterSheetBody({
  criteria,
  fields,
  count,
  title,
  defaultEdit,
  onApply,
  onClose,
}: {
  criteria: readonly Criterion[];
  fields: readonly SheetField[];
  count?: number | ((c: readonly Criterion[]) => number | null | undefined);
  title: string;
  defaultEdit?: string;
  onApply: (c: Criterion[]) => void;
  onClose: () => void;
}) {
  const defs = new Map<string, FieldDef | undefined>(fields.map((f) => [f.key, f.def ?? FIELD_BY_KEY.get(f.key)]));
  const draftFor = (key: string, cs: readonly Criterion[]): Draft => {
    const f = defs.get(key) ?? FIELD_BY_KEY.get(key);
    const c = cs.find((x) => x.field === key);
    return c ? toDraft(c) : { id: nextId++, field: key, operator: (f?.type === "enum" ? "in" : f ? OPERATORS_BY_TYPE[f.type][0]! : "eq") as Operator, values: [], isNew: true };
  };
  const [crit, setCrit] = useState<Criterion[]>(() => [...criteria]);
  // defaultEdit: ét felt åbent fra start (statisk forhåndsvisning).
  const [editing, setEditing] = useState<{ key: string; draft: Draft } | null>(() => (defaultEdit ? { key: defaultEdit, draft: draftFor(defaultEdit, criteria) } : null));
  const [error, setError] = useState<string | null>(null);
  const all: SheetField[] = [...fields, ...crit.filter((c) => !fields.some((f) => f.key === c.field)).map((c) => ({ key: c.field, as: "row" as const }))];
  const defOf = (key: string) => defs.get(key) ?? FIELD_BY_KEY.get(key);
  const find = (key: string) => crit.find((c) => c.field === key);
  const set = (key: string, c: Criterion | null) => setCrit((cs) => (c ? (cs.some((x) => x.field === key) ? cs.map((x) => (x.field === key ? c : x)) : [...cs, c]) : cs.filter((x) => x.field !== key)));
  const n = typeof count === "function" ? count(crit) : count;

  const startEdit = (key: string) => {
    setError(null);
    setEditing({ key, draft: draftFor(key, crit) });
  };

  const back = () => {
    if (!editing) return;
    const d = editing.draft;
    if (d.values.every((v) => !v.trim())) {
      set(editing.key, null);
      setEditing(null);
      return;
    }
    const r = fromDraft(d);
    if (r.error || !r.criterion) return setError(r.error ?? "Ugyldig værdi");
    set(editing.key, r.criterion);
    setEditing(null);
  };

  const apply = () => onApply(crit);
  const cta = typeof n === "number" ? `Vis ${formatNumber(n)} ${n === 1 ? "virksomhed" : "virksomheder"}` : "Vis virksomheder";

  if (editing) {
    const f = defOf(editing.key);
    return (
      <div className="lasso-fsheet">
        <div className="lasso-fsheet__head">
          <button type="button" className="lasso-fsheet__back" onClick={back}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14.5 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            {title}
          </button>
          <span className="lasso-fsheet__title">{f?.label ?? editing.key}</span>
          <span className="lasso-fsheet__spacer" />
        </div>
        <div className="lasso-filters lasso-filters--sheet lasso-fsheet__edit">
          <div className="lasso-filter-row__control">
            <FieldControl draft={editing.draft} field={f} invalid={Boolean(error)} onChange={(patch) => setEditing({ ...editing, draft: { ...editing.draft, ...patch } })} />
          </div>
          {error ? <div className="lasso-field__error">{error}</div> : null}
        </div>
        <div className="lasso-fsheet__foot">
          <button type="button" className="lasso-btn lasso-btn--primary lasso-fsheet__cta" onClick={back}>
            Færdig
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lasso-fsheet">
      <button type="button" className="lasso-sr" onClick={onClose}>
        Luk filtre
      </button>
      <div className="lasso-fsheet__head">
        <button type="button" className="lasso-fsheet__reset" onClick={() => setCrit([])} disabled={crit.length === 0}>
          Nulstil
        </button>
        <span className="lasso-fsheet__title" aria-hidden="true">
          {title}
        </span>
        <span className="lasso-fsheet__spacer" />
      </div>
      <div className="lasso-fsheet__list">
        {all.map((sf) => {
          const f = defOf(sf.key);
          const label = sf.label ?? f?.label ?? sf.key;
          const c = find(sf.key);
          const as = sf.as ?? (f?.type === "boolean" ? "toggle" : isChipField(f) ? "chips" : "row");
          const opts = sf.options ?? f?.options;
          if (as === "chips" && opts) {
            const values = chipValues(c);
            return (
              <div key={sf.key} className="lasso-fsheet__chips">
                <div className="lasso-fsheet__label">{label}</div>
                <ChoiceChips
                  check={false}
                  label={label}
                  options={opts.map((o) => ({ id: o, label: cap(o) }))}
                  values={values}
                  onChange={(v) => set(sf.key, v.length === 0 ? null : v.length === 1 ? { field: sf.key, operator: "eq", value: v[0]! } : { field: sf.key, operator: "in", value: v })}
                />
              </div>
            );
          }
          if (as === "toggle") {
            const on = c ? c.value === true || c.value === "true" : false;
            return (
              <div key={sf.key} className="lasso-fsheet__row lasso-fsheet__row--toggle">
                <span className="lasso-fsheet__rowlabel" id={`fs-${sf.key}`}>
                  {label}
                </span>
                <Toggle on={on} label={label} onChange={(v) => set(sf.key, v ? { field: sf.key, operator: "eq", value: true } : null)} />
              </div>
            );
          }
          return (
            <button key={sf.key} type="button" className="lasso-fsheet__row" onClick={() => startEdit(sf.key)}>
              <span className="lasso-fsheet__rowlabel">{label}</span>
              <span className={`lasso-fsheet__value ${c ? "is-set" : ""}`}>{criterionSummary(c, f)}</span>
              <svg className="lasso-fsheet__chev" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9.5 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          );
        })}
      </div>
      <div className="lasso-fsheet__foot">
        <button type="button" className="lasso-btn lasso-btn--primary lasso-fsheet__cta" onClick={apply}>
          {cta}
        </button>
      </div>
    </div>
  );
}

/** Aktive filtre som fjernbare chips (katalog 26c.8: under søgefeltet på mobil). */
export function CriteriaChips({ criteria, onApply, className = "" }: { criteria: readonly Criterion[]; onApply?: (c: Criterion[]) => void; className?: string }) {
  if (criteria.length === 0) return null;
  return (
    <div className={`lasso-chips ${className}`} aria-label="Aktive filtre">
      {criteria.map((c, i) => (
        <span key={i} className="lasso-chip">
          {formatCriterion(c)}
          {onApply ? (
            <button className="lasso-chip__remove" aria-label={`Fjern ${formatCriterion(c)}`} onClick={() => onApply(criteria.filter((_, j) => j !== i))}>
              <XIcon />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}


function FieldControl({ draft, field, invalid, onChange }: { draft: Draft; field?: FieldDef; invalid: boolean; onChange: (p: Partial<Draft>) => void }) {
  const type = field?.type ?? "text";
  const chips = isChipField(field);
  const ops: readonly Operator[] = chips ? ["in", "not_in"] : OPERATORS_BY_TYPE[type];
  const inputCls = `lasso-input ${invalid ? "lasso-input--invalid" : ""}`;

  const operatorSelect = (
    <select
      className="lasso-select lasso-select--op"
      value={draft.operator}
      aria-label="Operator"
      onChange={(e) => {
        const operator = e.target.value as Operator;
        const multi = operator === "in" || operator === "not_in";
        onChange({ operator, values: operator === "between" ? draft.values.slice(0, 2) : multi ? draft.values : draft.values.slice(0, 1) });
      }}
    >
      {ops.map((op) => (
        <option key={op} value={op}>
          {operatorLabel(op, type)}
        </option>
      ))}
    </select>
  );

  if (chips) {
    const toggle = (opt: string) => {
      const has = draft.values.some((v) => v.toLowerCase() === opt.toLowerCase());
      onChange({ values: has ? draft.values.filter((v) => v.toLowerCase() !== opt.toLowerCase()) : [...draft.values, opt] });
    };
    return (
      <>
        {operatorSelect}
        <div className="lasso-choice" role="group">
          {field!.options!.map((opt) => {
            const on = draft.values.some((v) => v.toLowerCase() === opt.toLowerCase());
            return (
              <button key={opt} className={`lasso-choice__chip ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => toggle(opt)}>
                {on ? <CheckIcon /> : null}
                {opt}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  const placeholder = type === "date" ? "dd.mm.åååå" : type === "amount" ? "Beløb" : type === "number" ? "Tal" : "Indtast";
  const unit = type === "amount" ? <span className="lasso-unit">kr.</span> : null;

  if (draft.operator === "in" || draft.operator === "not_in") {
    return (
      <>
        {operatorSelect}
        <TagInput
          values={draft.values}
          options={field?.options}
          invalid={invalid}
          placeholder={field?.options ? "Tilføj flere…" : "Søg, eller indsæt en liste — fx 2100, 8000"}
          onChange={(values) => onChange({ values })}
        />
      </>
    );
  }

  if (draft.operator === "between") {
    return (
      <>
        {operatorSelect}
        <input className={`${inputCls} lasso-input--short`} value={draft.values[0] ?? ""} placeholder={placeholder} inputMode={type === "text" ? undefined : "decimal"} onChange={(e) => onChange({ values: [e.target.value, draft.values[1] ?? ""] })} />
        <span className="lasso-unit">og</span>
        <input className={`${inputCls} lasso-input--short`} value={draft.values[1] ?? ""} placeholder={placeholder} inputMode={type === "text" ? undefined : "decimal"} onChange={(e) => onChange({ values: [draft.values[0] ?? "", e.target.value] })} />
        {unit}
      </>
    );
  }

  return (
    <>
      {operatorSelect}
      {field?.options ? (
        <select className={`lasso-select ${invalid ? "lasso-input--invalid" : ""}`} value={draft.values[0] ?? ""} onChange={(e) => onChange({ values: [e.target.value] })}>
          <option value="">Vælg</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          className={`${inputCls} ${type === "text" ? "" : "lasso-input--short"}`}
          value={draft.values[0] ?? ""}
          placeholder={placeholder}
          inputMode={type === "number" || type === "amount" ? "decimal" : undefined}
          onChange={(e) => onChange({ values: [e.target.value] })}
        />
      )}
      {unit}
    </>
  );
}

function TagInput({ values, options, invalid, placeholder, onChange }: { values: string[]; options?: readonly string[]; invalid: boolean; placeholder: string; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const parts = raw.split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    const next = [...values];
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setText("");
  };
  return (
    <div className={`lasso-tagfield ${invalid ? "lasso-input--invalid" : ""}`}>
      {values.map((v) => (
        <span key={v} className="lasso-chip">
          {v}
          <button className="lasso-chip__remove" aria-label={`Fjern ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
            <XIcon />
          </button>
        </span>
      ))}
      {options ? (
        <select className="lasso-tagfield__select" value="" aria-label="Tilføj værdi" onChange={(e) => e.target.value && add(e.target.value)}>
          <option value="">{placeholder}</option>
          {options.filter((o) => !values.includes(o)).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="lasso-tagfield__input"
          value={text}
          placeholder={values.length ? "" : placeholder}
          onChange={(e) => (/[,\n;]/.test(e.target.value) ? add(e.target.value) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => add(text)}
        />
      )}
    </div>
  );
}

function XIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
