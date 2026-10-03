import type { FormEvent, KeyboardEvent, MouseEvent, ReactNode, Ref } from "react";
import { Dialog, LassoMark } from "@lasso/ui";
import { P2Icon, type P2IconName } from "./icons.js";
import { highlight, SHORTCUTS, STATUS_FILTERS, type SearchRow, type SearchType, type StatusFilter } from "./model.js";

/**
 * Portalens elementer og knapper (prototypen "lasso-portal4.html"). Portalen (Portal2App) er bygget af dem, og
 * designguidens side "Portalens ramme" viser de samme komponenter i alle tilstande, så de kun findes ét sted.
 * Komponenterne er rene (ingen tilstand, ingen kald); stilen er portal2.css under .p3.
 */

/* ---------- knapper ---------- */

/** Rund ikonknap (36 px; i skinnen med tooltip). `disabled` = "kommer senere": dæmpet og uden handling. */
export function IconButton({
  icon,
  label,
  on = false,
  pressed,
  disabled = false,
  tip,
  className = "",
  onClick,
  menu = false,
}: {
  icon: P2IconName;
  label: string;
  on?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  /** Tooltip til højre (skinnen). */
  tip?: string;
  className?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  /** Knappen åbner en menu (klik uden for lukker den ikke med det samme). */
  menu?: boolean;
}) {
  return (
    <button
      type="button"
      className={`ibtn${on ? " on" : ""}${className ? ` ${className}` : ""}`}
      aria-label={disabled ? `${label} (kommer senere)` : label}
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      data-menu={menu ? "" : undefined}
      onClick={disabled ? undefined : onClick}
    >
      <P2Icon name={icon} />
      {tip ? <span className="tip">{tip}</span> : null}
    </button>
  );
}

/** "Flere ▾" og vælgere: tekst med pil, der åbner en menu. */
export function DropButton({ label, className, selected, expanded, onClick, data }: { label: ReactNode; className: string; selected?: boolean; expanded?: boolean; onClick?: (e: MouseEvent<HTMLButtonElement>) => void; data?: Record<string, string> }) {
  return (
    <button type="button" className={className} data-menu="" aria-selected={selected} aria-expanded={expanded} onClick={onClick} {...data}>
      <span>{label}</span>
      <P2Icon name="down" />
    </button>
  );
}

/* ---------- søgning ---------- */

export function SearchField({
  value,
  placeholder = "Søg firma, person eller CVR",
  label = "Søg firma, person eller CVR",
  focus = false,
  busy = false,
  inputRef,
  onChange,
  onFocus,
  onKeyDown,
  onClear,
}: {
  value: string;
  placeholder?: string;
  label?: string;
  focus?: boolean;
  /** Lasso søger: lille spinner i feltet. */
  busy?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onChange?: (v: string) => void;
  onFocus?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onClear?: () => void;
}) {
  return (
    <div className={`search${focus ? " focus" : ""}`}>
      <P2Icon name="search" className="s" />
      <input ref={inputRef} type="text" autoComplete="off" value={value} onChange={(e) => onChange?.(e.target.value)} onFocus={onFocus} onKeyDown={onKeyDown} placeholder={placeholder} aria-label={label} />
      {busy ? <span className="spin" aria-label="Søger" /> : null}
      {value ? (
        <button type="button" className="clear" aria-label="Ryd" onMouseDown={(e) => e.preventDefault()} onClick={onClear}>
          <P2Icon name="x" />
        </button>
      ) : null}
    </div>
  );
}

/** Fanerne Firmaer/Personer med antal i søgeresultaterne. */
export function SearchTabs({ type, counts, onType }: { type: SearchType; counts: Record<SearchType, number>; onType?: (t: SearchType) => void }) {
  const names: Record<SearchType, string> = { f: "Firmaer", p: "Personer" };
  return (
    <>
      {(["f", "p"] as const).map((t) => (
        <button key={t} type="button" className={`sr-tab${t === type ? " on" : ""}${counts[t] ? "" : " zero"}`} onClick={() => onType?.(t)}>
          {names[t]} <small>{counts[t]}</small>
        </button>
      ))}
    </>
  );
}

