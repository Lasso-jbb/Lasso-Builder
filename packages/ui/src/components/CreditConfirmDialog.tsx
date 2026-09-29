import { formatNumber } from "@lasso/spec";
import { Dialog } from "./Dialog.js";

export interface CreditConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** Bekræftet: start hentningen (koster `price` kreditter). */
  onConfirm: () => void;
  /** Ved 0 kreditter erstattes knappen af "Køb kreditter". Uden onBuy er knappen deaktiveret. */
  onBuy?: () => void;
  /** Kreditter tilbage før hentningen. */
  balance: number;
  /** Pris i kreditter, standard 1. */
  price?: number;
  /** Ventetid som tekst, standard "5–45 sekunder" (Creditsafe). */
  wait?: string;
  /** Hvad der hentes, fx "kreditvurderingen for Eksempel Byg A/S". */
  what?: string;
  title?: string;
}

const credits = (n: number) => `${formatNumber(n)} ${n === 1 ? "kredit" : "kreditter"}`;

/**
 * Bekræft hentning (katalog 18.3, node BYX-0): dialogen fra 07 med tre nøgle-værdi-linjer (pris,
 * saldo efter, ventetid). Prisen gentages i knappen, så man aldrig er i tvivl. Ved 0 kreditter
 * erstattes knappen af "Køb kreditter", og prisen står med rød tekst. Mobil: bundark (07/26a).
 */
export function CreditConfirmDialog({ open, onClose, onConfirm, onBuy, balance, price = 1, wait = "5–45 sekunder", what, title }: CreditConfirmDialogProps) {
  const enough = balance >= price;
  const after = balance - price;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={title ?? "Hent ny vurdering?"}
      description={`Koster ${credits(price)}${what ? `: ${what}` : ""}.`}
      className="lasso-creditconfirm"
      actions={{
        secondary: { label: "Annuller", onClick: onClose },
        primary: enough ? { label: `Hent for ${credits(price)}`, onClick: onConfirm } : { label: "Køb kreditter", onClick: onBuy ?? onClose, disabled: !onBuy },
      }}
    >
      <dl className="lasso-creditconfirm__facts">
        <div className="lasso-creditconfirm__fact">
          <dt>Pris</dt>
          <dd className={enough ? undefined : "lasso-creditconfirm__price--short"}>{credits(price)}</dd>
        </div>
        <div className="lasso-creditconfirm__fact">
          <dt>Saldo efter</dt>
          <dd>{enough ? credits(after) : `${credits(balance)}, ikke nok`}</dd>
        </div>
        <div className="lasso-creditconfirm__fact">
          <dt>Ventetid</dt>
          <dd>{wait}</dd>
        </div>
      </dl>
    </Dialog>
  );
}
