import { useEffect, useRef } from "react";
import { IconButton, LassoView, type HostCapabilities, type LassoViewProps } from "@lasso/ui";
import type { ViewPart } from "./AnswerCard.js";
import { hhmm } from "./util.js";

const noop = () => undefined;

/**
 * Fuld skærm: elementet i hele fladen under modulrækken med titel (18/26/500), undertitel ("…, fra samtalen kl.
 * 09:41"), download og ×. Inputfeltet bliver stående. På mobil kun ×. Dialog: fokus på ×, Esc lukker, og fokus
 * vender tilbage til knappen, der åbnede den.
 */
export function Fullscreen({
  part,
  at,
  mobile = false,
  theme,
  host,
  onAction,
  onDownload,
  onClose,
}: {
  part: ViewPart;
  /** Hvornår svaret kom (undertitlens "fra samtalen kl. …"). */
  at?: number;
  mobile?: boolean;
  theme?: "light" | "dark";
  host?: HostCapabilities;
  onAction?: LassoViewProps["onAction"];
  onDownload?: () => void;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLButtonElement>("[data-fs-close] button, button[data-fs-close]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const { spec } = part;
  const sub = [spec.subtitle, at && !mobile ? `fra samtalen kl. ${hhmm(at)}` : ""].filter(Boolean).join(", ");
  return (
    <div className={`chat-fs${mobile ? " chat-fs--m" : ""}`} ref={root} role="dialog" aria-modal="false" aria-labelledby="chat-fs-title">
      <div className="chat-fs__h">
        <div className="chat-fs__ht">
          <div className="chat-fs__t" id="chat-fs-title">
            {spec.title}
          </div>
          {sub ? <div className="chat-fs__s">{sub}</div> : null}
        </div>
        <div className="chat-card__a">
          {!mobile && onDownload ? <IconButton icon="download" label="Hent som PDF" size={32} onClick={onDownload} /> : null}
          <span data-fs-close="" style={{ display: "contents" }}>
            <IconButton icon="close" label="Luk fuld skærm" size={32} onClick={onClose} />
          </span>
        </div>
      </div>
      <div className="chat-fs__b">
        <LassoView spec={spec} dataset={part.dataset} theme={theme} frameless page={part.form === "page"} host={host ?? {}} onAction={onAction ?? noop} />
      </div>
    </div>
  );
}
