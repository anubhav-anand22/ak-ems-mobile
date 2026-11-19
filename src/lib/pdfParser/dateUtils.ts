/**
 * Utilities for extracting and normalizing invoice dates into timestamps.
 */

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

/**
 * Parses any common invoice date string into a Unix epoch timestamp (milliseconds).
 * Falls back to Date.now() if invalid or missing.
 */
export function parseInvoiceDateToTimestamp(rawDate?: string | null): number {
  if (!rawDate || typeof rawDate !== "string") {
    return Date.now();
  }

  const clean = rawDate.trim();
  if (!clean) return Date.now();

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date.getTime();
  }

  // 2. Indian / European format: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date.getTime();
  }

  // 3. Written month: "14 Nov 2026" or "14 November 2026"
  const dMmmYMatch = clean.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (dMmmYMatch) {
    const day = parseInt(dMmmYMatch[1], 10);
    const mStr = dMmmYMatch[2].toLowerCase();
    const month = MONTH_MAP[mStr];
    const year = parseInt(dMmmYMatch[3], 10);
    if (month !== undefined) {
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) return date.getTime();
    }
  }

  // 4. Fallback to native Date.parse
  const parsed = Date.parse(clean);
  if (!isNaN(parsed)) {
    return parsed;
  }

  return Date.now();
}
