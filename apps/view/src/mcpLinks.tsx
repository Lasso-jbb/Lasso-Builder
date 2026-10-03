import { useEffect, useRef, useState } from "react";
import { Button, LassoMark } from "@lasso/ui";

/**
 * Links på en visning i MCP-appen (Claude.ai's iframe), fra værktøjsresultatets structuredContent.links
 * (serveren, wp1-mcp-links): `open` åbner den samme virksomhed eller person i Lasso-portalen og fastgør fanen
 * (kun visninger om én entitet), `share` er det signerede direkte link til visningen. Kun MCP-appen viser dem;
 * portalen og /v har deres egne (portalens faner; /v er selv det delte link).
 */
export interface ViewLinks {
  open?: string;
  share: string;
}

/** Læser links fra structuredContent; null, når der ikke er et gyldigt share-link (fx en ældre server). */
export function linksOf(sc: unknown): ViewLinks | null {
  const l = (sc as { links?: { open?: unknown; share?: unknown } } | undefined)?.links;
  if (!l || typeof l.share !== "string" || !/^https?:\/\//.test(l.share)) return null;
  return { share: l.share, ...(typeof l.open === "string" && /^https?:\/\//.test(l.open) ? { open: l.open } : {}) };
}

/** Øverst: "Åben i Lasso" (sekundær knap med Lasso-mærket). Står kun, når der er et open-link. */
export function OpenInLasso({ href, onOpen }: { href?: string; onOpen: (url: string) => void }) {
  if (!href) return null;
  return (
    <div className="lasso-mcplinks lasso-mcplinks--top">
      <Button variant="secondary" size={36} className="lasso-mcplinks__open" onClick={() => onOpen(href)}>
        <LassoMark className="lasso-mcplinks__mark" />
        Åben i Lasso
      </Button>
    </div>
  );
}

/**
 * Nederst: "Del visning" med linket som tekst og "Kopiér link" (bekræftet med "Kopieret"). Kan værten ikke
 * kopiere, markeres linket, så brugeren selv kan kopiere det.
 */
export function ShareView({ href, onCopy }: { href?: string; onCopy: (url: string) => Promise<boolean> }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const field = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!href) return null;
  const copy = async () => {
    const ok = await onCopy(href).catch(() => false);
    clearTimeout(timer.current);
    if (ok) {
      setState("copied");
      timer.current = setTimeout(() => setState("idle"), 2000);
    } else {
      setState("manual");
      field.current?.focus();
      field.current?.select();
    }
  };
  return (
    <div className="lasso-mcplinks lasso-mcplinks--bottom" role="group" aria-label="Del visning">
      <span className="lasso-mcplinks__label">Del visning</span>
      <input ref={field} className="lasso-mcplinks__url" readOnly value={href} aria-label="Link til visningen" onFocus={(e) => e.currentTarget.select()} />
      <Button variant="secondary" size={32} icon={state === "copied" ? "check" : "copy"} onClick={() => void copy()}>
        {state === "copied" ? "Kopieret" : "Kopiér link"}
      </Button>
      <span className="lasso-mcplinks__status" role="status">
        {state === "manual" ? "Kopiering er ikke tilladt her. Linket er markeret, så du kan kopiere det." : ""}
      </span>
    </div>
  );
}
