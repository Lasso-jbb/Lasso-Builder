import { IconButton } from "./Button.js";
import { useMemo, useState } from "react";
import {
  FIELDS,
  fieldOperators,
  formatCriterion,
  validateCriteria,
  type Criterion,
  type FieldDef,
  type Operator,
} from "@lasso/spec";
import {
  AmountField,
  ChoiceChips,
  DateField,
  FieldRow,
  IndustryField,
  MultiSelect,
  OperatorSelect,
  RangeInputs,
  SectionIntro,
  SegmentYesNo,
  SelectField,
  TagInput,
  Toggle,
  XIcon,
  YesNoChips,
} from "./Fields.js";
import { DB07_EXCERPT, type TreeNode } from "./industries.js";
import { useToast } from "./Toast.js";

/**
 * Filterpanelet over et resultat (katalog 02a, 02b, 03): viser det, AI'en forstod, som tags og lader
 * brugeren rette det felt for felt. Hvert felt har tre tilstande (03.1): i ro (ingen handlingslinje),
 * i redigering (koral kant, effekten under feltet og Annuller/"+ Tilføj" eller "Opdater") og
 * tilføjet (besked nederst i midten, "Postnummer er tilføjet", med "Se alle filtre").
 *
 * Kontrollen vælges ud fra feltet: fritekst (operator + felt), beløb (+ ændring), procent, dato
 * med datovælger, chips under seks faste værdier (uden operator), søgbar flervalgsliste fra seks,
 * søgbar liste med tags (postnummer, kommune), branchevælger i dialog og Ja/Nej som chips.
 *
 * API'et er bagudkompatibelt: `criteria`, `editable` og `onApply` som før; resten er valgfrit.
 */
export interface FilterPanelProps {
  criteria: readonly Criterion[];
  editable: boolean;
  onApply: (c: Criterion[]) => void;
  /** Feltkataloget (standard: FIELDS fra @lasso/spec). */
  fields?: readonly FieldDef[];
  /** Antal resultater for et sæt kriterier (til effektlinjen). null = ukendt. */
  estimate?: (criteria: Criterion[]) => number | null | undefined;
  /** Antal i det nuværende resultat. Udelades, beregnes det med `estimate(criteria)`. */
  total?: number;
  /** Branchetræet til branchevælgeren (standard: et udsnit af DB07). */
  industryTree?: readonly TreeNode[];
  /** Værdilister til søgbare felter, fx { kommune: [...], postnummer: [...] }. */
  suggestions?: Readonly<Record<string, readonly string[]>>;
  /** Sektionens brødtekst (02b.4) øverst i panelet. */
  intro?: string;
  /** Åben fra start (statisk forhåndsvisning og tests). */
  defaultOpen?: boolean;
}

interface Draft {
  id: number;
  field: string;
  operator: Operator;
  values: string[];
}

const CHIP_LIMIT = 6;
let nextId = 1;

const isChipField = (f: FieldDef | undefined) => f?.type === "enum" && (f.options?.length ?? 0) < CHIP_LIMIT;
const isMultiField = (f: FieldDef | undefined) => f?.type === "enum" || f?.control === "list" || f?.control === "hierarchy";

function valueToText(f: FieldDef | undefined, v: string | number | boolean): string {
  if (typeof v === "boolean") return v ? "ja" : "nej";
  if (typeof v === "number" && (f?.type === "amount" || f?.type === "percent")) return new Intl.NumberFormat("da-DK").format(v);
  if (typeof v === "string" && f?.type === "date") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  }
  return String(v);
}

function emptyDraft(f: FieldDef): Draft {
  const operator: Operator = f.type === "boolean" ? "eq" : isMultiField(f) ? "in" : fieldOperators(f)[0]!;
  return { id: nextId++, field: f.key, operator, values: [] };
}

