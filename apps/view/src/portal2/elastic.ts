import { useEffect, type RefObject } from "react";

/**
 * Bounce i rulleområdet i Chrome, Edge og Firefox på computer (Safari og alt på iPhone/iPad bouncer selv).
 *
 * Én elastik, ingen tilstande: hjul-hændelser ud over kanten strækker den (med stigende modstand), og hvert
 * billede trækker den lidt tilbage mod 0. Et langsomt træk holder den ude, et svirp der rammer kanten skubber
 * den ud i forhold til farten, og når hændelserne stopper, glider den på plads. Ruller man den anden vej,
 * mens den er strakt, tager elastikken rulningen, til den er på plads.
 *
 * Trackpaddens efterløb fortsætter med små hændelser længe efter et svirp; derfor bliver elastikken stivere,
 * jo længere en bevægelse har trykket på kanten (FADE_MS). En ny bevægelse (efter en pause) starter forfra.
 */

/** Asymptoten: længere end det kan elastikken ikke strækkes. */
export const MAX = 72;
/** Andel af rulningen, der bliver til stræk, når elastikken er slap. */
const GAIN = 1;
/** Største rulning pr. hændelse, så et musehjul ikke slår et stort hak. */
const STEP = 30;
/** Tidskonstant (ms) for vejen tilbage: efter ca. 5 × den er den på plads (ca. 0,3 s). */
const RETURN_MS = 55;
/** Tidskonstant (ms) for, hvor hurtigt elastikken bliver stiv under én bevægelse mod kanten. */
const FADE_MS = 150;
/** Så lang en pause (ms) mellem hændelser starter en ny bevægelse. */
const GESTURE_GAP_MS = 120;

/** Elastikken efter en rulning `dy` ud over kanten (+ = indholdet trukket ned, ved toppen). */
export function stretch(x: number, dy: number, pressedMs = 0): number {
  const room = 1 - Math.min(1, Math.abs(x) / MAX);
  return x - Math.max(-STEP, Math.min(STEP, dy)) * GAIN * room * Math.exp(-pressedMs / FADE_MS);
}

/** Elastikken efter `dt` ms uden input. */
export function relax(x: number, dt: number): number {
  const next = x * Math.exp(-dt / RETURN_MS);
  return Math.abs(next) < 0.2 ? 0 : next;
}

/** Om browseren selv bouncer rulleområder (WebKit). */
export function hasNativeBounce(nav: Pick<Navigator, "vendor"> | undefined = typeof navigator === "undefined" ? undefined : navigator): boolean {
  return Boolean(nav?.vendor && /apple/i.test(nav.vendor));
}

export function useElasticScroll(scroller: RefObject<HTMLElement | null>, content: RefObject<HTMLElement | null>, enabled = !hasNativeBounce()) {
  useEffect(() => {
    const sc = scroller.current;
    if (!enabled || !sc) return;
    let x = 0;
    let raf = 0;
    let last = 0;
    let lastEvent = -Infinity;
    let pressedFrom = 0;

    const paint = () => {
      const el = content.current;
      if (el) el.style.transform = x ? `translate3d(0,${x.toFixed(2)}px,0)` : "";
    };
    const frame = (t: number) => {
      x = relax(x, last ? Math.min(50, t - last) : 16);
      last = t;
      paint();
      raf = x ? requestAnimationFrame(frame) : 0;
      if (!raf) last = 0;
    };

    const onWheel = (e: WheelEvent) => {
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (e.timeStamp - lastEvent > GESTURE_GAP_MS) pressedFrom = e.timeStamp;
      lastEvent = e.timeStamp;
      if ((x > 0 && dy > 0) || (x < 0 && dy < 0)) {
        // Strakt og rullet tilbage: elastikken tager rulningen først.
        e.preventDefault();
        x = Math.sign(x) * Math.max(0, Math.abs(x) - Math.abs(dy));
      } else if ((dy < 0 && sc.scrollTop <= 0) || (dy > 0 && sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1)) {
        x = stretch(x, dy, e.timeStamp - pressedFrom);
      } else {
        pressedFrom = e.timeStamp; // ruller frit: tiden mod kanten tælles først fra kanten
        return;
      }
      paint();
      if (!raf) raf = requestAnimationFrame(frame);
    };

    sc.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      sc.removeEventListener("wheel", onWheel);
      x = 0;
      paint();
    };
  }, [scroller, content, enabled]);
}
