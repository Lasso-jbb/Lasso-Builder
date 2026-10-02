import { useEffect, type RefObject } from "react";

/**
 * Bounce i rulleområdet i de browsere, der ikke selv gør det (Jakob 02.10). Safari og alle browsere på iPhone/iPad
 * (WebKit, navigator.vendor "Apple …") bouncer et rulleområde af sig selv; Chrome og Edge på computer gør kun
 * det for hele siden, som portalen holder låst. Her efterlignes macOS med en lille fjedermodel:
 *
 *  - Træk (fingeren på trackpad eller skærm) ud over toppen eller bunden: indholdet følger med stigende modstand.
 *  - Rammer man kanten under et svirp (efterløb): indholdet skyder over i forhold til farten og fjedrer tilbage.
 *  - Slip: en kritisk dæmpet fjeder trækker indholdet tilbage (blødt, uden at svinge).
 */

/** Hvor langt indholdet flyttes ved `pull` px træk: stigende modstand, højst `max` px. */
export function rubber(pull: number, max = 56, softness = 140): number {
  const sign = Math.sign(pull);
  return sign * max * (1 - Math.exp(-Math.abs(pull) / softness));
}

/** Om browseren selv bouncer rulleområder (WebKit). */
export function hasNativeBounce(nav: Pick<Navigator, "vendor"> | undefined = typeof navigator === "undefined" ? undefined : navigator): boolean {
  return Boolean(nav?.vendor && /apple/i.test(nav.vendor));
}

/** Fjederen: stivhed og dæmpning (kritisk dæmpet: dæmpning = 2·√stivhed). */
export const SPRING = { stiffness: 180, damping: 2 * Math.sqrt(180) };
/** Højst så langt, et svirp kan skyde indholdet over kanten. */
const MAX_OVERSHOOT = 64;
/** Fart (px/s), en efterløbshændelse ved kanten giver pr. px rullet (hændelserne kommer ca. 60 gange i sekundet). */
const IMPULSE = 60;
/** Højeste fart fra et svirp: så skyder fjederen netop MAX_OVERSHOOT over (toppunkt = v / (e·√stivhed)). */
const MAX_V = MAX_OVERSHOOT * Math.E * Math.sqrt(SPRING.stiffness);
/** Så længe efter sidste træk-hændelse regnes fingeren som løftet. */
const IDLE_MS = 60;
/** Efter et træk eller skub: efterløbet ignoreres, til der har været ro så længe. */
const QUIET_MS = 140;

/** Ét fjedertrin: ny position og fart efter dt sekunder. */
export function springStep(x: number, v: number, dt: number, s = SPRING): [number, number] {
  const a = -s.stiffness * x - s.damping * v;
  const nv = v + a * dt;
  return [x + nv * dt, nv];
}

export function useElasticScroll(scroller: RefObject<HTMLElement | null>, content: RefObject<HTMLElement | null>, enabled = !hasNativeBounce()) {
  useEffect(() => {
    const sc = scroller.current;
    if (!enabled || !sc) return;

    let x = 0; // forskydning i px (+ = trukket ned i toppen, − = trukket op i bunden)
    let v = 0; // fart i px/s
    let pull = 0; // samlet træk, mens fingeren er på
    let dragging = false;
    let raf = 0;
    let last = 0;
    let idle: ReturnType<typeof setTimeout> | undefined;
    let quiet: ReturnType<typeof setTimeout> | undefined;
    let settling = false;
    let lastAbs = 0;
    let fading = 0;
    let wasAtEdge = false;
    let touchY: number | null = null;

    const atTop = () => sc.scrollTop <= 0;
    const atBottom = () => sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
    const apply = () => {
      const el = content.current;
      if (!el) return;
      el.style.transition = "none";
      el.style.transform = Math.abs(x) < 0.25 ? "" : `translate3d(0, ${x.toFixed(2)}px, 0)`;
    };
    const tick = (t: number) => {
      const dt = Math.min(0.032, last ? (t - last) / 1000 : 0.016);
      last = t;
      if (!dragging) [x, v] = springStep(x, v, dt);
      x = Math.max(-MAX_OVERSHOOT, Math.min(MAX_OVERSHOOT, x));
      apply();
      if (!dragging && Math.abs(x) < 0.25 && Math.abs(v) < 4) {
        x = 0;
        v = 0;
        apply();
        raf = 0;
        last = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    const run = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const calm = () => {
      settling = true;
      clearTimeout(quiet);
      quiet = setTimeout(() => {
        settling = false;
        lastAbs = 0;
        fading = 0;
      }, QUIET_MS);
    };
    const letGo = () => {
      if (!dragging) return;
      dragging = false;
      pull = 0;
      v = 0;
      calm();
      run();
    };

    const onWheel = (e: WheelEvent) => {
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const edgeTop = atTop() && dy < 0;
      const edgeBottom = atBottom() && dy > 0;
      const abs = Math.abs(dy);
      fading = abs < lastAbs * 0.95 ? fading + 1 : 0;
      lastAbs = abs;
      const impact = !wasAtEdge && (edgeTop || edgeBottom);
      wasAtEdge = edgeTop || edgeBottom;
      if (!edgeTop && !edgeBottom) {
        if (dragging) letGo();
        return;
      }
      if (settling && !dragging) {
        calm();
        return;
      }
      // Efterløb (aftagende hændelser), der rammer kanten: et skub, som fjederen tager imod.
      if (!dragging && (impact ? fading >= 1 : fading >= 2)) {
        v = Math.max(-MAX_V, Math.min(MAX_V, v - dy * IMPULSE));
        calm();
        run();
        return;
      }
      // Fingeren trækker: indholdet følger med stigende modstand (fortsætter fra den aktuelle forskydning).
      if (!dragging) {
        dragging = true;
        const r = Math.min(0.95, Math.abs(x) / 56);
        pull = x ? Math.sign(x) * -140 * Math.log(1 - r) : 0;
      }
      pull -= dy;
      if (edgeTop && pull < 0) pull = 0;
      if (edgeBottom && pull > 0) pull = 0;
      x = rubber(pull);
      v = 0;
      run();
      clearTimeout(idle);
      idle = setTimeout(letGo, IDLE_MS);
    };

    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (touchY === null || y === undefined) return;
      const dy = y - touchY;
      touchY = y;
      if ((atTop() && (dy > 0 || pull > 0)) || (atBottom() && (dy < 0 || pull < 0))) {
        dragging = true;
        pull += dy;
        x = rubber(pull);
        v = 0;
        run();
      }
    };
    const onTouchEnd = () => {
      touchY = null;
      if (dragging) {
        dragging = false;
        pull = 0;
        run();
      }
    };

    sc.addEventListener("wheel", onWheel, { passive: true });
    sc.addEventListener("touchstart", onTouchStart, { passive: true });
    sc.addEventListener("touchmove", onTouchMove, { passive: true });
    sc.addEventListener("touchend", onTouchEnd, { passive: true });
    sc.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      clearTimeout(quiet);
      sc.removeEventListener("wheel", onWheel);
      sc.removeEventListener("touchstart", onTouchStart);
      sc.removeEventListener("touchmove", onTouchMove);
      sc.removeEventListener("touchend", onTouchEnd);
      sc.removeEventListener("touchcancel", onTouchEnd);
      x = 0;
      apply();
    };
  }, [scroller, content, enabled]);
}
