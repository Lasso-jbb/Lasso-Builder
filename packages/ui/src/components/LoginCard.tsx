import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { LassoWordmark } from "../LassoMark.js";

/**
 * Portalens login (docs/portal.md): centreret kort på hvid flade med én tynd ramme (regel 3 og 12:
 * aldrig kort på grå). Dæmpet navnelogo, overskrift, bruger-id og adgangsnøgle, primær knap i koral,
 * fejltekst under knappen og en hjælpelinje. Enter sender (almindelig formular).
 *
 * Kender ikke API'et: værten får bruger og nøgle i onSubmit og sætter selv `error` og `busy`.
 * `notice` er en neutral besked øverst, fx "Du er logget ud. Log ind igen." (ren tekst, ingen boks).
 */
export interface LoginCardProps {
  onSubmit: (user: string, key: string) => void;
  /** Fejl fra serveren, fx "Forkert bruger eller adgangsnøgle." */
  error?: string | null;
  /** Neutral besked over felterne, fx efter en udløbet session. */
  notice?: string | null;
  /** Mens login står på: knappen er slået fra. */
  busy?: boolean;
  defaultUser?: string;
  className?: string;
}

export const LOGIN_HELP = "Brug samme nøgle som i din Lasso-connector.";
const MISSING = "Udfyld bruger-id og adgangsnøgle.";

export function LoginCard({ onSubmit, error, notice, busy = false, defaultUser = "", className = "" }: LoginCardProps) {
  const id = useId();
  const [user, setUser] = useState(defaultUser);
  const [key, setKey] = useState("");
  const [missing, setMissing] = useState(false);
  const userRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    userRef.current?.focus();
  }, []);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    if (!user.trim() || !key) {
      setMissing(true);
      return;
    }
    setMissing(false);
    onSubmit(user.trim(), key);
  };

  const shown = missing ? MISSING : (error ?? null);
  const errorId = `${id}-error`;
  return (
    <div className={`lasso-login ${className}`}>
      <form className="lasso-login__card" onSubmit={submit} noValidate aria-labelledby={`${id}-title`} aria-busy={busy || undefined}>
        <LassoWordmark className="lasso-login__wordmark" />
        <h1 id={`${id}-title`} className="lasso-login__title">
          Log ind i Lasso
        </h1>
        {notice ? (
          <p className="lasso-login__notice" role="status">
            {notice}
          </p>
        ) : null}
        <div className="lasso-login__fields">
          <div className="lasso-field">
            <label htmlFor={`${id}-user`}>Bruger-id</label>
            <input
              ref={userRef}
              id={`${id}-user`}
              name="user"
              type="text"
              className={shown ? "lasso-input lasso-input--invalid" : "lasso-input"}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={user}
              aria-invalid={shown ? true : undefined}
              aria-describedby={shown ? errorId : undefined}
              onChange={(e) => setUser(e.target.value)}
            />
          </div>
          <div className="lasso-field">
            <label htmlFor={`${id}-key`}>Adgangsnøgle</label>
            <input
              id={`${id}-key`}
              name="key"
              type="password"
              className={shown ? "lasso-input lasso-input--invalid" : "lasso-input"}
              autoComplete="current-password"
              value={key}
              aria-invalid={shown ? true : undefined}
              aria-describedby={shown ? errorId : undefined}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>
        </div>
        <div className="lasso-login__actions">
          <button type="submit" className="lasso-btn lasso-btn--primary lasso-login__submit" disabled={busy}>
            Log ind
          </button>
          {shown ? (
            <p id={errorId} className="lasso-field__error lasso-login__error" role="alert">
              {shown}
            </p>
          ) : null}
        </div>
        <p className="lasso-login__help">{LOGIN_HELP}</p>
      </form>
    </div>
  );
}
