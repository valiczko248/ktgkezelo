// Több blokk-fotó egymás alá illesztése egyetlen képpé (nincs perspektíva-korrekció,
// egy általában függőleges pénztárblokknál ez elég és megbízhatóbb, mint egy valódi panoráma-illesztés).
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
