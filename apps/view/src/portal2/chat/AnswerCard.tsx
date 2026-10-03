import { Button, IconButton, LassoView, type HostCapabilities, type LassoViewProps } from "@lasso/ui";
import type { AnswerPart } from "../model.js";

const noop = () => undefined;

export type ViewPart = Extract<AnswerPart, { kind: "view" }>;

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
}

/**
 * Et kort i samtalen (et element eller en side): titel og undertitel til venstre, handlingerne til højre (download,
 * fuld skærm og på en side den primære "Tilføj som fane"), og visningen uden ramme nedenunder. På mobil kun fuld
 * skærm, og "Tilføj som fane" som et orange ikon. Modul-links og handlinger står i teksten, aldrig i kortets ramme.
 */
export function AnswerCard({ part, kind, mobile = false, theme, host, onAction, onDownload, onFullscreen, onAddTab, adding = false }: AnswerCardProps) {
  const page = (kind ?? (part.form === "page" ? "page" : "element")) === "page";
  const { spec } = part;
  return (
    <section className={`chat-card${mobile ? " chat-card--m" : ""}`} aria-label={spec.title}>
      <header className="chat-card__h">
        <div className="chat-card__ht">
          <div className="chat-card__t">{spec.title}</div>
          {spec.subtitle ? <div className="chat-card__s">{spec.subtitle}</div> : null}
        </div>
        <div className="chat-card__a">
          {page && onAddTab && mobile ? <IconButton icon="bookmark-plus" label="Tilføj som fane" size={32} variant="primary" disabled={adding} onClick={onAddTab} /> : null}
          {!mobile && onDownload ? <IconButton icon="download" label="Hent som PDF" size={32} onClick={onDownload} /> : null}
          {onFullscreen ? <IconButton icon="fullscreen" label="Vis i fuld skærm" size={32} onClick={onFullscreen} /> : null}
          {page && onAddTab && !mobile ? (
            <Button variant="primary" size={36} icon="bookmark-plus" loading={adding} onClick={onAddTab}>
              Tilføj som fane
            </Button>
          ) : null}
        </div>
      </header>
      <div className="chat-card__b">
        <LassoView spec={spec} dataset={part.dataset} theme={theme} frameless page={page} host={host ?? {}} onAction={onAction ?? noop} />
      </div>
    </section>
  );
}
