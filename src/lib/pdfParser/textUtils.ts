/**
 * Text and currency utilities for invoice data extraction.
 */

/**
 * Parses numeric currency strings (e.g. "Rs. 153.00", "Rs.164.00", "1,249.50", "₹ 207.01")
 * into clean float numbers.
 */
export function parseCurrencyValue(raw?: string | null): number {
  if (!raw || typeof raw !== "string") return 0;

  // Remove currency symbols, commas, and trailing non-numeric text
  const cleaned = raw
    .replace(/[Rs₹$]/gi, "")
    .replace(/,/g, "")
    .trim();

  // Match the first valid decimal number
  const match = cleaned.match(/[-+]?\d+(?:\.\d+)?/);
  if (match) {
    const val = parseFloat(match[0]);
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  }
  return 0;
}

/**
 * Removes duplicate repetitions caused by PDF fake-bolding or shadow rendering
 * (e.g. "OriginalOriginal TaxTax", "Invoice NumberInvoice Number").
 */
export function cleanDuplicatedWords(text: string): string {
  if (!text) return "";

  // 1. Remove exact phrase duplication "Phrase Phrase" or "WordWord"
  let cleaned = text;

  // Remove whole-phrase doubling from PDF fake-bolding (e.g. "Order NoOrder No" -> "Order No",
  // "2 Days Return2 Days Return" -> "2 Days Return", "Rs.164.00Rs.164.00" -> "Rs.164.00").
  // Require at least one letter and no leading/trailing space inside the repeated unit so
  // numeric table columns like "2.50 3.43 2.50 3.43" or "0.00 0.00" are never collapsed.
  cleaned = cleaned.replace(
    /\b([A-Za-z0-9][^\n]*?[A-Za-z][^\n]*?\S)\1(?=\s|$|[.,:!?])/g,
    "$1",
  );

  // Token-level deduplication for words like "TaxTax", "SlotSlot" (skip pure digits/numbers)
  const tokens = cleaned.split(/\s+/);
  const dedupedTokens = tokens.map((token) => {
    if (token.length >= 4 && token.length % 2 === 0 && /[A-Za-z]/.test(token)) {
      const half = token.slice(0, token.length / 2);
      if (half + half === token) {
        return half;
      }
    }
    return token;
  });

  return dedupedTokens.join(" ").trim();
}

/**
 * Cleans item description by removing common non-item clutter like return policies,
 * warranty disclaimers, or tax rate tags.
 */
export function cleanItemName(name: string): string {
  if (!name) return "";

  let cleaned = name;

  // Remove return policy artifacts
  cleaned = cleaned.replace(/\b\d+\s*Days?\s*Return\b/gi, "");
  cleaned = cleaned.replace(/\bNon-Returnable\b/gi, "");

  // Remove leading numbers or bullets like "1.", "1 ", "Sr No 1"
  cleaned = cleaned.replace(/^\s*(?:Sr\.?\s*No\.?\s*)?\d+[.)\s-]+/i, "");

  // Remove duplicate tokens
  cleaned = cleanDuplicatedWords(cleaned);

  // Normalize multiple spaces or line breaks
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}
