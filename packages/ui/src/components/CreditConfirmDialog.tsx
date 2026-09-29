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
  /** UDGÅET (18.3, Jakob 29.09): rækken "Ventetid" vises ikke længere; prop'en ignoreres. */
  wait?: string;
  /** Hvad der hentes, fx "kreditvurderingen for Eksempel Byg A/S". */
  what?: string;
  title?: string;
  /** Undertekst under titlen, fx "LASSO X A/S, seneste vurdering er 13 dage gammel." (18.3). Standard: prisen og `what`. */
  description?: string;
}

const credits = (n: number) => `${formatNumber(n)} ${n === 1 ? "kredit" : "kreditter"}`;

/**
 * Bekræft hentning (katalog 18.3, node BYX-0): bruges, når man klikker på en Creditsafe-rapport, der koster kreditter (Jakob 29.09); dialogen fra 07 med nøgle-værdi-linjer (pris,
 * saldo efter; 18.3: ingen ventetid), uden ×-lukkeknap og med "Annuller" som tekstknap. Prisen gentages i knappen
 * ("Hent, 1 kredit"), så man aldrig er i tvivl. Ved 0 kreditter
 * erstattes knappen af "Køb kreditter", og prisen står med rød tekst. Mobil: bundark (07/26a).
 */
export function CreditConfirmDialog({ open, onClose, onConfirm, onBuy, balance, price = 1, what, title, description }: CreditConfirmDialogProps) {
  const enough = balance >= price;
  const after = balance - price;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={title ?? "Hent ny kreditvurdering?"}
      description={description ?? `Koster ${credits(price)}${what ? `: ${what}` : ""}.`}
      hideClose
      className="lasso-creditconfirm"
      actions={{
        secondary: { label: "Annuller", onClick: onClose, text: true },
        primary: enough ? { label: `Hent, ${credits(price)}`, onClick: onConfirm } : { label: "Køb kreditter", onClick: onBuy ?? onClose, disabled: !onBuy },
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
      </dl>
    </Dialog>
  );
}
