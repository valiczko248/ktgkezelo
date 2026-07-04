// Könnyűsúlyú típusok/segédek a blokk-piszkozathoz — szándékosan NEM importál semmi nehezet
// (OCR, kép-összefűzés), hogy a TransactionSheet ne húzza be azokat minden oldalra.

export interface ItemSplitDraft {
  person_id: string;
  amount: string;
}

export interface ItemDraft {
  raw_name: string;
  display_name: string;
  category_id: string;
  quantity: string;
  total_price: string;
  splitRows: ItemSplitDraft[];
  saveAsRule: boolean;
  priceWarning: string | null;
}

export interface ReceiptDraft {
  storeId: string;
  imageDataUrl: string | null;
  pdfFile: File | null;
  linkUrl: string;
  items: ItemDraft[];
  existingImagePath?: string | null;
  existingPdfPath?: string | null;
}

export function emptyReceiptDraft(): ReceiptDraft {
  return {
    storeId: "",
    imageDataUrl: null,
    pdfFile: null,
    linkUrl: "",
    items: [],
    existingImagePath: null,
    existingPdfPath: null,
  };
}

export function emptyItemDraft(): ItemDraft {
  return {
    raw_name: "",
    display_name: "",
    category_id: "",
    quantity: "1",
    total_price: "",
    splitRows: [],
    saveAsRule: false,
    priceWarning: null,
  };
}
