// Több blokk-fotó egymás alá illesztése egyetlen képpé (nincs perspektíva-korrekció,
// egy általában függőleges pénztárblokknál ez elég és megbízhatóbb, mint egy valódi panoráma-illesztés).

// Szürkeárnyalatos + kontraszt-nyújtás az OCR-hez: a telefon-fotók (különösen hőpapíros blokknál)
// gyakran halványak/alacsony kontrasztúak — ez sokat javít a tesseract felismerésén.
function enhanceForOcr(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const gray = new Uint8ClampedArray(data.length / 4);

  let min = 255;
  let max = 0;
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    const g = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
    gray[i] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }

  const range = Math.max(max - min, 1);
  for (let i = 0; i < gray.length; i++) {
    const stretched = ((gray[i] - min) / range) * 255;
    const o = i * 4;
    data[o] = data[o + 1] = data[o + 2] = stretched;
  }

  ctx.putImageData(imageData, 0, 0);
}

// Egyetlen fotó "normalizálása": a canvas-ra rajzolás mellékhatásaként a böngésző
// alkalmazza a kép EXIF-tájolását (a telefon gyakran forgatva tárolja a nyers pixeleket,
// és csak az EXIF-jelző mondja meg, hogyan kell megjeleníteni) — enélkül a tesseract
// néha egy oldalra fordított képet próbálna felismerni, ami teljesen hibás eredményt ad.
export async function normalizeImage(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context nem elérhető");
  ctx.drawImage(img, 0, 0);
  enhanceForOcr(ctx, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export async function stitchImagesVertically(dataUrls: string[]): Promise<string> {
  const images = await Promise.all(dataUrls.map(loadImage));
  const width = Math.max(...images.map((img) => img.width));
  const scaled = images.map((img) => ({ img, height: (img.height * width) / img.width }));
  const totalHeight = scaled.reduce((sum, s) => sum + s.height, 0);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context nem elérhető");

  let y = 0;
  for (const { img, height } of scaled) {
    ctx.drawImage(img, 0, y, width, height);
    y += height;
  }

  enhanceForOcr(ctx, width, totalHeight);
  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