/** Statusfilteret for firmaer (Aktive, Inaktive, Alle). */
export function StatusFilterMenu({ status, open, onToggle, onPick }: { status: StatusFilter; open: boolean; onToggle?: () => void; onPick?: (s: StatusFilter) => void }) {
  return (
    <div className="stat">
      <span>Status:</span>
      <button type="button" style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={onToggle}>
        <b>{status}</b>
        <P2Icon name="down" />
      </button>
      {open ? (
        <div className="statdd">
          {STATUS_FILTERS.map((s) => (
            <button key={s} type="button" className={s === status ? "cur" : ""} onClick={() => onPick?.(s)}>
              {s}
              {s === status ? <P2Icon name="check" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Én række i søgeresultaterne: ikon, navn med det søgte fremhævet, by/CVR, og genveje på et valgt firma. */
export function SearchResultRow({
  row,
  query,
  selected,
  showStatus = false,
  onHover,
  onChoose,
}: {
  row: SearchRow;
  query: string;
  selected: boolean;
  showStatus?: boolean;
  onHover?: () => void;
  /** tab = genvejens modul (Økonomi, Ejerskab, Historik); udeladt = Overblik. */
  onChoose?: (tab?: string) => void;
}) {
  const h = highlight(row.name, query);
  return (
    <div className={`sr-row${selected ? " sel" : ""}`} onMouseMove={onHover} onClick={() => onChoose?.()}>
      <P2Icon name={row.kind === "company" ? "build" : "user"} />
      <div className="t">
        <div className="nl">
          <div className="n">
            {h.pre}
            {h.hit ? <b>{h.hit}</b> : null}
            {h.post}
          </div>
          {row.status && showStatus ? <span className="st">{row.status}</span> : null}
        </div>
        <div className="m">{row.meta}</div>
      </div>
      {row.kind === "company" ? (
        <div className="short">
          {SHORTCUTS.map((s) => (
            <button
              key={s.tab}
              type="button"
              aria-label={`Åbn i ${s.label}`}
              onClick={(e) => {
                e.stopPropagation();
                onChoose?.(s.tab);
              }}
            >
              <P2Icon name={s.icon} />
              <span className="tt">{s.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Ingen match: forklaring og rækken "Spørg Lasso om …". */
export function SearchEmpty({ query, onAsk }: { query: string; onAsk?: () => void }) {
  return (
    <>
      <div className="sr-empty">Ingen firmaer eller personer matcher "{query}". Prøv et CVR-nummer eller en del af navnet.</div>
      <div className="sr-list">
        <div className="sr-row sel" onClick={onAsk}>
          <LassoMark className="mark" />
          <div className="t">
            <div className="n">Spørg Lasso om "{query}"</div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- faner og moduler ---------- */

/** En åben fane (firma, person eller resultat). `solo` = den eneste synlige: bliver en dropdown med alle åbne. */
export function OpenTab({
  name,
  sub,
  active,
  solo = false,
  busy = false,
  kind,
  dataKey,
  onSelect,
  onClose,
}: {
  name: string;
  sub?: string;
  active: boolean;
  solo?: boolean;
  /** Lasso henter til fanen: mærket bevæger sig foran navnet (i stedet for ikonet). */
  busy?: boolean;
  /** Fanens ikon: bygning (firma), person, eller Lasso-mærket (global fane). */
  kind?: "company" | "person" | "result";
  dataKey?: string;
  onSelect?: (e: MouseEvent<HTMLDivElement>) => void;
  onClose?: () => void;
}) {
  return (
    <div
      data-key={dataKey}
      className={`otab${active ? " on" : ""}${solo ? " solo" : ""}`}
      role="tab"
      aria-selected={active}
      tabIndex={0}
      data-menu={solo ? "" : undefined}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect?.(e as unknown as MouseEvent<HTMLDivElement>)}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          onClose?.();
        }
      }}
    >
      {busy ? (
        <LassoMark className="mark kind is-busy" />
      ) : kind === "result" ? (
        <LassoMark className="mark kind" />
      ) : kind ? (
        <P2Icon name={kind === "company" ? "build" : "user"} className="i kind" />
      ) : null}
      <span className="nm">{name}</span>
      <P2Icon name="down" className="i chev" />
      <button
        type="button"
        className="x"
        aria-label={`Luk ${name}`}
        onClick={(e) => {
          e.stopPropagation();
          onClose?.();
        }}
      >
        <P2Icon name="x" />
      </button>
      <span className="ttip">
        {name}
        {sub ? (
          <>
            <br />
            <span>{sub}</span>
          </>
        ) : null}
      </span>
    </div>
  );
}

/**
 * Lasso-modulet (chatten): altid første modul og altid slået til. Aktivt er mærket ink med koral streg; mærket
 * bevæger sig (koral), mens Lasso henter. `disabled` bruges ikke længere (fanen har altid en samtale eller tom tilstand).
 */
export function LassoTab({ on, busy = false, onClick }: { on: boolean; busy?: boolean; /** @deprecated Lasso-modulet er altid slået til. */ disabled?: boolean; onClick?: () => void }) {
  const label = busy ? "Lasso, henter svaret" : "Lasso";
  return (
    <button type="button" role="tab" className={`tabmark${on ? " on" : ""}${busy ? " is-busy" : ""}`} aria-selected={on} aria-label={label} title={label} onClick={onClick}>
      <LassoMark className="mark" />
    </button>
  );
}

export function ModuleTab({ id, label, selected, onClick }: { id: string; label: string; selected: boolean; onClick?: () => void }) {
  return (
    <button type="button" className="tab" role="tab" data-mod={id} aria-selected={selected} onClick={onClick}>
      {label}
    </button>
  );
}

/* ---------- menuer ---------- */

/** Række i en menu (.dd): ikon og tekst, flueben på den aktuelle, eller et luk-kryds. */
export function MenuItem({ icon, label, current = false, muted = false, onClick, onClose }: { icon?: P2IconName; label: ReactNode; current?: boolean; muted?: boolean; onClick?: () => void; onClose?: () => void }) {
  return (
    <button type="button" className={`${current ? "cur" : ""}${muted ? " muted" : ""}`.trim() || undefined} onClick={onClick}>
      {icon ? (
        <span className="ic">
          <P2Icon name={icon} />
          <span>{label}</span>
        </span>
      ) : (
        label
      )}
      {current ? (
        <P2Icon name="check" />
      ) : onClose ? (
        <span
          className="ddx"
          role="button"
          aria-label={`Luk ${typeof label === "string" ? label : ""}`.trim()}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <P2Icon name="x" />
        </span>
      ) : null}
    </button>
  );
}

/* ---------- spørgefeltet og bundbjælken ---------- */

/**
 * Spørgefeltet (chatten): pille 720 × 52 med "Spørg Lasso" og enter-ikonet. Mens Lasso svarer, er feltet slået fra
 * (Stop står i samtalen ved den længere opgave).
 */
export function AskField({
  value,
  placeholder,
  pending = false,
  disabled = false,
  inputRef,
  onChange,
  onSubmit,
}: {
  value: string;
  placeholder: string;
  /** Lasso svarer: feltet og enter er slået fra. */
  pending?: boolean;
  /** Chatten er slået fra (ingen ANTHROPIC_API_KEY). */
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onChange?: (v: string) => void;
  onSubmit?: () => void;
  /** @deprecated Stop står i samtalen (den længere opgave). */
  onStop?: () => void;
}) {
  return (
    <form
      className="field"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (!pending) onSubmit?.();
      }}
    >
      <input ref={inputRef} value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} aria-label="Spørg Lasso" disabled={disabled || pending} />
      <button type="submit" className="send" aria-label="Send" disabled={pending || disabled || !value.trim()}>
        <P2Icon name="enter" />
      </button>
    </form>
  );
}

/** De tre forslag under feltet som ren tekst (14/22, 28 imellem; stablet på telefonen). Skjules i tom tilstand. */
export function Suggestions({ items, disabled = false, onPick }: { items: readonly string[]; disabled?: boolean; onPick?: (s: string) => void }) {
  return (
    <div className="sugg">
      {items.map((s) => (
        <button key={s} type="button" onClick={() => onPick?.(s)} disabled={disabled}>
          {s}
        </button>
      ))}
    </div>
  );
}

/** Telefonens bundbjælke: Lasso-knappen (spørg) og kapslen med Søg, Værktøjer og Lister. */
export function BottomBar({ busy = false, searchOn = false, homeOn = false, onAsk, onSearch, onHome, onLists }: { busy?: boolean; searchOn?: boolean; homeOn?: boolean; onAsk?: () => void; onSearch?: () => void; onHome?: () => void; onLists?: () => void }) {
  return (
    <div className="mbar">
      <button type="button" className={`lbtn${busy ? " is-busy" : ""}`} aria-label="Spørg Lasso" onClick={onAsk}>
        <LassoMark className="mark" />
      </button>
      <div className="capsule">
        <IconButton icon="search" label="Søg" on={searchOn} onClick={onSearch} />
        <IconButton icon="grid" label="Værktøjer" on={homeOn} onClick={onHome} />
        <IconButton icon="folder" label="Lister" onClick={onLists} />
      </div>
    </div>
  );
}

/** En åben fane i telefonens topbjælke: navnet; den aktive med pil, når den er eneste synlige (dropdown). */
export function TopTab({ name, active, solo = false, dataKey, onClick }: { name: string; active: boolean; solo?: boolean; dataKey?: string; onClick?: (e: MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button type="button" data-tt={dataKey} data-menu={solo ? "" : undefined} className={`tt${active ? " on" : ""}${solo ? " solo" : ""}`} onClick={onClick}>
      <span>{name}</span>
      {solo ? <P2Icon name="down" /> : null}
    </button>
  );
}

/* ---------- sideskabeloner ---------- */

const KIND_ALL: Record<"company" | "person", string> = { company: "alle virksomheder", person: "alle personer" };

/** Nålen i modulrækken på et skabelonmodul: fyldt rød = tilføjet på alle firmaer/personer. Klik spørger, om modulet skal fjernes. */
export function TemplatePin({ kind, title, onClick }: { kind: "company" | "person"; title: string; onClick?: () => void }) {
  return <IconButton icon="pin" className="tplpin" label={`${title} er tilføjet på ${KIND_ALL[kind]}. Fjern modulet`} on onClick={onClick} />;
}

/**
 * Bekræftelsen, før et skabelonmodul fjernes (07.2: den destruktive "Fjern" som rød tekst yderst til venstre, Annuller
 * til højre). Fokus lander på Annuller, så Enter aldrig fjerner modulet ved et uheld.
 */
export function RemoveTemplateDialog({ open, kind, title, onCancel, onConfirm }: { open: boolean; kind: "company" | "person"; title: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog
      open={open}
      size="sm"
      title="Fjern modulet?"
      description={`${title} fjernes fra ${KIND_ALL[kind]}. Det kan ikke fortrydes.`}
      onClose={onCancel}
      hideClose
      initialFocus="secondary"
      actions={{ destructive: { label: "Fjern", onClick: onConfirm }, secondary: { label: "Annuller", onClick: onCancel } }}
    />
  );
}
