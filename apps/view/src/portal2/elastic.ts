import { useEffect, type RefObject } from "react";

/**
 * Bounce i rulleområdet i de browsere, der ikke selv gør det (Jakob 02.10). Safari og alle browsere på iPhone/iPad
 * (WebKit, navigator.vendor "Apple …") bouncer et rulleområde af sig selv; Chrome og Edge på computer gør kun
 * det for hele siden, som portalen holder låst. Her: når man ruller ud over toppen eller bunden (trackpad,
 * hjul eller finger), trækkes indholdet med med stigende modstand og fjedrer tilbage, når man slipper.
 */

/** Hvor langt indholdet flyttes ved `pull` px træk: stigende modstand, højst `max` px. */
export function rubber(pull: number, max = 90, softness = 260): number {
  const sign = Math.sign(pull);
  return sign * max * (1 - Math.exp(-Math.abs(pull) / softness));
}

/** Om browseren selv bouncer rulleområder (WebKit). */
export function hasNativeBounce(nav: Pick<Navigator, "vendor"> | undefined = typeof navigator === "undefined" ? undefined : navigator): boolean {
  return Boolean(nav?.vendor && /apple/i.test(nav.vendor));
}

const RELEASE = "transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1)";
/** Så længe efter sidste hjul-/trackpadhændelse regnes trækket som sluppet. */
const IDLE_MS = 110;

export function useElasticScroll(scroller: RefObject<HTMLElement | null>, content: RefObject<HTMLElement | null>, enabled = !hasNativeBounce()) {
  useEffect(() => {
    const sc = scroller.current;
    if (!enabled || !sc) return;
    let pull = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let touchY: number | null = null;
    let touchPull = 0;

    const atTop = () => sc.scrollTop <= 0;
    const atBottom = () => sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
    const apply = (px: number, animate: boolean) => {
      const el = content.current;
      if (!el) return;
      el.style.transition = animate ? RELEASE : "none";
      el.style.transform = px ? `translate3d(0, ${px}px, 0)` : "";
    };
    const release = () => {
      pull = 0;
      touchPull = 0;
      apply(0, true);
    };

    const onWheel = (e: WheelEvent) => {
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const overTop = atTop() && (dy < 0 || pull > 0);
      const overBottom = atBottom() && (dy > 0 || pull < 0);
      if (!overTop && !overBottom) {
        if (pull) release();
        return;
      }
      pull -= dy;
      // Trækket kan ikke skifte side (fra top til bund) i én bevægelse.
      if (overTop && pull < 0) pull = 0;
      if (overBottom && !overTop && pull > 0) pull = 0;
      apply(rubber(pull), false);
      clearTimeout(timer);
      timer = setTimeout(release, IDLE_MS);
    };

    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
      touchPull = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (touchY === null || y === undefined) return;
      const dy = y - touchY;
      touchY = y;
      if ((atTop() && (dy > 0 || touchPull > 0)) || (atBottom() && (dy < 0 || touchPull < 0))) {
        touchPull += dy;
        apply(rubber(touchPull), false);
      }
    };
    const onTouchEnd = () => {
      touchY = null;
      if (touchPull) release();
    };

    sc.addEventListener("wheel", onWheel, { passive: true });
    sc.addEventListener("touchstart", onTouchStart, { passive: true });
    sc.addEventListener("touchmove", onTouchMove, { passive: true });
    sc.addEventListener("touchend", onTouchEnd, { passive: true });
    sc.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      clearTimeout(timer);
      sc.removeEventListener("wheel", onWheel);
      sc.removeEventListener("touchstart", onTouchStart);
      sc.removeEventListener("touchmove", onTouchMove);
      sc.removeEventListener("touchend", onTouchEnd);
      sc.removeEventListener("touchcancel", onTouchEnd);
      apply(0, false);
    };
  }, [scroller, content, enabled]);
}
