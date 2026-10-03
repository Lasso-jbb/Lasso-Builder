import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";
import { pickFormat, type ComponentType, type LayoutFormat } from "@lasso/spec";

/**
 * Godkendte former pr. modul (packages/spec/src/layoutFormats.ts). Uden udbyder gælder kodens liste
 * (APPROVED_FORMATS); designguiden lægger sine egne godkendelser ind her, så man ser virkningen med det samme.
 */
const ApprovedFormatsContext = createContext<Partial<Record<string, readonly string[]>> | undefined>(undefined);

export function ApprovedFormatsProvider({ value, children }: { value: Partial<Record<string, readonly string[]>> | undefined; children: ReactNode }) {
  return <ApprovedFormatsContext.Provider value={value}>{children}</ApprovedFormatsContext.Provider>;
}

/**
 * Modulets form ud fra dets egen målte bredde. Returnerer ref-funktionen til modulets yderste element og
 * formen; før første måling (og uden ResizeObserver, fx i tests) er det den største godkendte form.
 */
export function useLayoutFormat(type: ComponentType, count: number): [(el: HTMLElement | null) => void, LayoutFormat | undefined] {
  const approved = useContext(ApprovedFormatsContext)?.[type];
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState<number>(Number.POSITIVE_INFINITY);
  useLayoutEffect(() => {
    if (!el || typeof ResizeObserver === "undefined") return;
    const read = () => {
      // offsetWidth er layoutbredden; en skalering (transform) på en forfader ændrer den ikke.
      const w = el.offsetWidth;
      if (w > 0) setWidth((prev) => (prev === w ? prev : w));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, pickFormat(type, width, count, approved)];
}