function toDraft(c: Criterion, f: FieldDef | undefined): Draft {
  const raw = Array.isArray(c.value) ? c.value : [c.value];
  let operator = c.operator;
  // Lister, chips og flervalg taler "er en af"; lighed fra modellen bliver en liste med én værdi.
  if (isMultiField(f) && (operator === "eq" || operator === "neq")) {
    operator = operator === "neq" ? "not_in" : "in";
  }
  return { id: nextId++, field: c.field, operator, values: raw.map((v) => valueToText(f, v)) };
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

function parseOne(f: FieldDef | undefined, text: string): string | number | boolean | null {
  const t = text.trim();
  if (!t) return null;
  if (f?.type === "boolean") return t === "ja" ? true : t === "nej" ? false : null;
  if (f?.type === "amount") return parseAmount(t);
  if (f?.type === "number" || f?.type === "percent") {
    const n = Number(t.replace(/%$/, "").trim().replace(/[.\s]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (f?.type === "date") return parseDate(t);
  return t;
}

/** Kladde -> kriterium. `criterion: null` = feltet er tomt og tæller ikke med. */
function fromDraft(d: Draft, f: FieldDef | undefined): { criterion?: Criterion | null; error?: string } {
  const filled = d.values.filter((v) => v.trim());
  if (filled.length === 0) return { criterion: null };
  const values = d.values.map((v) => parseOne(f, v));
  if (values.some((v, i) => v === null && d.values[i]!.trim())) {
    return { error: f?.type === "date" ? "Skriv datoen som dd.mm.åååå" : f?.type === "amount" ? "Skriv et beløb, fx 10.000.000" : "Ugyldig værdi" };
  }
  const clean = values.filter((v): v is string | number | boolean => v !== null);
  let value: Criterion["value"];
  if (d.operator === "between") {
    if (clean.length < 2) return { error: "Udfyld begge felter" };
    value = [clean[0] as string | number, clean[1] as string | number];
  } else if (d.operator === "in" || d.operator === "not_in") {
    value = clean as (string | number)[];
  } else {
    value = clean[0]!;
  }
  const criterion: Criterion = { field: d.field, operator: d.operator, value };
  const issue = validateCriteria([criterion])[0];
  return issue ? { error: issue.message } : { criterion };
}

const same = (a: Criterion | null | undefined, b: Criterion | null | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function FilterPanel({ criteria, editable, onApply, fields = FIELDS, estimate, total, industryTree = DB07_EXCERPT, suggestions, intro, defaultOpen = false }: FilterPanelProps) {
  const byKey = useMemo(() => new Map(fields.map((f) => [f.key, f])), [fields]);
  const [open, setOpen] = useState(defaultOpen);
  /** Kladder pr. kriterium (samme indeks) plus nye felter bagerst (committed = undefined). */
  const [rows, setRows] = useState<{ draft: Draft; committed?: number }[]>(() => criteria.map((c, i) => ({ draft: toDraft(c, byKey.get(c.field)), committed: i })));
  const [errors, setErrors] = useState<Record<number, string>>({});
  const toast = useToast();

  const start = () => {
    setRows(criteria.map((c, i) => ({ draft: toDraft(c, byKey.get(c.field)), committed: i })));
    setErrors({});
    setOpen(true);
  };

  const current = useMemo(() => (total ?? estimate?.([...criteria]) ?? null), [total, estimate, criteria]);

  if (!open) {
    if (criteria.length === 0 && !editable) return null;
    return (
      <div className="lasso-chips" aria-label="Kriterier">
        {criteria.map((c, i) => (
          <span key={i} className="lasso-chip">
            {formatCriterion(c)}
            {editable ? (
              <button type="button" className="lasso-chip__remove" aria-label={`Fjern ${formatCriterion(c)}`} onClick={() => onApply(criteria.filter((_, j) => j !== i))}>
                <XIcon />
              </button>
            ) : null}
          </span>
        ))}
        {editable ? (
          <button type="button" className="lasso-btn lasso-btn--ghost lasso-btn--sm" onClick={start}>
            {criteria.length ? "Redigér filtre" : "Tilføj filter"}
          </button>
        ) : null}
      </div>
    );
  }

  const unused = fields.filter((f) => !rows.some((r) => r.draft.field === f.key));

  /** Kriterierne, hvis rækken `idx` blev bekræftet som den står nu. */
  const withRow = (idx: number, c: Criterion | null): Criterion[] => {
    const r = rows[idx]!;
    const next = [...criteria];
    if (r.committed !== undefined) {
      if (c) next[r.committed] = c;
      else next.splice(r.committed, 1);
    } else if (c) next.push(c);
    return next;
  };

  const confirm = (idx: number) => {
    const r = rows[idx]!;
    const f = byKey.get(r.draft.field);
    const res = fromDraft(r.draft, f);
    if (res.error) return setErrors({ ...errors, [r.draft.id]: res.error });
    const next = withRow(idx, res.criterion ?? null);
    onApply(next);
    const label = f?.label ?? r.draft.field;
    // Rækkerne følger de nye kriterier: den bekræftede række står nu i ro.
    const out: { draft: Draft; committed?: number }[] = [];
    rows.forEach((x, j) => {
      if (j === idx) {
        if (!res.criterion) return;
        out.push({ draft: x.draft, committed: r.committed ?? criteria.length });
      } else if (x.committed !== undefined && r.committed !== undefined && !res.criterion && x.committed > r.committed) {
        out.push({ ...x, committed: x.committed - 1 });
      } else out.push(x);
    });
    setRows(out);
    setErrors({ ...errors, [r.draft.id]: "" });
    if (toast.available) {
      toast.show({
        text: res.criterion ? (r.committed === undefined ? `${label} er tilføjet` : `${label} er opdateret`) : `${label} er fjernet`,
        action: { label: "Se alle filtre", onClick: () => setOpen(true) },
      });
    }
  };

  const cancel = (idx: number) => {
    const r = rows[idx]!;
    if (r.committed === undefined) setRows(rows.filter((_, j) => j !== idx));
    else setRows(rows.map((x, j) => (j === idx ? { ...x, draft: toDraft(criteria[r.committed!]!, byKey.get(criteria[r.committed!]!.field)) } : x)));
    setErrors({ ...errors, [r.draft.id]: "" });
  };

  const update = (idx: number, patch: Partial<Draft>) => setRows(rows.map((x, j) => (j === idx ? { ...x, draft: { ...x.draft, ...patch } } : x)));

  return (
    <section className="lasso-filters" aria-label="Filtre">
      {intro ? <SectionIntro>{intro}</SectionIntro> : null}
      {rows.map((r, idx) => {
        const f = byKey.get(r.draft.field);
        const res = fromDraft(r.draft, f);
        const committed = r.committed !== undefined ? criteria[r.committed] : undefined;
        const dirty = r.committed === undefined ? Boolean(res.criterion) || Boolean(res.error) : !same(res.criterion, committed) || Boolean(res.error && r.draft.values.some((v) => v.trim()));
        const delta = dirty && estimate && current !== null && !res.error ? (() => {
          const n = estimate(withRow(idx, res.criterion ?? null));
          return typeof n === "number" ? n - current : null;
        })() : null;
        const err = errors[r.draft.id] || undefined;
        return (
          <FieldRow
            key={r.draft.id}
            label={f?.label ?? r.draft.field}
            info={f?.description}
            active={dirty}
            error={err}
            onClear={
              r.committed === undefined
                ? () => setRows(rows.filter((_, j) => j !== idx))
                : r.draft.values.length
                  ? () => update(idx, { values: [] })
                  : undefined
            }
            pending={dirty ? { mode: r.committed === undefined ? "add" : "update", delta, onCancel: () => cancel(idx), onConfirm: () => confirm(idx) } : undefined}
          >
            <FieldControl draft={r.draft} field={f} invalid={Boolean(err)} tree={industryTree} suggestions={suggestions?.[r.draft.field]} onChange={(p) => update(idx, p)} />
          </FieldRow>
        );
      })}

      {unused.length > 0 ? (
        <div className="lasso-filter-add">
          <SelectField
            label="Tilføj filter"
            placeholder="Tilføj filter"
            options={unused.map((f) => ({ id: f.key, label: f.label }))}
            value={null}
            onChange={(key) => {
              const f = byKey.get(key);
              if (f) setRows([...rows, { draft: emptyDraft(f) }]);
            }}
          />
        </div>
      ) : null}

      <div className="lasso-filters__footer">
        <span className="lasso-filters__effect">{criteria.length === 0 && rows.length === 0 ? "Ingen filtre: alle virksomheder, der matcher søgningen." : ""}</span>
        {/* G8 (Jakob 29.09): luk er et ×-ikon med aria-label "Luk". */}
        <IconButton icon="close" label="Luk" size={32} variant="bare" onClick={() => setOpen(false)} />
      </div>
    </section>
  );
}

/** Kontrollen for ét felt, valgt ud fra feltets type og kontrol (02a/02b). */
function FieldControl({ draft, field, invalid, tree, suggestions, onChange }: { draft: Draft; field?: FieldDef; invalid: boolean; tree: readonly TreeNode[]; suggestions?: readonly string[]; onChange: (p: Partial<Draft>) => void }) {
  const type = field?.type ?? "text";
  const ops = fieldOperators(field, draft.operator);
  const setOp = (operator: Operator) => {
    const multi = operator === "in" || operator === "not_in";
    onChange({ operator, values: operator === "between" ? draft.values.slice(0, 2) : multi ? draft.values : draft.values.slice(0, 1) });
  };
  const opSelect = <OperatorSelect value={draft.operator} operators={ops} fieldType={type} onChange={setOp} />;
  const multiOp = draft.operator === "in" || draft.operator === "not_in";

  // 02a.10 / 02b.3 / 02b.8: Ja / Nej
  if (type === "boolean") {
    const v = draft.values[0] === "ja" ? true : draft.values[0] === "nej" ? false : null;
    const set = (b: boolean | null) => onChange({ operator: "eq", values: b === null ? [] : [b ? "ja" : "nej"] });
    if (field?.control === "toggle") return <Toggle on={v === true} label={field.label} onChange={(on) => set(on ? true : null)} />;
    if (field?.control === "segment") return <SegmentYesNo value={v} label={field.label} onChange={set} />;
    return <YesNoChips value={v} label={field?.label} onChange={set} />;
  }

  // 02a.9 Chips: få faste værdier, ingen operator (undtagen når kriteriet er "er ikke en af").
  if (isChipField(field) && multiOp) {
    return (
      <>
        {draft.operator === "not_in" ? opSelect : null}
        <ChoiceChips options={field!.options!} values={draft.values} label={field!.label} onChange={(values) => onChange({ values })} />
      </>
    );
  }

  // 02a.12 Hierarki: branchevælgeren i dialog.
  if (field?.control === "hierarchy" && multiOp) {
    return (
      <>
        {draft.operator === "not_in" ? opSelect : null}
        <IndustryField tree={tree} values={draft.values} invalid={invalid} onChange={(values) => onChange({ values })} />
      </>
    );
  }

  // 02b.7 Dropdown, åben: søgbar flervalgsliste (enum fra seks værdier).
  if (field?.type === "enum" && field.options) {
    if (multiOp) {
      return (
        <>
          {opSelect}
          <MultiSelect options={field.options} values={draft.values} label={field.label} max={field.max} invalid={invalid} placeholder="Vælg" help="Vælg en eller flere. Tom = alle." onChange={(values) => onChange({ values })} />
        </>
      );
    }
    // 02a.7 Enkeltvalg
    return (
      <>
        {opSelect}
        <SelectField options={field.options} value={draft.values[0]} label={field.label} invalid={invalid} onChange={(v) => onChange({ values: [v] })} />
      </>
    );
  }

  // 02a.11 / 02a.13: søgbar liste med tags (og loft).
  if (multiOp) {
    return (
      <>
        {opSelect}
        <TagInput values={draft.values} suggestions={suggestions ?? field?.options} max={field?.max} invalid={invalid} label={field?.label} onChange={(values) => onChange({ values })} />
      </>
    );
  }

  // 02a.6 Dato med datovælger
  if (type === "date") {
    return <DateField operator={draft.operator} operators={ops} values={draft.values} invalid={invalid} onOperator={setOp} onChange={(values) => onChange({ values })} />;
  }

  // 02a.4 Beløb (+ ændring)
  if (type === "amount") {
    return <AmountField amount={{ operator: draft.operator, values: draft.values }} operators={ops} invalid={invalid} onAmount={(a) => onChange({ operator: a.operator, values: a.values })} />;
  }

  // 02a.5 Procent og tal
  if (type === "percent" || type === "number") {
    return (
      <>
        {opSelect}
        <RangeInputs operator={draft.operator} values={draft.values} unit={type === "percent" ? "%" : field?.unit} placeholder={type === "percent" ? "Procent" : "Tal"} invalid={invalid} onChange={(values) => onChange({ values })} />
      </>
    );
  }

  // 02a.1 Fritekst
  return (
    <>
      {opSelect}
      <input className={`lasso-input ${invalid ? "lasso-input--invalid" : ""}`} value={draft.values[0] ?? ""} placeholder="Indtast" aria-label={field?.label ?? "Værdi"} onChange={(e) => onChange({ values: [e.target.value] })} />
    </>
  );
}
