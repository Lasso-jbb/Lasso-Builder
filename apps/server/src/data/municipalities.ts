/**
 * Danske kommunekoder (CVR/DAGI), som Lassos søgning bruger i BasicInfo.municipalityCode.
 * Bekræftet i Lassos prompt-søgning 25.09.2026: Aarhus = 751, Odense = 461.
 */
export const MUNICIPALITY_CODES: Record<string, string> = {
  København: "101",
  Frederiksberg: "147",
  Ballerup: "151",
  Brøndby: "153",
  Dragør: "155",
  Gentofte: "157",
  Gladsaxe: "159",
  Glostrup: "161",
  Herlev: "163",
  Albertslund: "165",
  Hvidovre: "167",
  "Høje-Taastrup": "169",
  "Lyngby-Taarbæk": "173",
  Rødovre: "175",
  Ishøj: "183",
  Tårnby: "185",
  Vallensbæk: "187",
  Furesø: "190",
  Allerød: "201",
  Fredensborg: "210",
  Helsingør: "217",
  Hillerød: "219",
  Hørsholm: "223",
  Rudersdal: "230",
  Egedal: "240",
  Frederikssund: "250",
  Greve: "253",
  Køge: "259",
  Halsnæs: "260",
  Roskilde: "265",
  Solrød: "269",
  Gribskov: "270",
  Odsherred: "306",
  Holbæk: "316",
  Faxe: "320",
  Kalundborg: "326",
  Ringsted: "329",
  Slagelse: "330",
  Stevns: "336",
  Sorø: "340",
  Lejre: "350",
  Lolland: "360",
  Næstved: "370",
  Guldborgsund: "376",
  Vordingborg: "390",
  Bornholm: "400",
  Middelfart: "410",
  Christiansø: "411",
  Assens: "420",
  "Faaborg-Midtfyn": "430",
  Kerteminde: "440",
  Nyborg: "450",
  Odense: "461",
  Svendborg: "479",
  Nordfyns: "480",
  Langeland: "482",
  Ærø: "492",
  Haderslev: "510",
  Billund: "530",
  Sønderborg: "540",
  Tønder: "550",
  Esbjerg: "561",
  Fanø: "563",
  Varde: "573",
  Vejen: "575",
  Aabenraa: "580",
  Fredericia: "607",
  Horsens: "615",
  Kolding: "621",
  Vejle: "630",
  Herning: "657",
  Holstebro: "661",
  Lemvig: "665",
  Struer: "671",
  Syddjurs: "706",
  Norddjurs: "707",
  Favrskov: "710",
  Odder: "727",
  Randers: "730",
  Silkeborg: "740",
  Samsø: "741",
  Skanderborg: "746",
  Aarhus: "751",
  "Ikast-Brande": "756",
  "Ringkøbing-Skjern": "760",
  Hedensted: "766",
  Morsø: "773",
  Skive: "779",
  Thisted: "787",
  Viborg: "791",
  Brønderslev: "810",
  Frederikshavn: "813",
  Vesthimmerlands: "820",
  Læsø: "825",
  Rebild: "840",
  Mariagerfjord: "846",
  Jammerbugt: "849",
  Aalborg: "851",
  Hjørring: "860",
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/\bkommune\b/g, "")
    .replace(/aa/g, "å")
    .replace(/[^a-zæøå]/g, "");

const BY_NORMALIZED = new Map(Object.entries(MUNICIPALITY_CODES).map(([name, code]) => [normalize(name), code]));
const BY_CODE = new Map(Object.entries(MUNICIPALITY_CODES).map(([name, code]) => [code, name]));

/** "Aarhus Kommune", "århus" eller "751" -> "751". Ukendt navn -> undefined. */
export function municipalityCode(nameOrCode: string): string | undefined {
  const t = nameOrCode.trim();
  if (/^\d{3}$/.test(t)) return BY_CODE.has(t) ? t : undefined;
  return BY_NORMALIZED.get(normalize(t));
}

export function municipalityName(code: string): string | undefined {
  return BY_CODE.get(code.trim());
}
