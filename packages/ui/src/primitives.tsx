import type { ReactNode } from "react";
import { MISSING, changePercent, formatDate, formatPercent, percentChange, statusGroup, type CompanyVM, type Severity, type StatusGroup } from "@lasso/spec";
import { Icon } from "./components/Icon.js";

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`lasso-card ${className}`}>
      {title ? <h3 className="lasso-card__title">{title}</h3> : null}
      {children}
    </section>
  );
}

/**
 * Sektion (regel 3): ingen kortramme, kun overskrift 18/600, undertitel i muted,
 * og luft. Handling (fx "Se alle") står til højre for overskriften.
 */
export function Section({
  title,
  subtitle,
  action,
  children,
  className = "",
  span = "full",
  inlineSubtitle = false,
  card = false,
  frame = false,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** 29.2: undertitlen (fx enheden "t. kr., årsrapport 2025") står muted på samme linje efter titlen. */
  inlineSubtitle?: boolean;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  span?: "quarter" | "half" | "three-quarters" | "full";
  /** Kort (katalog 28): 1 px kant, radius 12 og overskrift 15/600, fx datatyperne fra API'et. */
  card?: boolean;
  /**
   * Elementramme (10b regel 1, Paper LDP-0): 1 px kant, radius 10, hvid flade, 20 px luft og
   * overskrift 18/600; indholdet (fx en tilstand) fylder resten af højden.
   */
  frame?: boolean;
}) {
  return (
    <section className={`lasso-section lasso-span-${span}${card ? " lasso-section--card" : ""}${frame ? " lasso-section--frame" : ""} ${className}`}>
      {title || action ? (
        <div className="lasso-section__head">
          <div className={`lasso-section__titles ${inlineSubtitle ? "lasso-section__titles--inline" : ""}`}>
            {title ? <h3 className="lasso-section__title">{title}</h3> : null}
            {subtitle ? <p className="lasso-section__subtitle">{subtitle}</p> : null}
          </div>
          {action ? <div className="lasso-section__action">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Statusens tone (katalog 02c.8, 05.7, 28.1; Jakobs justering 29.09.2026). Farven følger ordet via
 * statusGroup (packages/spec/src/status.ts), fire grupper for alle 19 CVR-statusser:
 * aktiv = tekstfarve ("active"), midlertidig = warning-tekst ("liquidation": Fremtid, Uden retsvirkning,
 * Under frivillig likvidation, Under reassumering), problem = mørk rød ("warning": Under konkurs,
 * Under tvangsopløsning, Under rekonstruktion, Tvangsopløst, Opløst efter konkurs), inaktiv = muted
 * ("inactive"). "Ny" er koral tekst. Ukendte ord falder tilbage på modellens statusKind.
 */
export type StatusTone = "active" | "warning" | "liquidation" | "inactive" | "new";

const GROUP_TONE: Record<StatusGroup, StatusTone> = { active: "active", temporary: "liquidation", problem: "warning", inactive: "inactive" };

export function statusTone(status: string | undefined, kind: CompanyVM["statusKind"] | "new" | undefined): StatusTone {
  if (kind === "new" || (status && /^ny$/i.test(status.trim()))) return "new";
  const group = statusGroup(status);
  if (group) return GROUP_TONE[group];
  return kind ?? "inactive";
}

/** Regel 1: status er ren tekst i vægt 500 - ingen pille, prik eller farvet flade. */
export function StatusBadge({ status, kind, size }: { status?: string; kind?: CompanyVM["statusKind"] | "new"; /** "sm": 12 px (05.7, status stående alene); standard arver størrelsen fra omgivelsen. */ size?: "sm" }) {
  if (!status) return null;
  return <span className={`lasso-badge lasso-badge--${statusTone(status, kind)}${size === "sm" ? " lasso-badge--sm" : ""}`}>{status}</span>;
}

/** Regel 2: ingen dekorative badges. Bevaret som ren tekst, så eksisterende kald virker. */
export function Badge({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "demo" | "active" | "warning" | "inactive" }) {
  return <span className={`lasso-badge lasso-badge--${tone}`}>{children}</span>;
}

/**
 * De fem tilstande fra kataloget + de to adgangstilstande fra 26h ("låst", "på forespørgsel").
 * "filled" tegnes af komponenten selv; de øvrige tegnes her, så alle elementer ser ens ud.
 */
export type DataStateKind = "loading" | "empty" | "notreported" | "error" | "ondemand" | "locked" | "onrequest" | "unavailable";

export interface DataStateAction {
  label: string;
  onClick?: () => void;
}

export interface DataStateProps {
  state: DataStateKind;
  /** Tom: skal sige HVORFOR der intet er (aldrig "0"). Låst: hvad der kræves. På forespørgsel: pris og varighed. */
  reason?: string;
  /** Fed første linje, fx "Ingen nyheder endnu", "Regnskab kunne ikke hentes", "Reelle ejere kræver Lasso Pro" (låst) eller "Kreditvurdering" (på forespørgsel). */
  title?: string;
  /** Tom (26h.1): hvornår der sidst blev tjekket; vises som "Sidst tjekket DD.MM.ÅÅÅÅ". */
  checkedAt?: string;
  /** Tom som positiv information ("intet fundet", katalog 17): flueben i stedet for dokumentikonet. */
  positive?: boolean;
  /** Tom, venstrestillet med ⓘ-ikon foran teksten (26e.3). Standard: centreret. */
  inline?: boolean;
  /** Tom med 1 px fuld kant i stedet for stiplet (26h.1, når elementet selv er et kort). */
  solid?: boolean;
  /** Fejl: kun teknisk fejl. Giver en "Prøv igen"-knap (primær), når den er sat. */
  onRetry?: () => void;
  /** Tom/låst/på forespørgsel: én handling ("Overvåg nyheder", "Se planer", "Hent kreditvurdering"). */
  action?: DataStateAction;
  /** Fejl: sekundær handling ved siden af "Prøv igen", fx "Rapportér". */
  secondaryAction?: DataStateAction;
  /** På forespørgsel: ventetilstanden (48 px række med ring), fx { title: "Henter vurdering …", detail: "ca. 20 sek. …" }. */
  pending?: { title: string; detail?: string };
  /** Låst: indholdet, der dæmpes til 35 % bag det forklarende kort. Standard: skeletlinjer. */
  children?: ReactNode;
  /** Henter: skelettet får samme højde som det fyldte element. */
  height?: number;
  lines?: number;
  /** Beregnes på forespørgsel (10.3): knaptekst, fx "Beregn nu" eller "Hent score". */
  actionLabel?: string;
  /** Beregnes på forespørgsel: handlingen. Uden den vises kun forklaringen. */
  onAction?: () => void;
  /** Beregnes på forespørgsel: prisen/ventetiden, fx "Koster 1 kredit, tager 5–45 sekunder". */
  cost?: string;
  /**
   * Tom, 10.3-formen ("Ingen data"): grå panel-flade uden kant, venstrestillet titel 16/600, forklaring
   * og handlingen som koral tekst, intet ikon. Standard er 26h.1-formen (stiplet ramme med ikon).
   */
  look?: "panel";
  /** Henter (10.3): skelettet i et kort med 1 px kant. Standard: skeletlinjer uden ramme. */
  framed?: boolean;
  /**
   * Henter (10b, Paper LDP-0): skelettet i indholdets form, med shimmer 1,4 s (stille ved
   * prefers-reduced-motion): "keyvalue" (nøgle-værdi-liste, 10.3), "gauge" (scoremåler, 10.4) eller
   * "card" (mobilkort, 26c.7). Standard: skeletlinjer.
   */
  shape?: SkeletonShapeKind;
  /** Henter: kort note under skelettet, fx "Tager typisk et par sekunder. Du kan fortsætte på siden." */
  note?: string;
  /** Fejl (10b regel 5): fejl-id som tekst ved siden af "Prøv igen", fx "4F2A". */
  errorId?: string;
}

function StateIcon({ kind }: { kind: "doc" | "check" | "alert" | "lock" | "info" | "ban" | "danger" }) {
  // 10b (Paper LE7-0): tom/ikke tilgængelig = 24 px ikon i faint; fejl = 24 px advarselstrekant i danger.
  if (kind === "ban") {
    return (
      <svg className="lasso-state__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5.6 5.6l12.8 12.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "danger") {
    return (
      <svg className="lasso-state__icon lasso-state__icon--alert" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M10.3 3.9L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 9v4.5M12 16.8v.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "info") {
    return (
      <svg className="lasso-state__icon lasso-state__icon--info" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 11v5.5M12 7.8v.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "check") {
    return (
      <svg className="lasso-state__icon lasso-state__icon--check" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 12.5l2.7 2.7L16 9.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "alert") {
    return (
      <svg className="lasso-state__icon lasso-state__icon--alert" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 7.5v5.5M12 16.2v.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "lock") {
    return (
      <svg className="lasso-state__icon lasso-state__icon--lock" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5" y="10.5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 10.5V7.5a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  return (
    <svg className="lasso-state__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3h7l5 5v13H7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3v5h5M10 13h6M10 17h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Ventering (26h.1): 18 px ring, der drejer; stille ved reduceret bevægelse. */
export function PendingRing() {
  return <span className="lasso-ring" aria-hidden="true" />;
}

export function DataState({ state, reason, title, checkedAt, positive, onRetry, action, secondaryAction, pending, children, height, lines = 3, actionLabel, onAction, cost, look, framed, inline, solid, shape, note, errorId }: DataStateProps) {
  if (state === "loading") {
    const body = shape ? (
      <div className="lasso-state-loading" aria-busy="true" aria-label="Henter data" style={height ? { minHeight: height } : undefined}>
        <SkeletonShape shape={shape} />
        {note ? <div className="lasso-state-loading__note">{note}</div> : null}
      </div>
    ) : (
      <Skeleton lines={lines} height={height} />
    );
    return framed ? <div className="lasso-state-frame">{body}</div> : body;
  }
  if (state === "ondemand") {
    // 10b/10.3 (Paper LET-0): venstrestillet, uden ramme: titel 14/600, én linje årsag og én primær
    // handling med ✧-ikon, der starter beregningen.
    return (
      <div className="lasso-state lasso-state--ondemand" style={height ? { minHeight: height } : undefined}>
        <div className="lasso-state__title">{title ?? "Ikke beregnet endnu"}</div>
        <div className="lasso-small">{reason ?? "Tallet beregnes først, når du beder om det."}</div>
        {cost ? <div className="lasso-state__cost">{cost}</div> : null}
        {onAction ? (
          <button type="button" className="lasso-btn lasso-btn--primary lasso-state__cta" onClick={onAction}>
            <Icon name="sparkle" size={16} />
            {actionLabel ?? "Beregn nu"}
          </button>
        ) : null}
      </div>
    );
  }
  if (state === "unavailable") {
    // 10b (Paper LH1-0): ikke tilgængelig = ikon, titel og årsag; ingen handling, ingen stiplet ramme.
    return (
      <div className="lasso-state lasso-state--unavailable" style={height ? { minHeight: height } : undefined}>
        <StateIcon kind="ban" />
        <div className="lasso-state__title">{title ?? "Ikke tilgængelig"}</div>
        {reason ? <div className="lasso-small">{reason}</div> : null}
      </div>
    );
  }
  if (state === "notreported") return <span className="lasso-notreported">Ikke oplyst</span>;
  if (state === "empty" && look === "panel") {
    return (
      <div className="lasso-state-panel" style={height ? { minHeight: height } : undefined}>
        {title ? <div className="lasso-state-panel__title">{title}</div> : null}
        <p className="lasso-state-panel__text">
          {reason ?? "Der er ingen data at vise."}
          {checkedAt ? ` Sidst tjekket ${formatDate(checkedAt)}.` : ""}
        </p>
        {action?.onClick ? (
          <button type="button" className="lasso-link lasso-state-panel__action" onClick={action.onClick}>
            {action.label}
          </button>
        ) : null}
      </div>
    );
  }
  if (state === "empty" && inline) {
    return (
      <div className="lasso-state lasso-state--inline" style={height ? { minHeight: height } : undefined}>
        <StateIcon kind="info" />
        <div className="lasso-small">
          {title ? <div className="lasso-state__title">{title}</div> : null}
          {reason ?? "Der er ingen data at vise."}
          {checkedAt ? ` Sidst tjekket ${formatDate(checkedAt)}.` : ""}
        </div>
      </div>
    );
  }
  if (state === "empty") {
    // Tom (26h.1): ikon, én linje årsag, tidsstempel og højst én handling. Stiplet ramme, aldrig grå fyld.
    return (
      <div className={`lasso-state${positive ? " lasso-state--positive" : ""}${solid ? " lasso-state--solid" : ""}`} style={height ? { minHeight: height } : undefined}>
        {title || positive ? <StateIcon kind={positive ? "check" : "doc"} /> : null}
        {title ? <div className="lasso-state__title">{title}</div> : null}
        <div className="lasso-small">
          {reason ?? "Der er ingen data at vise."}
          {checkedAt ? ` Sidst tjekket ${formatDate(checkedAt)}.` : ""}
        </div>
        {action?.onClick ? (
          <button type="button" className="lasso-btn lasso-state__action" onClick={action.onClick}>
            {action.label}
          </button>
        ) : null}
      </div>
    );
  }
  if (state === "locked") {
    // Låst (26h.1): et givet indhold (children) dæmpes til 35 % bag et forklarende kort med én primær
    // handling. 17.3 (Jakob): uden indhold tegnes ingen skeletstreger bag kortet; kun låsekortet.
    return (
      <div className="lasso-state-locked">
        <span className="lasso-state-locked__lock" title="Låst">
          <StateIcon kind="lock" />
        </span>
        {children ? (
          <div className="lasso-state-locked__content" aria-hidden="true">
            {children}
          </div>
        ) : null}
        <div className="lasso-state-locked__card">
          <div>
            {title ? <div className="lasso-state__title">{title}</div> : null}
            <p className="lasso-state-locked__text">{reason ?? "Kræver en anden Lasso-pakke."}</p>
          </div>
          {action?.onClick ? (
            <button type="button" className="lasso-btn lasso-btn--primary lasso-state__wide" onClick={action.onClick}>
              {action.label}
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  if (state === "onrequest") {
    // På forespørgsel (26h.1): pris og varighed før knappen; ventetilstand som 48 px række med ring.
    return (
      <div className="lasso-state-request">
        {title || reason ? (
          <div>
            {title ? <div className="lasso-state__title">{title}</div> : null}
            {reason ? <p className="lasso-state-request__text">{reason}</p> : null}
          </div>
        ) : null}
        {pending ? (
          <div className="lasso-state-request__pending" role="status">
            <PendingRing />
            <span>
              <span className="lasso-state-request__title">{pending.title}</span>
              {pending.detail ? <span className="lasso-state-request__detail">{pending.detail}</span> : null}
            </span>
          </div>
        ) : action?.onClick ? (
          <button type="button" className="lasso-btn lasso-btn--primary lasso-state__wide" onClick={action.onClick}>
            {action.label}
          </button>
        ) : null}
      </div>
    );
  }
  // Fejl (10b regel 5): samme opbygning som tom, men ikon i danger, "Prøv igen" som primær og fejl-id
  // som tekst. Rammen er uændret (ingen rød kant). Kun ved teknisk fejl.
  return (
    <div className="lasso-state lasso-state--error" role="alert" style={height ? { minHeight: height } : undefined}>
      <StateIcon kind="danger" />
      <div className="lasso-state__title">{title ?? "Data kunne ikke hentes"}</div>
      {reason ? <div className="lasso-small">{reason}</div> : null}
      {onRetry || secondaryAction?.onClick || errorId ? (
        <div className="lasso-state__actions">
          {onRetry ? (
            <button type="button" className="lasso-btn lasso-btn--primary lasso-state__retry" onClick={onRetry}>
              Prøv igen
            </button>
          ) : null}
          {secondaryAction?.onClick ? (
            <button type="button" className="lasso-btn lasso-state__secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          ) : null}
          {errorId ? <span className="lasso-state__errid">Fejl-id {errorId}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Enkelt manglende værdi i en celle eller et felt: "-" i text-faint. */
export function Missing() {
  return <span className="lasso-notreported">{MISSING}</span>;
}

/**
 * Kildelinjen ("Kilde: Navn, opdateret DD.MM.ÅÅÅÅ") er UDGÅET (Jakob 29.09, G3): den vises ikke i
 * noget element. Komponenten beholdes, så eksisterende kald stadig kompilerer, men tegner intet.
 * Ingen anden kildevisning heller (Jakob runde 6): ingen "Vis kilder (N)" og ingen "Kilder" + link.
 */
export function SourceLine(_props: { source: string; updated?: string | null; verb?: string }) {
  return null;
}

export type StateKind = "empty" | "loading" | "noaccess" | "error";

/** Ældre kald. Mapper til DataState, så alle tilstande følger kataloget. */
export function StateBox({ kind, message }: { kind: StateKind; message?: string }) {
  if (kind === "loading") return <DataState state="loading" />;
  if (kind === "empty") return <DataState state="empty" reason={message ?? "Ingen resultater. Prøv at fjerne et kriterium eller søge bredere."} />;
  if (kind === "noaccess") return <DataState state="empty" reason={message ?? "Din Lasso-konto har ikke adgang til disse data."} />;
  return <DataState state="error" reason={message} />;
}

export function stateForError(message: string | undefined): StateKind {
  if (!message) return "error";
  return /adgang|401|403/i.test(message) ? "noaccess" : "error";
}

/** Skelettets former (10b, Paper LDP-0). */
export type SkeletonShapeKind = "keyvalue" | "gauge" | "card";

/** Én skeletstreg (10b regel 2): 12 px, radius 4, divider-subtle, shimmer 1,4 s. `block` = større flade (tal). */
export function SkelBar({ w, h = 12, block = false, grow = false }: { w?: number | string; h?: number; block?: boolean; grow?: boolean }) {
  return <span className={`lasso-skel${block ? " lasso-skel--block" : ""}`} style={{ width: grow ? undefined : w, height: h, flex: grow ? "1 1 auto" : undefined }} />;
}

/**
 * Skelet i indholdets form (10b regel 2-3): streger på 12 px med 10-14 px mellemrum, samme højde som
 * det fyldte indhold, og et lyst bånd, der glider fra venstre mod højre (1,4 s, lineært, uendeligt).
 */
export function SkeletonShape({ shape }: { shape: SkeletonShapeKind }) {
  const pair = (a: number, b: number, top = false) => (
    <div className={`lasso-skelshape__pair${top ? " lasso-skelshape__pair--top" : ""}`}>
      <SkelBar w={a} />
      <SkelBar w={b} />
    </div>
  );
  if (shape === "card") {
    const fig = (a: number, b: number) => (
      <div className="lasso-skelshape__fig">
        <SkelBar w={a} h={8} />
        <SkelBar w={b} />
      </div>
    );
    return (
      <div className="lasso-skelshape lasso-skelshape--card" aria-hidden="true">
        <div className="lasso-skelshape__pair lasso-skelshape__pair--center">
          <SkelBar w={140} h={14} block />
          <SkelBar w={40} h={10} />
        </div>
        <SkelBar w={200} h={10} />
        <span className="lasso-skelshape__rule" />
        <div className="lasso-skelshape__pair">
          <div className="lasso-skelshape__figs">
            {fig(52, 44)}
            {fig(52, 48)}
            {fig(48, 24)}
          </div>
          <div className="lasso-skelshape__fig lasso-skelshape__fig--end">
            <SkelBar w={36} h={8} />
            <SkelBar w={24} />
          </div>
        </div>
      </div>
    );
  }
  if (shape === "gauge") {
    return (
      <div className="lasso-skelshape" aria-hidden="true">
        <div className="lasso-skelshape__lead">
          <SkelBar w={56} h={36} block />
          <SkelBar w={40} />
          <SkelBar w={64} />
        </div>
        <div className="lasso-skelshape__track">
          <span className="lasso-skel" style={{ flexGrow: 60, height: 6 }} />
          <span className="lasso-skel" style={{ flexGrow: 20, height: 6 }} />
          <span className="lasso-skel" style={{ flexGrow: 20, height: 6 }} />
        </div>
        <div className="lasso-skelshape__pair">
          <SkelBar w={56} h={10} />
          <SkelBar w={72} h={10} />
        </div>
        {pair(110, 60, true)}
        {pair(130, 24)}
      </div>
    );
  }
  return (
    <div className="lasso-skelshape" aria-hidden="true">
      <div className="lasso-skelshape__lead">
        <SkelBar w={64} h={28} block />
        <SkelBar w={48} />
        <SkelBar w={72} />
      </div>
      <SkelBar w="100%" h={8} />
      {pair(120, 64, true)}
      {pair(100, 40)}
      {pair(140, 56)}
    </div>
  );
}

export function Skeleton({ lines = 3, height }: { lines?: number; height?: number }) {
  return (
    <div aria-busy="true" aria-label="Henter data" className="lasso-skeleton-group" style={height ? { minHeight: height } : undefined}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="lasso-skeleton" style={{ width: `${90 - i * 18}%` }} />
      ))}
    </div>
  );
}

/**
 * Sparkline (13.9, 26b.7): altid koral ved `tone="accent"`, prik på seneste værdi. Krydser serien 0,
 * tegnes en stiplet nullinje. `kind="bars"` giver sparsøjler (fx ansatte pr. kvartal) med seneste søjle
 * i koral. Under 3 datapunkter tegnes ingen sparkline, kun "-".
 */
export function Sparkline({
  values,
  tone = "neutral",
  bare = false,
  kind = "line",
  width = 72,
  height = 22,
}: {
  values: readonly number[];
  tone?: "neutral" | "accent";
  bare?: boolean;
  kind?: "line" | "bars";
  width?: number;
  height?: number;
}) {
  const pct = percentChange(values);
  if (values.length < 3) return <Missing />;
  const w = width;
  const h = height;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const crosses = lo < 0 && hi > 0;
  let body: ReactNode;
  if (kind === "bars") {
    const top = Math.max(hi, 0);
    const bottom = Math.min(lo, 0);
    const range = top - bottom || 1;
    const gap = 2;
    const bw = (w - gap * (values.length - 1)) / values.length;
    const y0 = ((top - 0) / range) * h;
    body = values.map((v, i) => {
      const yv = ((top - v) / range) * h;
      return <rect key={i} className={`lasso-spark__bar${i === values.length - 1 ? " is-last" : ""}`} x={i * (bw + gap)} y={Math.min(y0, yv)} width={bw} height={Math.max(1, Math.abs(y0 - yv))} rx="1" />;
    });
  } else {
    // 13.9: y-aksen spænder mindst 20 % af tallenes størrelse, så en næsten flad serie (+0,8 %)
    // tegnes flad og midt i feltet i stedet for som en zigzag fra top til bund.
    const span = Math.max(hi - lo, 0.2 * Math.max(Math.abs(lo), Math.abs(hi))) || 1;
    const min = (lo + hi) / 2 - span / 2;
    const yOf = (v: number) => h - 3 - ((v - min) / span) * (h - 6);
    const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 6) + 3, yOf(v)] as const);
    const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const last = pts[pts.length - 1]!;
    body = (
      <>
        {crosses ? <line className="lasso-spark__zero" x1="0" x2={w} y1={yOf(0)} y2={yOf(0)} /> : null}
        <path d={d} />
        <circle cx={last[0]} cy={last[1]} r="2.2" />
      </>
    );
  }
  const svg = (
    <svg className={`lasso-spark lasso-spark--${tone}${kind === "bars" ? " lasso-spark--bars" : ""}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {body}
    </svg>
  );
  if (bare) return svg;
  return (
    <span className="lasso-trend" title={pct !== null ? `${formatPercent(pct)} over perioden` : undefined}>
      {svg}
      <span className={`lasso-trend__pct ${pct !== null && pct < 0 ? "lasso-down" : "lasso-up"}`}>{formatPercent(pct)}</span>
    </span>
  );
}

/**
 * 02c.4 / katalog 09: ændring som pil + procent i grøn (stigning) eller rød (fald), fx "▲ 12,4 %".
 * Ingen ord efter procenten. Ved fortegnsskift vises også pil + procent; kan ændringen ikke
 * beregnes (intet forrige år, eller forrige = 0), vises intet.
 */
export function Delta({ from, to }: { from?: number | null; to?: number | null }) {
  const pct = changePercent(from, to);
  if (pct === null) return null;
  return (
    <span className={pct < 0 ? "lasso-down" : "lasso-up"}>
      <span className="lasso-arrow">{pct < 0 ? "▼" : "▲"}</span> {formatPercent(Math.abs(pct), false)}
    </span>
  );
}

/** Alvorsordet, ren tekst (katalog 17, guide 23 regel 10). "assessment" bruger de tre trin fra katalog 22. */
export function severityWord(severity: Severity, variant: "observation" | "assessment" = "observation"): string {
  if (variant === "assessment") return severity === 100 ? "Konflikt" : severity === 50 ? "Vurdér" : "Neutral";
  return severity === 100 ? "Vigtig" : severity === 50 ? "Mulig vigtig" : severity === 25 ? "Info" : "Neutral";
}

/**
 * Alvorsikon (katalog 17): grå prik for neutral, ellers et omridsikon i info/gul/rød.
 * Farven forstærker kun; ordet ved siden af (severityWord) bærer betydningen (regel 7).
 */
export function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === 0) return <span className="lasso-sev-dot" aria-hidden="true" />;
  if (severity === 25) {
    return (
      <svg className="lasso-sev-icon lasso-sev-icon--25" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 11v6M12 7.5v.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (severity === 50) {
    return (
      <svg className="lasso-sev-icon lasso-sev-icon--50" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M10.3 3.9L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className="lasso-sev-icon lasso-sev-icon--100" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 7v6M12 16.5v.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M12 2l10 18H2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function initials(name: string): string {
  return name
    .replace(/\b(A\/S|ApS|I\/S|K\/S|P\/S|IVS)\b/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
