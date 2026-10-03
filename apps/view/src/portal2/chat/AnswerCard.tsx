import { useMemo } from "react";
import { CardActions, LassoView, type HostCapabilities, type LassoViewProps } from "@lasso/ui";
import { forPortal } from "../model.js";
import type { ViewAnswerPart } from "../thread.js";

const noop = () => undefined;

export type ViewPart = ViewAnswerPart;

export interface AnswerCardProps {
  part: ViewPart;
  /** "element" = ét element (download + fuld skærm), "page" = en side (desuden "Tilføj som fane"). Standard: efter part.form. */
  kind?: "element" | "page";
  mobile?: boolean;
  theme?: "light" | "dark";
  /** Visningens egne handlinger (filtre, åbn firma …) og det, værten kan. */
  host?: HostCapabilities;
  onAction?: LassoViewProps["onAction"];
  onDownload?: () => void;
  onFullscreen?: () => void;
  /** Kun en side om fanens egen entitet: gem som modul på alle firmaer/personer. */
  onAddTab?: () => void;
  /** Mens skabelonen gemmes. */
  adding?: boolean;
  /** På en firma- eller personfane: visningens eget hoved udelades (navnet står i fanen), som i modulerne. */
  headless?: boolean;
}

/**
 * Et kort i samtalen (et element eller en side): titel og undertitel til venstre, handlingerne til højre (download,
 * fuld skærm og på en side den primære "Tilføj som fane"), og visningen uden ramme nedenunder. På mobil kun fuld
 * skærm, og "Tilføj som fane" som et orange ikon. Modul-links og handlinger står i teksten, aldrig i kortets ramme.
 */
export function AnswerCard({ part, kind, mobile = false, theme, host, onAction, onDownload, onFullscreen, onAddTab, adding = false, headless = false }: AnswerCardProps) {
  const page = (kind ?? (part.form === "page" ? "page" : "element")) === "page";
  const { spec } = part;
  const view = useMemo(() => forPortal(spec, { head: !headless }), [spec, headless]);
  return (
    <section className={`chat-card${mobile ? " chat-card--m" : ""}`} aria-label={spec.title}>
      <header className="chat-card__h">
        <div className="chat-card__ht">
          <div className="chat-card__t">{spec.title}</div>
          {spec.subtitle ? <div className="chat-card__s">{spec.subtitle}</div> : null}
        </div>
        <div className="chat-card__a">
          {/* Samme handlinger som MCP-appens (CardActions, Jakob 03.10): download, fuld skærm og "Tilføj som fane" som pille
              med knappens skrift (14/18, 500); på mobil en ikonknap med koralikonet. */}
          <CardActions
            compact={mobile}
            onDownload={onDownload}
            onFullscreen={onFullscreen}
            primary={page && onAddTab ? { label: "Tilføj som fane", icon: "bookmark-plus", onClick: onAddTab, busy: adding } : undefined}
          />
        </div>
      </header>
      <div className="chat-card__b">
        <LassoView spec={view} dataset={part.dataset} theme={theme} frameless page={page} host={host ?? {}} onAction={onAction ?? noop} />
      </div>
    </section>
  );
}
