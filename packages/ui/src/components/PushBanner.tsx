import { LassoMark } from "../LassoMark.js";

export interface PushBannerProps {
  /** Hændelsen, fx "Nyt regnskab" eller "Konkursdekret afsagt". */
  event: string;
  /** Virksomheden, fx "LASSO X A/S". */
  company: string;
  /** Ét tal, fx "bruttofortjeneste +7,5 %". Udelades, når hændelsen ikke har et. */
  figure?: string;
  /** Relativ tid i systemets stil, fx "nu" eller "for 5 min." */
  time?: string;
  /** Appens navn i banneret. */
  app?: string;
}

/** "Nyt regnskab: LASSO X A/S, bruttofortjeneste +7,5 %": virksomhed + hændelse + ét tal. */
export function pushText({ event, company, figure }: Pick<PushBannerProps, "event" | "company" | "figure">): string {
  return `${event}: ${company}${figure ? `, ${figure}` : ""}`;
}

/**
 * Push-notifikation, systemets banner (katalog 21, mobil 26e.6, node F2X-0). Skal kunne læses uden
 * at åbne appen: virksomhed + hændelse + ét tal i én sætning. Hvid flade, radius 14, skygge (det
 * svæver), appikon 36 px, appnavn i 600 og tid til højre. Bruges som forhåndsvisning i
 * overvågningsindstillingerne og som skabelon for teksten, der sendes til telefonen.
 */
export function PushBanner({ event, company, figure, time = "nu", app = "Lasso" }: PushBannerProps) {
  const text = pushText({ event, company, figure });
  return (
    <div className="lasso-push" role="img" aria-label={`Push-notifikation fra ${app}: ${text}`}>
      <span className="lasso-push__icon" aria-hidden="true">
        <LassoMark />
      </span>
      <span className="lasso-push__main">
        <span className="lasso-push__head">
          <span className="lasso-push__app">{app}</span>
          <span className="lasso-push__time">{time}</span>
        </span>
        <span className="lasso-push__text">{text}</span>
      </span>
    </div>
  );
}
