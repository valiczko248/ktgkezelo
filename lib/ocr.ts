import { createWorker } from "tesseract.js";

export interface OcrLine {
  text: string;
  guessedName: string;
  guessedPrice: number | null;
}

// Sor végi ár-minta: "Kenyér 1234" vagy "Kenyér 1 234 Ft"
const PRICE_RE = /(\d[\d\s.]{0,9}\d|\d)\s*(?:Ft|HUF)?\s*$/i;

export async function recognizeReceiptText(imageDataUrl: string): Promise<string> {
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
    });
}
