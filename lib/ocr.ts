import { normalizeItemKey } from "./items";

export interface OcrLine {
  text: string;
  guessedName: string;
  guessedPrice: number | null;
}

// Sor eleji ÁFA-kód (pl. "C00", "E00", "B00" — OCR-ben gyakran "COO"/"EOO"/"BOO"-ként jelenik meg,
// mert a nyomtatott 0 és O nagyon hasonlít). Ez nem a termék neve, levágjuk.
const VAT_PREFIX_RE = /^[A-Za-z][0oO]{2}\s+/;

// Súly-tára sor (pl. "4,576 kg - 0,002 kg Tára") — sosem termék, sosem tartalmaz saját árat.
const TARE_RE = /^\d+[.,]?\d*\s*kg\s*[-–]\s*\d+[.,]?\d*\s*kg\s*t[áa]ra/i;

// Mennyiség/kiszerelés-bontás sor (pl. "6 DB × 129 Ft/DB" vagy "4,574 kg × 599 Ft/kg") —
// ilyenkor a tétel NEVE egy korábbi, ár nélküli soron van, ez a sor csak a végösszeget hordozza.
const QTY_BREAKDOWN_RE = /^\d+[.,]?\d*\s*(db|kg)\s*[×x*]\s*[\d\s.,]+\s*ft\s*\/?\s*(db|kg)?/i;

// Sor végi ár: szóközzel elválasztott, ezres-tagolt vagy sima egész szám a sor végén.
// Tudatosan NEM enged vesszőt/pontot közvetlenül a szám elé — így a "23,5g", "0,262 kg"
// jellegű méret/súly jelölések nem lesznek tévesen árnak felismerve.
const PRICE_TAIL_RE = /\s(\d{1,3}(?:\s\d{3})*)\s*(?:Ft|HUF)?\s*$/i;

// Blokk-láblécen/fejlécen gyakran előforduló, NEM termék sorok — ezeket kiszűrjük az OCR találatokból.
const NON_ITEM_KEYWORDS = [
  "osszesen",
  "vegosszeg",
  "fizetendo",
  "fizetve",
  "visszajaro",
  "kapott",
  "atveendo",
  "keszpenz",
  "bankkartya",
  "kartya",
  "afa",
  "menny",
  "egysegar",
  "netto",
  "brutto",
  "kedvezmeny",
  "engedmeny",
  "aruhaz",
  "penztaros",
  "penztargep",
  "gepszam",
  "adoszam",
  "sorszam",
  "nyugta",
  "blokk",
  "alairas",
  "bizonylat",
  "vevo",
  "vam",
  "ervenyes",
  "koszonjuk",
  "viszlat",
  "nyitva",
  "contactless",
  "mastercard",
  "trnid",
  "auth",
];

function looksLikeItem(guessedName: string): boolean {
  const key = normalizeItemKey(guessedName);
  if (key.length < 2) return false;
  if (/^\d+$/.test(key)) return false;
  return !NON_ITEM_KEYWORDS.some((kw) => key.includes(kw));
}

export async function recognizeReceiptText(imageDataUrl: string): Promise<string> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("hun");
  try {
    // A blokk egy sűrű, egyoszlopos szövegtömb — ez a mód sokkal jobb eredményt ad,
    // mint az alapértelmezett "automatikus oldalfelismerés", ami táblázatos blokkon gyakran téved.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
    const {
      data: { text },
    } = await worker.recognize(imageDataUrl);
    return text;
  } finally {
    await worker.terminate();
  }
}

function extractTailPrice(line: string): number | null {
  const match = line.match(PRICE_TAIL_RE);
  if (!match) return null;
  const parsed = Number(match[1].replace(/\s/g, ""));
  return !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
}

// A bolt neve/címe/adószáma a "NYUGTA"/"SZÁMLA" cím ELŐTT áll — ez sosem tétel, de gyakran
// tartalmaz házszámot, irányítószámot, ami tévesen árnak nézhető. Az "ÖSSZESEN" sor UTÁN pedig
// már csak fizetési/kártya-adatok jönnek. Ezért csak a kettő közötti részt tekintjük tételnek.
const START_MARKER_RE = /nyugta|szamla/;
const END_MARKER_RE = /osszesen|vegosszeg/;

function parseLines(rawLines: string[], bounded: boolean): { lines: OcrLine[]; sawStart: boolean } {
  const results: OcrLine[] = [];
  let pendingName: string | null = null;
  let started = !bounded;
  let sawStart = false;

  for (const rawLine of rawLines) {
    const line = rawLine.replace(VAT_PREFIX_RE, "").trim();
    if (!line) continue;
    const normalized = normalizeItemKey(line);

    if (!started) {
      if (START_MARKER_RE.test(normalized)) {
        started = true;
        sawStart = true;
      }
      continue;
    }
    if (bounded && END_MARKER_RE.test(normalized)) break;

    if (TARE_RE.test(line)) continue;

    if (QTY_BREAKDOWN_RE.test(line)) {
      const price = extractTailPrice(line);
      const name = pendingName || line;
      if (looksLikeItem(name)) {
        results.push({ text: rawLine, guessedName: name, guessedPrice: price });
      }
      pendingName = null;
      continue;
    }

    if (!looksLikeItem(line)) {
      continue;
    }

    const price = extractTailPrice(line);
    if (price !== null) {
      const match = line.match(PRICE_TAIL_RE);
      const name = (match && match.index !== undefined ? line.slice(0, match.index) : line).trim();
      results.push({ text: rawLine, guessedName: name || line, guessedPrice: price });
      pendingName = null;
    } else {
      // nincs ár a soron -> valószínűleg egy több sorra bomló tétel neve, várjuk a következő,
      // árat hordozó (mennyiség-bontás) sort
      pendingName = pendingName ? `${pendingName} ${line}` : line;
    }
  }

  // ha az utolsó tétel neve után sosem érkezett ár-hordozó sor, mégis felvesszük ár nélkül,
  // hogy a user kézzel kiegészíthesse — ne vesszen el a tétel
  if (pendingName && looksLikeItem(pendingName)) {
    results.push({ text: pendingName, guessedName: pendingName, guessedPrice: null });
  }

  return { lines: results, sawStart };
}

// Az OCR nyers szövegéből sorononkénti név+ár javaslat — a user mindig jóváhagyja/javítja.
// Kezeli az ÁFA-kód előtagot, a súly-tára sorokat, és a több sorra bomló (db-szorzós / kg-os)
// tételeket, ahol a név és az ár külön sorra kerül. A bolt fejléce/lábléce ("NYUGTA" előtt,
// "ÖSSZESEN" után) sosem kerül feldolgozásra, ha felismerhető ez a két határ.
export function parseReceiptLines(rawText: string): OcrLine[] {
  const rawLines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const bounded = parseLines(rawLines, true);
  if (bounded.sawStart) return bounded.lines;

  // nem találtunk "NYUGTA"/"SZÁMLA" jelölést (szokatlan blokk-formátum) -> teljes szöveg feldolgozása
  return parseLines(rawLines, false).lines;
}
