import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatNumber, operatorLabel, type Operator } from "@lasso/spec";
import { Dialog } from "./Dialog.js";
import { CheckIcon } from "./Layer.js";
import { Picker } from "./Menu.js";
import { Tooltip } from "./Tooltip.js";
import { leafCodes, treeLabels, type TreeNode } from "./industries.js";

/**
 * Felt-familien (katalog 02a Grundformer, 02b Mønstre og tilstande, 03 Feltets tilstande).
 *
 * Alle felter står i en `FieldRow`: navn til venstre (14/600) med valgfrit info-ikon, kontrol til
 * højre, "Ryd" yderst til højre. Er feltet ændret, står handlingslinjen under kontrollen: effekten
 * ("Reducerer resultatet med 28.910") til venstre, "Annuller" og primærknappen ("+ Tilføj" for et
 * nyt filter, "Opdater" uden plus for et eksisterende) til højre. Ingen handlingslinje = i ro.
 *
 * Felter er 42 px høje (--lasso-field-h), radius 8, 1 px kant; fokus og åben liste = 1 px koral
 * kant (--lasso-focus-border), aldrig fyldt flade eller ring. Mobil (< 560 px): navnet over
 * kontrollen, handlingslinjen under i fuld bredde.
 */

// ---------- Ikoner ----------

