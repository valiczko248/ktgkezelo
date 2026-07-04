import { normalizeItemKey } from "./items";

export interface OcrLine {
  text: string;
  guessedName: string;
  guessedPrice: number | null;
}

// Sor végi ár-minta: "Kenyér 1234" vagy "Kenyér 1 234 Ft"
const PRICE_RE = /(\d[\d\s.]{0,9}\d|\d)\s*(?:Ft|HUF)?\s*$/i;

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
];

function looksLikeItem(guessedName: string): boolean {
  const key = normalizeItemKey(guessedName);
  if (key.length < 2) return false;
  if (/^\d+$/.test(key)) return false;
  return !NON_ITEM_KEYWORDS.some((kw) => key.includes(kw));
}

export async function recognizeReceiptText(imageDataUrl: string): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("hun");
  try {
    const {
      data: { text },
    } = await worker.recognize(imageDataUrl);
    return text;
  } finally {
    await worker.terminate();
  }
}

// Az OCR nyers szövegéből sorononkénti név+ár javaslat — a user mindig jóváhagyja/javítja.
// A nyilvánvalóan nem termék sorokat (összesen, visszajáró, áfa, stb.) kiszűri.
export function parseReceiptLines(rawText: string): OcrLine[] {
  return rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(PRICE_RE);
      let guessedPrice: number | null = null;
      let guessedName = line;
      if (match && match.index !== undefined) {
        const numeric = match[1].replace(/[\s.]/g, "");
        const parsed = Number(numeric);
        if (!Number.isNaN(parsed) && parsed > 0) {
          guessedPrice = parsed;
          guessedName = line.slice(0, match.index).trim();
        }
      }
      return { text: line, guessedName: guessedName || line, guessedPrice };
    })
    .filter((l) => looksLikeItem(l.guessedName));
}
