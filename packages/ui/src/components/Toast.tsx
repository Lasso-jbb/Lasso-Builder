import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./Icon.js";
import { CheckIcon, CloseIcon, useLayer } from "./Layer.js";

/**
 * Besked/toast (katalog 07, node 9L1-0): nederst i midten, 52 px høj, ikon + tekst + handling
 * (Fortryd/Prøv igen) + luk. Forsvinder efter 5 sekunder, stakkes. Mobil (26a): over
 * bundnavigationen med 12 px margen, handlingen står altid i beskeden, fordi der ikke er hover.
 *
 * Brug: pak appen i <ToastProvider>, kald `useToast().show({ text, tone, action })`.
 * <Toasts> tegner stakken i laget; ToastProvider gør det selv, medmindre `container` er false.
 */
export interface ToastOptions {
  text: string;
  tone?: "ok" | "error";
  action?: { label: string; onClick: () => void };
  /** Millisekunder før beskeden forsvinder (standard 5000). */
  ttl?: number;
  /** "added" = kvittering for et tilføjet filter (02b.13): flueben i 24 px koral-lys cirkel og 1 px lodret skillelinje før handlingen. */
  variant?: "added";
}

export interface ToastEntry extends ToastOptions {
  id: number;
}

interface ToastApi {
  toasts: readonly ToastEntry[];
  show: (o: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const MAX_STACK = 3;
let seq = 0;

export function ToastProvider({ children, container = true, initial }: { children?: ReactNode; container?: boolean; initial?: readonly ToastOptions[] }) {
  const [toasts, setToasts] = useState<ToastEntry[]>(() => (initial ?? []).map((o) => ({ ...o, id: ++seq })));
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (o: ToastOptions) => {
      const id = ++seq;
      setToasts((list) => [...list, { ...o, id }].slice(-MAX_STACK));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), o.ttl ?? 5000),
      );
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const api = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      {container ? <Toasts /> : null}
    </ToastContext.Provider>
  );
}

/** Uden provider er `show` en no-op, der giver null, så kalderen kan falde tilbage til tekst. */
export function useToast(): { show: (o: ToastOptions) => number | null; dismiss: (id: number) => void; available: boolean } {
  const ctx = useContext(ToastContext);
  return useMemo(
    () => ({
      available: ctx !== null,
      show: (o: ToastOptions) => (ctx ? ctx.show(o) : null),
      dismiss: (id: number) => ctx?.dismiss(id),
    }),
    [ctx],
  );
}

/** Sand, når en ToastProvider står over komponenten (LassoView bruger den til at pakke sig selv ind). */
export function useHasToastProvider(): boolean {
  return useContext(ToastContext) !== null;
}

function ErrorIcon() {
  return <Icon name="alert" size={16} />;
}

/**
 * Højden på en synlig bundnavigation (AppShell på mobil, 26a), så beskederne står over den med
 * 12 px margen. Laget ligger i document.body og kan ikke se rammen, så den måles, når der er beskeder.
 */
function useBottomNavOffset(active: boolean): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const measure = () => {
      const nav = Array.from(document.querySelectorAll<HTMLElement>(".lasso-bottomnav")).find((el) => el.offsetParent !== null || getComputedStyle(el).position === "fixed");
      const r = nav?.getBoundingClientRect();
      setH(r && r.height > 0 ? Math.max(0, Math.round(window.innerHeight - r.top)) : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active]);
  return h;
}

/** Én besked. Eksporteret, så den kan tegnes statisk (tests, forhåndsvisning). */
export function ToastItem({ toast, onDismiss }: { toast: ToastEntry; onDismiss?: (id: number) => void }) {
  const tone = toast.tone ?? "ok";
  // Swipe ned lukker (26a: der er ingen hover på mobil). Beskeden følger fingeren nedad og
  // lukkes, når den er trukket mere end 40 px; ellers glider den tilbage.
  const start = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  const style: CSSProperties | undefined = dy > 0 ? { transform: `translateY(${dy}px)`, opacity: Math.max(0.3, 1 - dy / 120) } : undefined;
  return (
    <div
      className={["lasso-toast", `lasso-toast--${tone}`, toast.variant ? `lasso-toast--${toast.variant}` : "", dy > 0 ? "is-dragging" : ""].filter(Boolean).join(" ")}
      role={tone === "error" ? "alert" : undefined}
      style={style}
      onTouchStart={(e) => {
        start.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchMove={(e) => {
        if (start.current === null) return;
        setDy(Math.max(0, (e.touches[0]?.clientY ?? start.current) - start.current));
      }}
      onTouchEnd={() => {
        if (dy > 40) onDismiss?.(toast.id);
        start.current = null;
        setDy(0);
      }}
    >
      <span className="lasso-toast__icon">{tone === "error" ? <ErrorIcon /> : <CheckIcon />}</span>
      <span className="lasso-toast__text">{toast.text}</span>
      {toast.action ? (
        <button
          type="button"
          className="lasso-toast__action"
          onClick={() => {
            toast.action?.onClick();
            onDismiss?.(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      ) : null}
      <button type="button" className="lasso-toast__close" aria-label="Luk" onClick={() => onDismiss?.(toast.id)}>
        <CloseIcon size={14} />
      </button>
    </div>
  );
}

/** Stakken nederst i midten. Tegnes i laget; role=status + aria-live, så skærmlæsere hører beskeden. */
export function Toasts() {
  const ctx = useContext(ToastContext);
  const layer = useLayer();
  const toasts = ctx?.toasts ?? [];
  const offset = useBottomNavOffset(toasts.length > 0);
  return layer.render(
    <div className="lasso-toasts" role="status" aria-live="polite" style={offset ? ({ "--lasso-toast-offset": `${offset}px` } as CSSProperties) : undefined}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={ctx?.dismiss} />
      ))}
    </div>,
  );
}
