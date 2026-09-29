import type { GalleryEntry } from "../types.js";
import { entries as a } from "./a_felter.js";
import { entries as b } from "./b_ramme.js";
import { entries as c } from "./c_data1.js";
import { entries as d } from "./d_data2.js";
import { entries as e } from "./e_layout.js";

/** Rækkefølge = Paper-katalogets rækkefølge. */
const ORDER = ["01", "01b", "02a", "02b", "02c", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "14b", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "26a", "26b", "26c", "26d", "26e", "26f", "26g", "26h", "27", "28", "29", "30"];
const key = (nr: string) => {
  const [board, n] = nr.split(".");
  return ORDER.indexOf(board!) * 1000 + parseInt(n ?? "0", 10);
};
export const ENTRIES: GalleryEntry[] = [...a, ...b, ...c, ...d, ...e].sort((x, y) => key(x.nr) - key(y.nr));
