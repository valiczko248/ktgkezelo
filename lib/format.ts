export function formatMoney(amount: number, currency: string = "HUF") {
  const fractionDigits = currency === "HUF" ? 0 : 2;
  return new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

export function formatShortMoney(amount: number, currency: string = "HUF") {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M ${currency}`;
  if (abs >= 1_000) return `${(amount / 1_000).toFixed(0)}k ${currency}`;
  return formatMoney(amount, currency);
}

export const CURRENCIES = ["HUF", "EUR", "USD", "GBP", "CHF", "RON"];

export function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("hu-HU", { month: "long", year: "numeric" }).format(date);
}

export function weekdayShort(date: Date) {
  return new Intl.DateTimeFormat("hu-HU", { weekday: "short" }).format(date);
}