/** Krydset i tags (02a.8): tynd streg (01: 1,8 i 24-grid, lidt kraftigere i de små størrelser), gråt i hvile. */
export function XIcon({ size = 11, stroke = 2.2 }: { size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ up = false }: { up?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d={up ? "M6 14.5l6-6 6 6" : "M6 9.5l6 6 6-6"} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 10h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ---------- Understøttende elementer (02b.4, 02b.5) ----------

/** 02b.5 Info-ikon med forklaring: erstatter underlinjen under feltnavnet; forklaringen ved hover/fokus. */
export function InfoTip({ text, label = "Forklaring" }: { text: string; label?: string }) {
  return (
    <Tooltip text={text} className="lasso-infotip" placement="right">
      <button type="button" className="lasso-infotip__btn" aria-label={label}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 11v5M12 8v.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
    </Tooltip>
  );
}

/** 02b.4 Sektionens brødtekst: kun på sektioner, der har brug for en forklaring, øverst før første felt. */
export function SectionIntro({ children }: { children: ReactNode }) {
  return <p className="lasso-fieldsec__intro">{children}</p>;
}

/** En gruppe felter med valgfri overskrift og brødtekst (02b.4). */
export function FieldSection({ title, intro, children }: { title?: ReactNode; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="lasso-fieldsec">
      {title ? <h4 className="lasso-fieldsec__title">{title}</h4> : null}
      {intro ? <SectionIntro>{intro}</SectionIntro> : null}
      {children}
    </div>
  );
}

// ---------- Formularside på mobil (26a.8) ----------

/**
 * 26a.8 Formularfelter på mobil: kriterierne som fuldskærmsside. Topbjælken har tilbage-pilen med
 * titlen ("‹ Kriterier (5)") til venstre og handlingen som koral link til højre ("Vis 1.243").
 * Felterne står under hinanden med feltnavnet over (FieldRow layout="form").
 */
export function FormPage({ title, onBack, action, children }: { title: string; onBack?: () => void; action?: { label: string; onClick: () => void }; children: ReactNode }) {
  return (
    <section className="lasso-formpage" aria-label={title}>
      <header className="lasso-formpage__bar">
        <button type="button" className="lasso-formpage__back" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14.5 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          {title}
        </button>
        {action ? (
          <button type="button" className="lasso-formpage__action" onClick={action.onClick}>
            {action.label}
          </button>
        ) : null}
      </header>
      <div className="lasso-formpage__body">{children}</div>
    </section>
  );
}

// ---------- Handlingslinjen (02b.13, 03.1) ----------

/**
 * Effekten af en ubekræftet ændring: negativ = "Reducerer resultatet med N", positiv = "Udvider
 * resultatet med N", 0 = "Ændrer ikke resultatet". Ukendt (null) = ingen tekst.
 */
export function effectText(delta: number | null | undefined): string {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return "";
  if (delta === 0) return "Ændrer ikke resultatet";
  return delta < 0 ? `Reducerer resultatet med ${formatNumber(Math.abs(delta))}` : `Udvider resultatet med ${formatNumber(delta)}`;
}

export function EffectLine({ delta }: { delta: number | null | undefined }) {
  return (
    <span className="lasso-field__effect" aria-live="polite">
      {effectText(delta)}
    </span>
  );
}

/** Annuller + primærknap. "add" = "+ Tilføj" (nyt filter), "update" = "Opdater" uden plus. */
export function FieldActions({ mode, onCancel, onConfirm, disabled }: { mode: "add" | "update"; onCancel: () => void; onConfirm: () => void; disabled?: boolean }) {
  return (
    <span className="lasso-field__actions">
      <button type="button" className="lasso-btn lasso-btn--text" onClick={onCancel}>
        Annuller
      </button>
      <button type="button" className="lasso-btn lasso-btn--primary" onClick={onConfirm} disabled={disabled}>
        {mode === "add" ? (
          <>
            <PlusIcon />
            Tilføj
          </>
        ) : (
          "Opdater"
        )}
      </button>
    </span>
  );
}

export interface FieldRowProps {
  label: ReactNode;
  /** Forklaring bag info-ikonet (fields.ts description). */
  info?: string;
  children: ReactNode;
  /** "Ryd" yderst til højre. */
  onClear?: () => void;
  /** Handlingslinjen under feltet: vises kun, når feltet er ændret. */
  pending?: { mode: "add" | "update"; delta?: number | null; onCancel: () => void; onConfirm: () => void; disabled?: boolean; /** 36 px knapper i stedet for 42 (03.1 opdater). */ compact?: boolean };
  error?: string;
  /** "stacked" = navnet over kontrollen (smalle paneler, 03.1 venstre). "form" = formularfelt (02a): navnet over, hjælpetekst under, ingen bundlinje. Mobil er altid navnet over. */
  layout?: "inline" | "stacked" | "form";
  /** Foldbar række (03.1 "i ro"): kun navnet og en pil; `open` viser kontrollen. */
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
  /** Aktiv = redigeres nu (koral kant om kontrollen). */
  active?: boolean;
  /** 02b.6 Påkrævet: rød stjerne efter navnet (kun når feltet skal udfyldes, før der kan søges). */
  required?: boolean;
  /** Hjælpetekst under feltet (13/18, muted), fx "Tom = alle." (02a, 02b.14). */
  help?: ReactNode;
  /** Sammenklappet felt: værdien som rolig grå tekst til højre for navnet (02b.14), fx "Aarhus, Odense og 3 flere". */
  summary?: ReactNode;
}

/**
 * 02b.13 / 03.1: ét filterfelt med tre tilstande. "inline" = navn til venstre og kontrol til højre
 * (filtergruppe), "stacked" = navnet over kontrollen med bundlinje (smalle paneler, 03.1),
 * "form" = formularfeltet fra 02a/02b.14: navnet over feltet (gap 10), hjælpetekst under, ingen linje.
 */
export function FieldRow({ label, info, children, onClear, pending, error, layout = "inline", collapsible, open = true, onToggle, active, required, help, summary }: FieldRowProps) {
  const id = useId();
  const shown = !collapsible || open;
  return (
    <div className={`lasso-field lasso-field--${layout} ${pending ? "is-pending" : ""} ${active ? "is-active" : ""} ${collapsible ? "lasso-field--collapsible" : ""} ${shown ? "is-open" : ""}`} role="group" aria-labelledby={`${id}-name`}>
      <div className="lasso-field__name" id={`${id}-name`}>
        {collapsible ? (
          <button type="button" className="lasso-field__toggle" aria-expanded={shown} onClick={onToggle}>
            <span>{label}</span>
            {!shown && summary ? <span className="lasso-field__summary">{summary}</span> : null}
            <ChevronIcon up={shown} />
          </button>
        ) : (
          <>
            <span>
              {label}
              {required ? (
                <span className="lasso-required" aria-label="påkrævet">
                  {" *"}
                </span>
              ) : null}
            </span>
            {info ? <InfoTip text={info} label={`Om ${typeof label === "string" ? label : "feltet"}`} /> : null}
          </>
        )}
      </div>
      {shown ? <div className="lasso-field__control">{children}</div> : null}
      {shown && onClear && !pending ? (
        <button type="button" className="lasso-btn lasso-btn--text lasso-field__clear" onClick={onClear}>
          Ryd
        </button>
      ) : null}
      {help && shown ? <div className="lasso-field__help lasso-field__helpline">{help}</div> : null}
      {error && shown ? <div className="lasso-field__error">{error}</div> : null}
      {pending && shown ? (
        <div className={`lasso-field__foot ${pending.compact ? "lasso-field__foot--compact" : ""}`}>
          <EffectLine delta={pending.delta} />
          <FieldActions mode={pending.mode} onCancel={pending.onCancel} onConfirm={pending.onConfirm} disabled={pending.disabled} />
        </div>
      ) : null}
    </div>
  );
}

// ---------- Dropdowns ----------

export interface Option {
  id: string;
  label: string;
  /** Antal til højre (02b.11 chips med antal, 02b.12 liste med antal). */
  count?: number;
}

const toOptions = (opts: readonly (string | Option)[]): Option[] => opts.map((o) => (typeof o === "string" ? { id: o, label: o } : o));

/** Operatoren først i feltet (02a): Lassos dropdown (Picker, 07), aldrig browserens select. */
export function OperatorSelect({ value, operators, fieldType, onChange, labels, defaultOpen }: { value: Operator; operators: readonly Operator[]; fieldType?: string; onChange: (op: Operator) => void; /** Egne ord, fx "benytter"/"benytter ikke". */ labels?: Partial<Record<Operator, string>>; /** Listen åben fra start (statisk forhåndsvisning og tests). */ defaultOpen?: boolean }) {
  const text = (op: Operator) => labels?.[op] ?? operatorLabel(op, fieldType);
  return (
    <Picker
      trigger={text(value)}
      triggerClassName="lasso-select lasso-select--op"
      popClassName="lasso-menu__pop--field lasso-menu__pop--op"
      label="Operator"
      groups={[{ items: operators.map((op) => ({ id: op, label: text(op) })) }]}
      value={value}
      onChange={(id) => onChange(id as Operator)}
      defaultOpen={defaultOpen}
    />
  );
}

/** 02a.7 Enkeltvalg: operator + dropdown (Picker med flueben). */
export function SelectField({ options, value, onChange, placeholder = "Vælg", label, invalid, grow = true }: { options: readonly (string | Option)[]; value: string | null | undefined; onChange: (id: string) => void; placeholder?: string; label?: string; invalid?: boolean; /** false = kun så bred som teksten (dropdown midt i en række, 03.2). */ grow?: boolean }) {
  const opts = toOptions(options);
  const current = opts.find((o) => o.id === value);
  return (
    <Picker
      trigger={current ? current.label : <span className="lasso-placeholder">{placeholder}</span>}
      triggerClassName={`lasso-select ${grow ? "lasso-select--field" : "lasso-select--auto"} ${invalid ? "lasso-input--invalid" : ""}`}
      label={label}
      popClassName="lasso-menu__pop--field"
      groups={[{ items: opts.map((o) => ({ id: o.id, label: o.label, sub: o.count !== undefined ? formatNumber(o.count) : undefined })) }]}
      value={value ?? ""}
      onChange={onChange}
    />
  );
}

/** Tekst i et lukket felt med flere valg: to navne og "og N flere" ("og 1 mere" ved én). */
export function summarize(labels: readonly string[], max = 2): string {
  if (labels.length <= max) return labels.join(", ");
  const rest = labels.length - max;
  return `${labels.slice(0, max).join(", ")} og ${rest} ${rest === 1 ? "mere" : "flere"}`;
}

export interface MultiSelectProps {
  options: readonly (string | Option)[];
  values: readonly string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Hjælpetekst under feltet (02b.7: "Vælg en eller flere. Tom = alle."; 02b.12: levende optælling). */
  help?: ReactNode;
  /** Højst så mange valg (02a.13). */
  max?: number;
  label?: string;
  invalid?: boolean;
  /** Åben fra start (statisk forhåndsvisning og tests). */
  defaultOpen?: boolean;
  /** Søgefeltet øverst (standard: når der er flere end 7 valg). */
  searchable?: boolean;
  /** Valgte i feltet: "tags" (02b.7, standard) eller "text" (to navne og "og N flere"). */
  display?: "tags" | "text";
}

/**
 * 02b.7 Dropdown, åben (og 02b.12 Liste med antal): søgefelt øverst, valgte markeres med flueben,
 * listen lukker ikke ved valg. Feltet får samme tynde koral kant som når man skriver i det.
 * Antal står i højre bane. Esc og klik udenfor lukker.
 */
export function MultiSelect({ options, values, onChange, placeholder = "Vælg", searchPlaceholder = "Søg…", help, max, label, invalid, defaultOpen = false, searchable, display = "tags" }: MultiSelectProps) {
  const opts = useMemo(() => toOptions(options), [options]);
  const [open, setOpen] = useState(defaultOpen);
  const [q, setQ] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();
  const full = max !== undefined && values.length >= max;
  const withSearch = searchable ?? opts.length > 7;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shown = q ? opts.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : opts;
  const selectedLabels = values.map((v) => opts.find((o) => o.id === v)?.label ?? v);
  const toggle = (oid: string) => {
    const on = values.includes(oid);
    if (!on && full) return;
    onChange(on ? values.filter((v) => v !== oid) : [...values, oid]);
  };

  return (
    <div className="lasso-msel" ref={wrap}>
      <button
        type="button"
        className={`lasso-select lasso-select--field lasso-msel__trigger ${open ? "is-open" : ""} ${invalid ? "lasso-input--invalid" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={label}
        onClick={() => setOpen(!open)}
      >
        {values.length === 0 ? (
          <span className="lasso-placeholder">{placeholder}</span>
        ) : display === "tags" ? (
          <span className="lasso-msel__tags">
            {selectedLabels.map((l) => (
              <span key={l} className="lasso-chip lasso-msel__tag">
                {l}
              </span>
            ))}
          </span>
        ) : (
          <span className="lasso-msel__value">{summarize(selectedLabels)}</span>
        )}
        {max !== undefined ? (
          <span className="lasso-counter">
            {values.length} / {max}
          </span>
        ) : null}
      </button>
      {help ? <div className="lasso-field__help">{help}</div> : null}
      <div className="lasso-msel__pop" hidden={!open}>
        {withSearch ? (
          <div className="lasso-msel__search">
            <SearchIcon />
            <input className="lasso-msel__q" value={q} placeholder={searchPlaceholder} aria-label={searchPlaceholder} onChange={(e) => setQ(e.target.value)} />
          </div>
        ) : null}
        <div role="listbox" id={`${id}-list`} aria-multiselectable="true" aria-label={label} className="lasso-msel__list">
          {shown.length === 0 ? <div className="lasso-msel__empty">Ingen match på “{q}”</div> : null}
          {shown.map((o) => {
            const on = values.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={on}
                disabled={!on && full}
                className={`lasso-menu__item lasso-msel__item ${on ? "is-on" : ""}`}
                onClick={() => toggle(o.id)}
              >
                <span className="lasso-menu__text">
                  <span className="lasso-menu__label">{o.label}</span>
                </span>
                {o.count !== undefined ? <span className="lasso-msel__count">{formatNumber(o.count)}</span> : null}
                <span className="lasso-menu__check">{on ? <CheckIcon /> : null}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- Tags, søgbar liste, loft, indsæt liste (02a.11, 02a.13, 02b.9) ----------

export function splitList(raw: string): string[] {
  return raw.split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean);
}

export interface TagInputProps {
  values: readonly string[];
  onChange: (values: string[]) => void;
  /** Værdiliste til søgbare forslag (postnumre, kommuner, teknologier). */
  suggestions?: readonly string[];
  placeholder?: string;
  invalid?: boolean;
  /** Loft (02a.13): tælleren "2 / 3" står i feltet; ved loftet er listen låst. */
  max?: number;
  /** Kun værdier fra forslagslisten (rolletyper). */
  strict?: boolean;
  label?: string;
  /** Tekst, der står i feltet fra start og endnu ikke er blevet til tags (03.1 "i redigering"). */
  defaultText?: string;
  /** Placeholder efter tags (standard "Søg eller indsæt flere…"; 02a.8 "Tilføj flere…"; "" = kun markøren, 03.1). */
  morePlaceholder?: string;
  /** Multivalg som dropdown (02a.8): chevron yderst til højre. */
  dropdown?: boolean;
  /** Søgeikon foran teksten (02a.11 søgbar liste). */
  searchIcon?: boolean;
}

/**
 * Tags i felt (05.5, 30 px) med søgbare forslag. Accepterer en indsat liste adskilt med komma,
 * semikolon eller linjeskift. Backspace i tomt felt fjerner seneste tag.
 */
export function TagInput({ values, onChange, suggestions, placeholder = "Søg, eller indsæt en liste — fx 2100, 8000, 5000", invalid, max, strict, label, defaultText = "", morePlaceholder = "Søg eller indsæt flere…", dropdown = false, searchIcon = false }: TagInputProps) {
  const [text, setText] = useState(defaultText);
  const [focus, setFocus] = useState(false);
  const [hi, setHi] = useState(0);
  const id = useId();
  const full = max !== undefined && values.length >= max;

  const add = (raw: string) => {
    let parts = splitList(raw);
    if (strict && suggestions) parts = parts.map((p) => suggestions.find((s) => s.toLowerCase() === p.toLowerCase()) ?? "").filter(Boolean);
    if (parts.length === 0) return setText("");
    const next = [...values];
    for (const p of parts) {
      if (max !== undefined && next.length >= max) break;
      if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    onChange(next);
    setText("");
    setHi(0);
  };

  const matches = useMemo(() => {
    if (!suggestions || full) return [];
    const q = text.trim().toLowerCase();
    const free = suggestions.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()));
    if (!q) return strict ? free.slice(0, 8) : [];
    return free.filter((s) => s.toLowerCase().includes(q)).slice(0, 8);
  }, [suggestions, text, values, full, strict]);
  const listOpen = focus && matches.length > 0;
  const ph = full ? "Loftet er nået" : max !== undefined && values.length ? `Vælg ${max - values.length} mere…` : values.length ? morePlaceholder : placeholder;

  return (
    <div className={`lasso-tagfield ${invalid ? "lasso-input--invalid" : ""} ${full ? "is-full" : ""} ${dropdown ? "lasso-tagfield--dropdown" : ""}`}>
      {searchIcon ? (
        <span className="lasso-tagfield__icon">
          <SearchIcon size={14} />
        </span>
      ) : null}
      {values.map((v) => (
        <span key={v} className="lasso-chip">
          {v}
          <button type="button" className="lasso-chip__remove" aria-label={`Fjern ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
            <XIcon />
          </button>
        </span>
      ))}
      <input
        className={`lasso-tagfield__input ${ph ? "" : "lasso-tagfield__input--bare"}`}
        value={text}
        disabled={full}
        aria-label={label ?? (placeholder || "Tilføj værdi")}
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        placeholder={ph}
        onFocus={() => setFocus(true)}
        onBlur={() => {
          setFocus(false);
          if (!strict) add(text);
        }}
        onChange={(e) => (/[,\n;]/.test(e.target.value) ? add(e.target.value) : (setText(e.target.value), setHi(0)))}
        onPaste={(e) => {
          const t = e.clipboardData.getData("text");
          if (/[,\n;]/.test(t)) {
            e.preventDefault();
            add(t);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && matches.length) {
            e.preventDefault();
            setHi((hi + 1) % matches.length);
          } else if (e.key === "ArrowUp" && matches.length) {
            e.preventDefault();
            setHi((hi - 1 + matches.length) % matches.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            add(listOpen ? matches[hi]! : text);
          } else if (e.key === "Backspace" && !text && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
      />
      {max !== undefined ? (
        <span className="lasso-counter" aria-label={`${values.length} af ${max} valgt`}>
          {values.length} / {max}
        </span>
      ) : null}
      {dropdown ? (
        <span className="lasso-tagfield__chevron">
          <ChevronIcon />
        </span>
      ) : null}
      {listOpen ? (
        <div className="lasso-msel__pop lasso-tagfield__pop" role="listbox" id={`${id}-list`}>
          <div className="lasso-msel__list">
            {matches.map((m, i) => (
              <button
                key={m}
                type="button"
                role="option"
                aria-selected={i === hi}
                className={`lasso-menu__item ${i === hi ? "is-hi" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(m);
                }}
              >
                <span className="lasso-menu__text">
                  <span className="lasso-menu__label">{m}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * 02b.9 Indsæt liste: tre stablede kontroller under feltnavnet: operatoren ("er en af", 220 bred),
 * tekstområdet (80 px) til at klistre en liste ind i (komma eller én pr. linje) og dropdown'en "Vælg
 * fra listen" til at browse. Begge fylder samme liste: det indsatte bliver til valg, når feltet
 * forlades (eller ved Ctrl/⌘+Enter). Ingen knapper.
 *
 * `variant="inline"` er den ældre form: tag-feltet med knappen "Indsæt liste", der folder et
 * tekstområde med Annuller/Tilføj ud.
 */
export function ListField({
  values,
  onChange,
  suggestions,
  placeholder,
  invalid,
  defaultPasteOpen = false,
  variant = "stacked",
  operator = "in",
  operators = ["in", "not_in"],
  onOperator,
  pastePlaceholder = "Indsæt liste, fx 2100, 8000, 5000",
  listPlaceholder = "Vælg fra listen",
  label,
}: {
  values: readonly string[];
  onChange: (v: string[]) => void;
  suggestions?: readonly string[];
  placeholder?: string;
  invalid?: boolean;
  defaultPasteOpen?: boolean;
  variant?: "stacked" | "inline";
  operator?: Operator;
  operators?: readonly Operator[];
  onOperator?: (op: Operator) => void;
  pastePlaceholder?: string;
  listPlaceholder?: string;
  label?: string;
}) {
  const [paste, setPaste] = useState(defaultPasteOpen);
  const [text, setText] = useState("");
  const merge = (raw: string) => {
    const next = [...values];
    for (const p of splitList(raw)) if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p);
    return next;
  };
  const add = () => {
    onChange(merge(text));
    setText("");
    setPaste(false);
  };
  if (variant === "stacked") {
    const commit = () => {
      if (!text.trim()) return;
      onChange(merge(text));
      setText("");
    };
    const options = [...new Set([...(suggestions ?? []), ...values])];
    return (
      <div className="lasso-listfield lasso-listfield--stacked">
        <OperatorSelect value={operator} operators={operators} onChange={onOperator ?? (() => undefined)} />
        <textarea
          className={`lasso-textarea lasso-listfield__paste-area ${invalid ? "lasso-input--invalid" : ""}`}
          rows={3}
          value={text}
          placeholder={pastePlaceholder}
          aria-label={label ? `${label}, indsæt liste` : "Indsæt liste"}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              commit();
            }
          }}
        />
        <MultiSelect options={options} values={values} onChange={onChange} placeholder={listPlaceholder} label={label ? `${label}, vælg fra listen` : listPlaceholder} invalid={invalid} />
      </div>
    );
  }
  return (
    <div className="lasso-listfield">
      <div className="lasso-listfield__row">
        <TagInput values={values} onChange={onChange} suggestions={suggestions} placeholder={placeholder} invalid={invalid} />
        {!paste ? (
          <button type="button" className="lasso-btn lasso-btn--text lasso-listfield__paste" onClick={() => setPaste(true)}>
            Indsæt liste
          </button>
        ) : null}
      </div>
      {paste ? (
        <div className="lasso-listfield__area">
          <textarea className="lasso-textarea" rows={4} value={text} placeholder={"Kommasepareret eller én pr. linje\n2100, 2200, 8000"} aria-label="Indsæt liste" onChange={(e) => setText(e.target.value)} />
          <div className="lasso-listfield__actions">
            <span className="lasso-field__help">{text.trim() ? `${splitList(text).length} værdier` : ""}</span>
            <button type="button" className="lasso-btn lasso-btn--text" onClick={() => (setText(""), setPaste(false))}>
              Annuller
            </button>
            <button type="button" className="lasso-btn lasso-btn--primary" disabled={!text.trim()} onClick={add}>
              Tilføj
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------- Chips, Ja/Nej, kontakt, segment (02a.9, 02a.10, 02b.3, 02b.8, 02b.11) ----------

/**
 * 02a.9 Chips: 38 px, valgt = flueben + fuld koral kant og blød koral flade. 02b.11 Chips med antal
 * (når valgene har `count`): 40 px, antal i muted efter navnet, valgt = fuld koral kant og navn 600
 * uden flueben, så valget kan skelnes selv når fem står ved siden af hinanden.
 * `single` gør dem til enkeltvalg (klik på den valgte fjerner valget).
 */
export function ChoiceChips({ options, values, onChange, single = false, label, check }: { options: readonly (string | Option)[]; values: readonly string[]; onChange: (v: string[]) => void; single?: boolean; label?: string; /** Flueben på valgte (standard: ja, undtagen chips med antal; 26c.8 filterark: nej). */ check?: boolean }) {
  const opts = toOptions(options);
  const has = (oid: string) => values.some((v) => v.toLowerCase() === oid.toLowerCase());
  const toggle = (oid: string) => {
    if (has(oid)) onChange(values.filter((v) => v.toLowerCase() !== oid.toLowerCase()));
    else onChange(single ? [oid] : [...values, oid]);
  };
  // 02b.11 Chips med antal: 40 px, valgt = fuld koral kant + koral-lys + navn 600, uden flueben.
  const counted = opts.some((o) => o.count !== undefined);
  return (
    <div className={`lasso-choice ${counted ? "lasso-choice--count" : ""}`} role="group" aria-label={label}>
      {opts.map((o) => {
        const on = has(o.id);
        return (
          <button key={o.id} type="button" className={`lasso-choice__chip ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => toggle(o.id)}>
            {on && (check ?? !counted) ? <CheckIcon size={14} /> : null}
            {o.label}
            {o.count !== undefined ? <span className="lasso-choice__count">{formatNumber(o.count)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 02a.10 Ja / Nej: to chips. Intet valgt = filteret tæller ikke med (erstatter radiogruppen med
 * "Ingen betydning"). Klik på det valgte fjerner valget.
 */
export function YesNoChips({ value, onChange, label }: { value: boolean | null | undefined; onChange: (v: boolean | null) => void; label?: string }) {
  const values = value === true ? ["ja"] : value === false ? ["nej"] : [];
  return (
    <ChoiceChips
      single
      label={label}
      options={[{ id: "ja", label: "Ja" }, { id: "nej", label: "Nej" }]}
      values={values}
      onChange={(v) => onChange(v[0] === "ja" ? true : v[0] === "nej" ? false : null)}
    />
  );
}

/** 02b.3 Til / fra: kontakt, hvor kun "Ja" giver mening. Slukket = filteret tæller ikke med. */
export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`lasso-toggle ${on ? "is-on" : ""}`} onClick={() => onChange(!on)}>
      <span className="lasso-toggle__knob" />
    </button>
  );
}

/**
 * 02b.3 Til / fra-kontakt i et felt: hvidt kort (1 px kant, radius 8, 52 px) med teksten 14/600 til
 * venstre og kontakten 44×26 til højre; hjælpeteksten under kortet. Slukket = filteret tæller ikke med.
 */
export function ToggleField({ label, on, onChange, help, disabled }: { label: ReactNode; on: boolean; onChange: (on: boolean) => void; help?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="lasso-togglefield">
      <div className="lasso-togglefield__card">
        <span className="lasso-togglefield__label" id={`${id}-l`}>
          {label}
        </span>
        <button type="button" role="switch" aria-checked={on} aria-labelledby={`${id}-l`} disabled={disabled} className={`lasso-toggle ${on ? "is-on" : ""}`} onClick={() => onChange(!on)}>
          <span className="lasso-toggle__knob" />
        </button>
      </div>
      {help ? <div className="lasso-field__help">{help}</div> : null}
    </div>
  );
}

/**
 * 02b.8 Segmenteret ja/nej (dev3's mønster): "Ingen betydning", "Ja", "Nej" som segmentkontrol
 * (samme udseende som faneniveau 3). Dokumenteret, så valget er bevidst; 02a.10 er anbefalingen.
 */
export function SegmentYesNo({ value, onChange, label }: { value: boolean | null | undefined; onChange: (v: boolean | null) => void; label?: string }) {
  const items: { id: string; label: string; v: boolean | null }[] = [
    { id: "any", label: "Ingen betydning", v: null },
    { id: "ja", label: "Ja", v: true },
    { id: "nej", label: "Nej", v: false },
  ];
  const cur = value === true ? "ja" : value === false ? "nej" : "any";
  return (
    <div className="lasso-segment lasso-segment--field" role="radiogroup" aria-label={label}>
      {items.map((it) => (
        <button key={it.id} type="button" role="radio" aria-checked={cur === it.id} className={`lasso-segment__item ${cur === it.id ? "is-on" : ""}`} onClick={() => onChange(it.v)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Tal, beløb, procent (02a.4, 02a.5) ----------

/** Talfelt med enhed efter feltet ("kr.", "%", "% ændring"). */
export function UnitInput({ value, onChange, unit, placeholder, invalid, short = true, label, lead }: { value: string; onChange: (v: string) => void; unit?: string; placeholder?: string; invalid?: boolean; short?: boolean; label?: string; /** Ord foran feltet i samme gruppe ("og"), så det aldrig ombrydes alene. */ lead?: string }) {
  // Feltet og enheden (og evt. "og" foran) står i én gruppe, så enheden aldrig ombrydes alene (02a.3, 02a.4).
  return (
    <span className={`lasso-inputunit ${short ? "" : "lasso-inputunit--grow"}`}>
      {lead ? <span className="lasso-unit">{lead}</span> : null}
      <input
        className={`lasso-input ${short ? "lasso-input--short" : ""} ${invalid ? "lasso-input--invalid" : ""}`}
        value={value}
        placeholder={placeholder}
        inputMode="decimal"
        aria-label={label ?? placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {unit ? <span className="lasso-unit">{unit}</span> : null}
    </span>
  );
}

/** Operator + ét eller to felter (mellem) + enhed. Fælles for tal, beløb, procent og ændring. */
export function RangeInputs({ operator, values, onChange, unit, placeholder, invalid }: { operator: Operator; values: readonly string[]; onChange: (v: string[]) => void; unit?: string; placeholder?: string; invalid?: boolean }) {
  if (operator === "between") {
    return (
      <>
        <UnitInput value={values[0] ?? ""} placeholder={placeholder} invalid={invalid} label="Fra" onChange={(v) => onChange([v, values[1] ?? ""])} />
        <UnitInput value={values[1] ?? ""} placeholder={placeholder} invalid={invalid} label="Til" unit={unit} lead="og" onChange={(v) => onChange([values[0] ?? "", v])} />
      </>
    );
  }
  return <UnitInput value={values[0] ?? ""} placeholder={placeholder} invalid={invalid} unit={unit} onChange={(v) => onChange([v])} />;
}

/** Ændringens tre operatorer (02a.4): Mere end, Mindre end, Mellem (samme ord som beløbsrækken). */
export const CHANGE_OPERATORS: readonly Operator[] = ["gte", "lte", "between"];
export const CHANGE_LABELS: Partial<Record<Operator, string>> = { gte: "Mere end", lte: "Mindre end", between: "Mellem" };
/** Beløbsrækkens operatorer i 02a.4 (samme tre ord). */
export const AMOUNT_LABELS: Partial<Record<Operator, string>> = CHANGE_LABELS;

export interface AmountFieldValue {
  operator: Operator;
  values: string[];
}

/**
 * 02a.4 Beløb + ændring: ingen overskrift, enheden skiller rækkerne: "kr." er beløbet,
 * "% ændring" er udviklingen. Begge kan bruges alene. `change` udelades, når feltet ikke har en.
 */
export function AmountField({ amount, change, operators, onAmount, onChange, invalid, defaultOpenChange }: { amount: AmountFieldValue; change?: AmountFieldValue; operators: readonly Operator[]; onAmount: (v: AmountFieldValue) => void; onChange?: (v: AmountFieldValue) => void; invalid?: boolean; /** Ændringens operatorliste åben fra start (statisk forhåndsvisning). */ defaultOpenChange?: boolean }) {
  return (
    <div className="lasso-amountfield">
      <div className="lasso-amountfield__row">
        <OperatorSelect value={amount.operator} operators={operators} fieldType="amount" labels={AMOUNT_LABELS} onChange={(operator) => onAmount({ operator, values: operator === "between" ? amount.values : amount.values.slice(0, 1) })} />
        <RangeInputs operator={amount.operator} values={amount.values} unit="kr." invalid={invalid} onChange={(values) => onAmount({ ...amount, values })} />
      </div>
      {change && onChange ? (
        <div className="lasso-amountfield__row">
          <OperatorSelect value={change.operator} operators={CHANGE_OPERATORS} labels={CHANGE_LABELS} defaultOpen={defaultOpenChange} onChange={(operator) => onChange({ operator, values: operator === "between" ? change.values : change.values.slice(0, 1) })} />
          <RangeInputs operator={change.operator} values={change.values} unit="% ændring" onChange={(values) => onChange({ ...change, values })} />
        </div>
      ) : null}
    </div>
  );
}

// ---------- Dato (02a.6, 02b.10) ----------

const MONTHS = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"];
/** Kort månedsnavn i kalenderens hoved (02b.10): "sep.", "maj". */
const MONTHS_SHORT = ["jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."];
/** Ugedage som ét bogstav, mandag først (02b.10). */
const WEEKDAYS = ["M", "T", "O", "T", "F", "L", "S"];
const WEEKDAY_NAMES = ["mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag", "søndag"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** "dd.mm.åååå" -> "ÅÅÅÅ-MM-DD" (null hvis ugyldig). */
function textToIso(text: string): string | null {
  const m = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(text.trim());
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(text.trim()) ? text.trim() : null;
}
const isoToText = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : v;
};

function SmallChevron({ dir }: { dir: "left" | "right" | "down" }) {
  const d = dir === "left" ? "M14.5 6l-6 6 6 6" : dir === "right" ? "M9.5 6l6 6-6 6" : "M6 9.5l6 6 6-6";
  const size = dir === "down" ? 12 : 14;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 02b.10 Datovælger, åben: 260 bred, radius 10. Hovedet "‹ sep. ▾ 2026 ▾ ›" er ren tekst 14/500 med
 * små chevroner (måned og år er dropdowns uden ramme), ugedage som ét bogstav (12, muted), dage 13 px
 * i 32 px celler, mandag først. I dag = koral-lys rund flade med koral 600-tekst; valgt dag = koral
 * rund flade med hvid tekst; dage fra forrige/næste måned står i faint.
 */
export function DatePicker({ value, onSelect, today = new Date(), minYear = 1900, maxYear }: { value?: string | null; onSelect: (iso: string) => void; today?: Date; minYear?: number; maxYear?: number }) {
  const start = value && /^\d{4}-\d{2}/.test(value) ? { y: Number(value.slice(0, 4)), m: Number(value.slice(5, 7)) - 1 } : { y: today.getFullYear(), m: today.getMonth() };
  const [view, setView] = useState(start);
  const top = maxYear ?? today.getFullYear() + 1;
  const years = Array.from({ length: top - minYear + 1 }, (_, i) => top - i);
  const first = new Date(Date.UTC(view.y, view.m, 1));
  const lead = (first.getUTCDay() + 6) % 7; // mandag først
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const prevDays = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate();
  const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());
  type Cell = { d: number; y: number; m: number; out: boolean };
  const prev = { y: view.m === 0 ? view.y - 1 : view.y, m: (view.m + 11) % 12 };
  const next = { y: view.m === 11 ? view.y + 1 : view.y, m: (view.m + 1) % 12 };
  const cells: Cell[] = [
    ...Array.from({ length: lead }, (_, i) => ({ d: prevDays - lead + 1 + i, ...prev, out: true })),
    ...Array.from({ length: days }, (_, i) => ({ d: i + 1, y: view.y, m: view.m, out: false })),
  ];
  let n = 1;
  while (cells.length % 7) cells.push({ d: n++, ...next, out: true });
  const step = (d: number) => {
    const m = view.m + d;
    setView({ y: view.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 });
  };
  return (
    <div className="lasso-cal" role="dialog" aria-label="Vælg dato">
      <div className="lasso-cal__head">
        <button type="button" className="lasso-cal__nav" aria-label="Forrige måned" onClick={() => step(-1)}>
          <SmallChevron dir="left" />
        </button>
        <span className="lasso-cal__title">
          <Picker
            trigger={
              <>
                {MONTHS_SHORT[view.m]}
                <SmallChevron dir="down" />
              </>
            }
            triggerClassName="lasso-cal__pick"
            popClassName="lasso-menu__pop--field"
            label="Måned"
            groups={[{ items: MONTHS.map((m, i) => ({ id: String(i), label: m })) }]}
            value={String(view.m)}
            onChange={(id) => setView({ ...view, m: Number(id) })}
          />
          <Picker
            trigger={
              <>
                {String(view.y)}
                <SmallChevron dir="down" />
              </>
            }
            triggerClassName="lasso-cal__pick"
            popClassName="lasso-menu__pop--field"
            label="År"
            groups={[{ items: years.map((y) => ({ id: String(y), label: String(y) })) }]}
            value={String(view.y)}
            onChange={(id) => setView({ ...view, y: Number(id) })}
          />
        </span>
        <button type="button" className="lasso-cal__nav" aria-label="Næste måned" onClick={() => step(1)}>
          <SmallChevron dir="right" />
        </button>
      </div>
      <div className="lasso-cal__grid" role="grid">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="lasso-cal__wd" role="columnheader" aria-label={WEEKDAY_NAMES[i]}>
            {w}
          </span>
        ))}
        {cells.map((c) => {
          const v = iso(c.y, c.m, c.d);
          return (
            <button
              key={v}
              type="button"
              role="gridcell"
              aria-selected={v === value}
              aria-current={v === todayIso ? "date" : undefined}
              className={`lasso-cal__day ${c.out ? "is-out" : ""} ${v === value ? "is-on" : ""} ${v === todayIso ? "is-today" : ""}`}
              onClick={() => onSelect(v)}
            >
              {c.d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 02a.6 Datofelt: "dd.mm.åååå" som tekst eller valgt i kalenderen (ikonet åbner datovælgeren). */
export function DateInput({ value, onChange, invalid, label = "Dato", defaultOpen = false, today, placeholder = "dd.mm.åååå" }: { value: string; onChange: (text: string) => void; invalid?: boolean; label?: string; defaultOpen?: boolean; today?: Date; /** 02b.10: "Vælg dato". */ placeholder?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const wrap = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);
  // 02b.10 mobil: kalenderen holdes inden for skærmen (skubbes mod venstre, aldrig ud over kanten).
  useLayoutEffect(() => {
    if (!open || !pop.current || typeof window === "undefined") return setShift(0);
    const r = pop.current.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const left = r.left - shift;
    const over = left + r.width - (vw - 8);
    setShift(over > 0 ? -Math.min(over, Math.max(0, left - 8)) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className={`lasso-dateinput ${open ? "is-open" : ""}`} ref={wrap}>
      <input className={`lasso-input lasso-dateinput__input ${invalid ? "lasso-input--invalid" : ""}`} value={value} placeholder={placeholder} aria-label={label} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="lasso-dateinput__btn" aria-label="Åbn kalender" aria-expanded={open} onClick={() => setOpen(!open)}>
        <CalendarIcon />
      </button>
      {open ? (
        <div className="lasso-dateinput__pop" ref={pop} style={shift ? { left: shift } : undefined}>
          <DatePicker
            value={textToIso(value)}
            today={today}
            onSelect={(v) => {
              onChange(isoToText(v));
              setOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** 02a.6 Dato: operator (efter den, før den, præcis den, mellem) + ét eller to datofelter. */
export function DateField({ operator, operators, values, onOperator, onChange, invalid, defaultOpen, today, labels, placeholder }: { operator: Operator; operators: readonly Operator[]; values: readonly string[]; onOperator: (op: Operator) => void; onChange: (v: string[]) => void; invalid?: boolean; /** Kalenderen i første datofelt åben fra start (02b.10, statisk forhåndsvisning). */ defaultOpen?: boolean; today?: Date; /** Egne operatorord, fx { after: "Efter" } (02b.10). */ labels?: Partial<Record<Operator, string>>; placeholder?: string }) {
  return (
    <>
      <OperatorSelect value={operator} operators={operators} fieldType="date" labels={labels} onChange={onOperator} />
      <DateInput value={values[0] ?? ""} invalid={invalid} defaultOpen={defaultOpen} today={today} placeholder={placeholder} label={operator === "between" ? "Fra dato" : "Dato"} onChange={(v) => onChange(operator === "between" ? [v, values[1] ?? ""] : [v])} />
      {operator === "between" ? (
        <span className="lasso-inputunit lasso-inputunit--date">
          <span className="lasso-unit">og</span>
          <DateInput value={values[1] ?? ""} invalid={invalid} today={today} label="Til dato" onChange={(v) => onChange([values[0] ?? "", v])} />
        </span>
      ) : null}
    </>
  );
}

// ---------- Hierarki: branchevælger (02a.12) ----------

/**
 * Træ-vælgeren i dialog (07): sektion → hovedgruppe → kode. Søgning filtrerer på navn og kode;
 * et flueben på en gruppe vælger alle koder under den (delvist valgt = streg).
 */
export function TreePicker({ tree, values, onChange }: { tree: readonly TreeNode[]; values: readonly string[]; onChange: (codes: string[]) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const set = new Set(values);
  const query = q.trim().toLowerCase();
  const matches = (n: TreeNode): boolean => !query || n.label.toLowerCase().includes(query) || n.code.startsWith(query) || (n.children ?? []).some(matches);

  const toggle = (n: TreeNode) => {
    const leaves = leafCodes(n);
    const all = leaves.every((c) => set.has(c));
    const next = new Set(set);
    for (const c of leaves) all ? next.delete(c) : next.add(c);
    onChange([...next]);
  };

  const render = (nodes: readonly TreeNode[], depth: number): ReactNode =>
    nodes.filter(matches).map((n) => {
      const leaves = leafCodes(n);
      const count = leaves.filter((c) => set.has(c)).length;
      const state = count === 0 ? "off" : count === leaves.length ? "on" : "mixed";
      const expanded = Boolean(query) || open.has(n.code);
      return (
        <li key={n.code} className="lasso-tree__node" role="treeitem" aria-expanded={n.children ? expanded : undefined} aria-selected={state === "on"}>
          <div className="lasso-tree__row" style={{ paddingLeft: depth * 20 }}>
            {n.children ? (
              <button type="button" className="lasso-tree__twist" aria-label={expanded ? `Fold ${n.label} sammen` : `Fold ${n.label} ud`} onClick={() => setOpen((s) => { const x = new Set(s); x.has(n.code) ? x.delete(n.code) : x.add(n.code); return x; })}>
                <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: expanded ? "rotate(90deg)" : undefined }}><path d="M9.5 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
              </button>
            ) : (
              <span className="lasso-tree__twist" />
            )}
            <label className="lasso-tree__label">
              <input type="checkbox" className={`lasso-check is-${state}`} checked={state === "on"} ref={(el) => { if (el) el.indeterminate = state === "mixed"; }} onChange={() => toggle(n)} />
              <span className="lasso-tree__code">{n.code}</span>
              <span className="lasso-tree__text">{n.label}</span>
            </label>
          </div>
          {n.children && expanded ? <ul role="group" className="lasso-tree__list">{render(n.children, depth + 1)}</ul> : null}
        </li>
      );
    });

  return (
    <div className="lasso-tree">
      <div className="lasso-msel__search lasso-tree__search">
        <SearchIcon />
        <input className="lasso-msel__q" value={q} placeholder="Søg på branche eller kode" aria-label="Søg på branche eller kode" onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul role="tree" aria-multiselectable="true" aria-label="Brancher" className="lasso-tree__list lasso-tree__root">
        {render(tree, 0)}
      </ul>
    </div>
  );
}

/**
 * 02a.12 Hierarki (branchekode): ét felt, ingen løs knap. Feltet viser de valgte som tekst med kode, to
 * navne og "og N flere", og hele feltet åbner træ-vælgeren i en dialog (liste/træ-ikonet yderst til
 * højre, ingen chevron). Tomt: "Vælg brancher".
 */
/** "620100" -> "62.01" (DB07-koden, som den står i feltet, 02a.12). */
export function formatIndustryCode(code: string): string {
  return /^\d{6}$/.test(code) ? `${code.slice(0, 2)}.${code.slice(2, 4)}` : code;
}

function TreeListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M7 12h13M10 17h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function IndustryField({ tree, values, onChange, invalid, defaultOpen = false, showCodes = true }: { tree: readonly TreeNode[]; values: readonly string[]; onChange: (codes: string[]) => void; invalid?: boolean; defaultOpen?: boolean; /** Koden foran navnet ("62.01 Computerprogrammering"), standard til. */ showCodes?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState<string[]>([...values]);
  const labels = useMemo(() => treeLabels(tree), [tree]);
  const names = values.map((c) => (showCodes ? `${formatIndustryCode(c)} ${labels.get(c) ?? ""}`.trim() : labels.get(c) ?? c));
  return (
    <>
      <button
        type="button"
        className={`lasso-select lasso-select--field lasso-industryfield ${invalid ? "lasso-input--invalid" : ""}`}
        aria-haspopup="dialog"
        onClick={() => {
          setDraft([...values]);
          setOpen(true);
        }}
      >
        {values.length ? <span className="lasso-msel__value">{summarize(names)}</span> : <span className="lasso-placeholder">Vælg brancher</span>}
        <span className="lasso-industryfield__icon">
          <TreeListIcon />
        </span>
      </button>
      <Dialog
        open={open}
        title="Vælg brancher"
        description="Sektion, hovedgruppe eller branchekode. En gruppe vælger alle koder under den."
        onClose={() => setOpen(false)}
        actions={{
          secondary: { label: "Annuller", onClick: () => setOpen(false) },
          primary: {
            label: draft.length ? `Vælg ${formatNumber(draft.length)} ${draft.length === 1 ? "branche" : "brancher"}` : "Vælg",
            onClick: () => {
              onChange(draft);
              setOpen(false);
            },
          },
        }}
      >
        <TreePicker tree={tree} values={draft} onChange={setDraft} />
      </Dialog>
    </>
  );
}

// ---------- Persona (02b.1, 02b.11, 02b.12) ----------

export interface PersonaValue {
  roles: string[];
  departments: string[];
  /** Personen skal have direkte telefonnummer (02b.3-kontakten i personaen). */
  directPhone?: boolean;
}

export interface PersonaFieldProps {
  value: PersonaValue;
  onChange: (v: PersonaValue) => void;
  roles: readonly Option[];
  departments: readonly Option[];
  /** Levende optælling: hvor mange kontaktpersoner matcher personaen (falder ved flere roller). */
  countFor?: (v: PersonaValue) => number | null;
  defaultOpen?: boolean;
  title?: string;
  /** "card" (standard, 02b.1): opsummeringskort med Redigér og ×. "field": opsummering i et felt. */
  variant?: "card" | "field";
  /** × på kortet: fjern personaen. */
  onRemove?: () => void;
  /** "+ Tilføj persona" under kortet. */
  onAdd?: () => void;
}

/** Kortets titel: rollerne med "eller" ("Direktør eller Head of"); ingen roller = "Alle roller". */
export function personaTitle(roleNames: readonly string[]): string {
  if (roleNames.length === 0) return "Alle roller";
  if (roleNames.length === 1) return roleNames[0]!;
  return `${roleNames.slice(0, -1).join(", ")} eller ${roleNames[roleNames.length - 1]}`;
}

/**
 * 02b.1 Persona (kontaktpersoner): sammensat kriterie, vist som opsummeringskort (hvidt kort, 1 px kant,
 * radius 8: rollerne 14/600 og afdelinger/krav 13 muted under; "Redigér" og × til højre; "+ Tilføj
 * persona" under kortet) og redigeret i
 * en dialog med rolle-chips med antal (02b.11) og afdelingsliste med antal (02b.12). Tallet i
 * hjælpeteksten er levende: det falder i takt med, at man vælger, og er den eneste feedback på, om
 * personaen bliver for snæver.
 */
export function PersonaField({ value, onChange, roles, departments, countFor, defaultOpen = false, title = "Kontaktpersoner", variant = "card", onRemove, onAdd }: PersonaFieldProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState<PersonaValue>(value);
  const roleNames = value.roles.map((r) => roles.find((o) => o.id === r)?.label ?? r);
  const depNames = value.departments.map((d) => departments.find((o) => o.id === d)?.label ?? d);
  const live = countFor?.(draft);
  const summary = [roleNames.length ? summarize(roleNames) : "Alle roller", depNames.length ? summarize(depNames) : "alle afdelinger"].join(", ");
  const detail = [depNames.length ? summarize(depNames) : "Alle afdelinger", value.directPhone ? "skal have direkte telefonnummer" : ""].filter(Boolean).join(", ");
  const edit = () => {
    setDraft(value);
    setOpen(true);
  };
  return (
    <>
      {variant === "card" ? (
        <div className="lasso-personacard">
          <div className="lasso-personacard__card">
            <div className="lasso-personacard__text">
              <span className="lasso-personacard__title">{personaTitle(roleNames)}</span>
              <span className="lasso-personacard__sub">{detail}</span>
            </div>
            <button type="button" className="lasso-btn" onClick={edit}>
              Redigér
            </button>
            {onRemove ? (
              <button type="button" className="lasso-personacard__remove" aria-label="Fjern persona" onClick={onRemove}>
                <XIcon size={14} stroke={2} />
              </button>
            ) : null}
          </div>
          {onAdd ? (
            <button type="button" className="lasso-btn lasso-personacard__add" onClick={onAdd}>
              <PlusIcon />
              Tilføj persona
            </button>
          ) : null}
        </div>
      ) : (
        <div className="lasso-persona">
          <span className="lasso-persona__text">{summary}</span>
          <button type="button" className="lasso-btn lasso-btn--sm" onClick={edit}>
            Redigér
          </button>
        </div>
      )}
      <Dialog
        open={open}
        title={title}
        description="Vælg de roller og afdelinger, personerne skal have. Tom = alle."
        onClose={() => setOpen(false)}
        actions={{
          secondary: { label: "Annuller", onClick: () => setOpen(false) },
          primary: {
            label: "Gem persona",
            onClick: () => {
              onChange(draft);
              setOpen(false);
            },
          },
        }}
      >
        <div className="lasso-persona__form">
          <div className="lasso-persona__part">
            <div className="lasso-field__label">Rolle</div>
            <ChoiceChips options={roles} values={draft.roles} label="Rolle" onChange={(r) => setDraft({ ...draft, roles: r })} />
            <div className="lasso-field__help">Tom = alle roller.</div>
          </div>
          <div className="lasso-persona__part">
            <div className="lasso-field__label">Afdelinger</div>
            <MultiSelect
              options={departments}
              values={draft.departments}
              label="Afdelinger"
              placeholder="Alle afdelinger"
              onChange={(d) => setDraft({ ...draft, departments: d })}
              help={live !== undefined && live !== null ? `${formatNumber(live)} kontaktpersoner matcher personaen.` : "Vælg en eller flere. Tom = alle."}
            />
          </div>
        </div>
      </Dialog>
    </>
  );
}

// ---------- Teknologi (02b.2, 03.2) ----------

export type TechMode = "any" | "include" | "exclude";

export interface TechValue {
  on: boolean;
  mode: TechMode;
  values: string[];
}

/**
 * 03.2 Teknologifelt: kontakten først, så "Firmaer der benytter" og dropdown'en ("Et CMS" som
 * standard). Vælger man "Inkluder kun følgende" / "Ekskluder følgende", forsvinder teksten, og
 * søg-og-vælg-feltet står efter dropdown'en. Kontakt fra = kun kontakten. Ryd står i rækken.
 *
 * `variant="operator"` er 02b.2 Med / uden: operatoren "benytter"/"benytter ikke" + søgefelt,
 * samme felt, to retninger (erstatter to separate felter i produktionen).
 */
export function TechnologyField({ label, value, onChange, suggestions, variant = "row" }: { label: string; value: TechValue; onChange: (v: TechValue) => void; suggestions?: readonly string[]; variant?: "row" | "operator" }) {
  const anyLabel = `Et ${label}`;
  if (variant === "operator") {
    return (
      <>
        <OperatorSelect
          value={value.mode === "exclude" ? "not_in" : "in"}
          operators={["in", "not_in"]}
          labels={{ in: "benytter", not_in: "benytter ikke" }}
          onChange={(op) => onChange({ ...value, on: true, mode: op === "not_in" ? "exclude" : "include" })}
        />
        <TagInput values={value.values} suggestions={suggestions} placeholder="Søg efter en teknologi…" morePlaceholder="Søg efter en teknologi…" onChange={(values) => onChange({ ...value, on: true, values })} />
      </>
    );
  }
  return (
    <>
      <Toggle on={value.on} label={label} onChange={(on) => onChange({ ...value, on })} />
      {value.on ? (
        <>
          {value.mode === "any" ? <span className="lasso-field__fixed">Firmaer der benytter</span> : null}
          <SelectField
            options={[{ id: "any", label: anyLabel }, { id: "include", label: "Inkluder kun følgende" }, { id: "exclude", label: "Ekskluder følgende" }]}
            value={value.mode}
            grow={false}
            label={`${label}, valg`}
            onChange={(id) => onChange({ ...value, mode: id as TechMode, values: id === "any" ? [] : value.values })}
          />
          {value.mode !== "any" ? <TagInput values={value.values} suggestions={suggestions} placeholder="Søg efter flere…" morePlaceholder="Søg efter flere…" onChange={(values) => onChange({ ...value, values })} /> : null}
        </>
      ) : null}
    </>
  );
}

/**
 * 03.2–03.4 Teknologifeltet i sin række: FieldRow + TechnologyField. "Ryd" vises kun, når
 * kontakten er til (03.4: kontakt fra = kun kontakten, intet at rydde).
 */
export function TechnologyRow({ label, value, onChange, onClear, suggestions, pending, active }: { label: string; value: TechValue; onChange: (v: TechValue) => void; onClear?: () => void; suggestions?: readonly string[]; pending?: FieldRowProps["pending"]; active?: boolean }) {
  return (
    <FieldRow label={label} onClear={value.on ? onClear : undefined} pending={pending} active={active}>
      <TechnologyField label={label} value={value} onChange={onChange} suggestions={suggestions} />
    </FieldRow>
  );
}
