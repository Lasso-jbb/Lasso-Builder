import { useMemo, useState } from "react";
import {
  FIELD_BY_KEY,
  FIELDS,
  formatCriterion,
  operatorLabel,
  OPERATORS_BY_TYPE,
  validateCriteria,
  type Criterion,
  type FieldDef,
  type Operator,
} from "@lasso/spec";

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
export function parseAmount(text: string): number | null {
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
export function parseDate(text: string): string | null {
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

export function FilterPanel({ criteria, editable, onApply }: { criteria: readonly Criterion[]; editable: boolean; onApply: (c: Criterion[]) => void }) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  const start = () => {
    setDrafts(criteria.map((c) => toDraft(c)));
    setShowErrors(false);
    setOpen(true);
  };
  const update = (id: number, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const results = useMemo(() => drafts.map(fromDraft), [drafts]);
  const unused = FIELDS.filter((f) => !drafts.some((d) => d.field === f.key));
  const onlyAdditions = drafts.length > criteria.length && drafts.slice(0, criteria.length).every((d, i) => JSON.stringify(fromDraft(d).criterion) === JSON.stringify(criteria[i]));

  const apply = () => {
    if (results.some((r) => r.error)) return setShowErrors(true);
    onApply(results.map((r) => r.criterion!));
    setOpen(false);
  };

  if (!open) {
    if (criteria.length === 0 && !editable) return null;
    return (
      <div className="lasso-chips" aria-label="Kriterier">
        {criteria.map((c, i) => (
          <span key={i} className="lasso-chip">
            {formatCriterion(c)}
            {editable ? (
              <button className="lasso-chip__remove" aria-label={`Fjern ${formatCriterion(c)}`} onClick={() => onApply(criteria.filter((_, j) => j !== i))}>
                <XIcon />
              </button>
            ) : null}
          </span>
        ))}
        {editable ? (
          <button className="lasso-btn lasso-btn--ghost lasso-btn--sm" onClick={start}>
            {criteria.length ? "Redigér filtre" : "＋ Tilføj filter"}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <section className="lasso-filters" aria-label="Filtre">
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

      <div className="lasso-filters__footer">
        <span className="lasso-filters__effect">{drafts.length === 0 ? "Ingen filtre: alle virksomheder, der matcher søgningen." : ""}</span>
        <button className="lasso-btn lasso-btn--ghost" onClick={() => setOpen(false)}>
          Annuller
        </button>
        <button className="lasso-btn lasso-btn--primary" onClick={apply}>
          {onlyAdditions ? "＋ Tilføj til målgruppen" : "Opdater målgruppe"}
        </button>
      </div>
    </section>
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
