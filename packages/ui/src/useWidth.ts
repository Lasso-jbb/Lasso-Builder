import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Måler et elements bredde, så SVG'er tegnes i faktisk størrelse (skarp tekst
 * på alle bredder). Callback-ref, så målingen også starter, når elementet
 * først dukker op efter en indlæsning.
 */
export function useWidth<T extends HTMLElement>(fallback = 560) {
  const [width, setWidth] = useState(fallback);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    const update = () => setWidth(Math.max(200, Math.round(el.clientWidth)));
    update();
    if (typeof ResizeObserver !== "undefined") {
      observer.current = new ResizeObserver(update);
      observer.current.observe(el);
    }
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);
  return [ref, width] as const;
}
