"use client";

function toDisplay(value: string): string {
  if (!value) return "";
  const [intPart, decPart] = value.split(".");
  const groupedInt = intPart ? Number(intPart).toLocaleString("hu-HU") : "0";
  return decPart !== undefined ? `${groupedInt},${decPart}` : groupedInt;
}

function toCanonical(input: string): string {
  let cleaned = input.replace(/[^\d.,]/g, "");
  const firstSep = cleaned.search(/[.,]/);
  if (firstSep !== -1) {
    const intPart = cleaned.slice(0, firstSep).replace(/[.,]/g, "");
    const decPart = cleaned
      .slice(firstSep + 1)
      .replace(/[.,]/g, "")
      .slice(0, 2);
    return `${intPart}.${decPart}`;
  }
  return cleaned;
}

// Ezres tagolással megjelenített, de számként (Number(...)) is kompatibilis szám-beviteli mező.
export function AmountInput({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={toDisplay(value)}
      onChange={(e) => onChange(toCanonical(e.target.value))}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={className}
    />
  );
}
