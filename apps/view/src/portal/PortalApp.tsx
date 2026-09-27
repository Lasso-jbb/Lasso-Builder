import { useEffect, useMemo, useRef, useState } from "react";
import { LoginCard } from "@lasso/ui";
import type { PortalBoot, PortalUser } from "../boot.js";
import { createPortalApi, errorText, LOGGED_OUT } from "./api.js";
import { PortalShell } from "./PortalShell.js";
import "./portal.css";

/** Lokalt uden nøgler (loginRequired false) er portalen åben som demobrugeren, ligesom /mcp. */
const DEMO_USER: PortalUser = { id: "demo", name: "Demobruger", org: "demo", isDemo: true };

/**
 * Portalen (docs/portal.md): login-siden uden bruger, ellers rammen (AppShell) med faner.
 * Et 401 midt i sessionen sender tilbage til login med "Du er logget ud. Log ind igen.";
 * fanerne bevares, så brugeren står samme sted efter login.
 */
export function PortalApp({ boot }: { boot: PortalBoot }) {
  const fallback = boot.loginRequired ? null : (boot.user ?? DEMO_USER);
  const [user, setUser] = useState<PortalUser | null>(boot.user ?? fallback);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loginRequired = useRef(boot.loginRequired);

  // Portalen er lys (skinnens chrome-grå findes kun i lyst tema); browserens egne felter følger med.
  useEffect(() => {
    document.documentElement.style.colorScheme = "light";
    document.body.style.background = "#ffffff";
  }, []);

  const api = useMemo(
    () =>
      createPortalApi(() => {
        if (!loginRequired.current) return;
        setUser(null);
        setError(null);
        setNotice(LOGGED_OUT);
      }),
    [],
  );

  useEffect(() => {
    if (!user) document.title = "Lasso, Log ind";
  }, [user]);

  if (!user) {
    const login = async (id: string, key: string) => {
      setBusy(true);
      setError(null);
      try {
        const r = await api.login(id, key);
        setNotice(null);
        setUser(r.user);
      } catch (e) {
        setError(errorText(e) || "Forkert bruger eller adgangsnøgle.");
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="lasso-root lasso-portal lasso-portal--login" data-theme="light">
        <LoginCard onSubmit={(id, key) => void login(id, key)} error={error} notice={notice} busy={busy} />
      </div>
    );
  }

  return (
    <PortalShell
      user={user}
      api={api}
      baseUrl={boot.baseUrl}
      canLogout={boot.loginRequired}
      onLoggedOut={() => {
        setError(null);
        setNotice(null);
        setUser(fallback);
      }}
    />
  );
}
