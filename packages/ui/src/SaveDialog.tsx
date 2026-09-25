import { useState, type KeyboardEvent } from "react";
import type { ActionResult, ViewAction, Visibility } from "./types.js";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function SaveDialog({
  defaultName,
  prefix,
  onAction,
  onClose,
}: {
  defaultName: string;
  prefix: string;
  onAction: (a: ViewAction) => Promise<ActionResult | void> | void;
  onClose: (result?: { url: string }) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>("org");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const nameError = name.trim().length === 0 ? "Giv visningen et navn." : null;
  const slugError = effectiveSlug && !SLUG.test(effectiveSlug) ? "Kun a-z, 0-9 og bindestreg." : null;

  // Ingen <form>-submit: MCP-værter sandboxer iframen uden allow-forms.
  const submit = async () => {
    if (nameError || slugError || busy) return;
    setBusy(true);
    setError(null);
    const res = await onAction({ kind: "save", name: name.trim(), slug: effectiveSlug || undefined, visibility });
    setBusy(false);
    if (res && !res.ok) return setError(res.error);
    onClose(res && res.ok && res.url ? { url: res.url } : undefined);
  };

  return (
    <div className="lasso-save" role="dialog" aria-label="Gem visning" onKeyDown={(e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") void submit();
      if (e.key === "Escape") onClose();
    }}>
      <div className="lasso-field">
        <label htmlFor="lasso-save-name">Navn</label>
        <input id="lasso-save-name" className={`lasso-input ${nameError ? "lasso-input--invalid" : ""}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
        {nameError ? <div className="lasso-field__error">{nameError}</div> : null}
      </div>
      <div className="lasso-field">
        <label htmlFor="lasso-save-slug">Adresse</label>
        <div className="lasso-slug">
          <span>{prefix}</span>
          <input
            id="lasso-save-slug"
            className={`lasso-input ${slugError ? "lasso-input--invalid" : ""}`}
            value={effectiveSlug}
            placeholder="tilfældig"
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
          />
        </div>
        {slugError ? <div className="lasso-field__error">{slugError}</div> : <div className="lasso-field__hint">Gemmer du igen på samme adresse, opdateres den. Tidligere versioner bevares.</div>}
      </div>
      <div className="lasso-field">
        <label htmlFor="lasso-save-vis">Hvem kan se den</label>
        <select id="lasso-save-vis" className="lasso-select" value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
          <option value="private">Kun mig</option>
          <option value="org">Min organisation</option>
          <option value="link">Alle med linket</option>
        </select>
      </div>
      {error ? <div className="lasso-field__error" role="alert">{error}</div> : null}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="lasso-btn lasso-btn--ghost" onClick={() => onClose()}>
          Annullér
        </button>
        <button type="button" className="lasso-btn lasso-btn--primary" onClick={() => void submit()} disabled={busy || Boolean(nameError || slugError)}>
          {busy ? "Gemmer…" : "Gem og få link"}
        </button>
      </div>
    </div>
  );
}
