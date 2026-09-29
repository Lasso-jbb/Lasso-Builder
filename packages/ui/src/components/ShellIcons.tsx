import { Icon, type IconName } from "./Icon.js";

/**
 * Rammens ikoner (katalog 06 og 26a). Samme sæt og streg som `Icon` (katalog 01, streg 1,8);
 * navnet er bevaret, så eksisterende kald virker. Standardstørrelse 15 px som før.
 */
export type ShellIconName = IconName;

export function ShellIcon({ name, size = 15, filled = false, className }: { name: ShellIconName; size?: number; filled?: boolean; className?: string }) {
  return <Icon name={name} size={size} filled={filled} className={className} />;
}
