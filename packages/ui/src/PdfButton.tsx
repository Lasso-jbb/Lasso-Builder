import { useState } from "react";
import { ShellIcon } from "./components/ShellIcons.js";
import type { ToastOptions } from "./components/Toast.js";
import type { ActionResult, LassoViewProps } from "./types.js";

export const PDF_LABEL = "Gem som PDF";
export const PDF_BUSY_LABEL = "Laver PDF …";

/**
 * Kører "Gem som PDF": beder værten om PDF'en (`{ kind: "pdf" }`) og siger, hvordan det gik. En
 * fejl får "Prøv igen"; en besked fra værten (fx "PDF'en er hentet") vises som bekræftelse.
 */
export async function runPdf(onAction: LassoViewProps["onAction"], notify: (o: ToastOptions) => void, retry: () => void): Promise<void> {
  let res: ActionResult | void;
  try {
    res = await onAction({ kind: "pdf" });
  } catch (e) {
    res = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (res && !res.ok) {
    notify({ text: res.error, tone: "error", action: { label: "Prøv igen", onClick: retry } });
    return;
  }
  if (res?.message) notify({ text: res.message, tone: "ok" });
}

/**
 * "Gem som PDF" øverst til højre i hovedet ved siden af Gem/Gemt (samme lille ikonknap, katalog 01,
 * regel 21): download-ikon og ord, kun ikonet under 640 px (aria-label bærer ordet). Mens værten
 * laver filen, står der "Laver PDF …", og knappen kan ikke trykkes igen.
 */
export function PdfButton({ onAction, notify }: { onAction: LassoViewProps["onAction"]; notify: (o: ToastOptions) => void }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await runPdf(onAction, notify, () => void run());
    } finally {
      setBusy(false);
    }
  };
  const label = busy ? PDF_BUSY_LABEL : PDF_LABEL;
  return (
    <button
      type="button"
      className="lasso-iconbtn lasso-frame__pdf"
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={busy}
      title="Gem siden som PDF-fil"
      onClick={() => {
        if (!busy) void run();
      }}
    >
      <ShellIcon name="download" size={16} />
      <span className="lasso-frame__pdf-label">{label}</span>
    </button>
  );
}
