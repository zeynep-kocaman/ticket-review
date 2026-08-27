/**
 * Pattern-based scanner that highlights spans a reviewer should look at.
 *
 * This is a READING AID, not a decision. It has no authority in the workflow:
 * a ticket only becomes cleared when a person presses a key. Patterns produce
 * false positives (order numbers that look like phone numbers) and false
 * negatives (names, addresses written in prose, anything unusual). A clean
 * scan means "nothing matched", never "no personal data present".
 *
 * Tuned for German-language support tickets.
 */

export type PiiKind =
  | "email"
  | "phone"
  | "iban"
  | "card"
  | "postal"
  | "plate"
  | "url"
  | "digits"
  | "date";

export const KIND_LABEL: Record<PiiKind, string> = {
  email: "E-mail",
  phone: "Phone",
  iban: "IBAN",
  card: "Card",
  postal: "Address",
  plate: "Plate",
  url: "URL",
  digits: "Number",
  date: "Date",
};

type Rule = { kind: PiiKind; re: RegExp };

const RULES: Rule[] = [
  { kind: "email", re: /[\p{L}0-9._%+-]+@[\p{L}0-9.-]+\.[\p{L}]{2,}/gu },

  // IBAN: 2 letters, 2 check digits, then 11-30 alphanumerics, spaces allowed.
  { kind: "iban", re: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}[ ]?[A-Z0-9]{1,4}\b/g },

  // 13-19 digit card-like sequences with optional spaces or dashes.
  { kind: "card", re: /\b(?:\d[ -]?){13,19}\b/g },

  // German + international phone shapes.
  { kind: "phone", re: /(?:\+49|0049|\(0\)|\b0)[\s\-/]?\d{2,5}[\s\-/]?\d{3,}(?:[\s\-/]?\d{2,})?/g },

  // "12345 Köln" / "Musterstraße 12, 50667"
  { kind: "postal", re: /\b\d{5}\s+[A-ZÄÖÜ][\p{L}.\-]{2,}\b/gu },
  { kind: "postal", re: /\b[A-ZÄÖÜ][\p{L}.\-]+(?:stra(?:ß|ss)e|str\.|weg|platz|allee|gasse|ring)\s+\d{1,4}[a-z]?\b/giu },

  // German licence plates: K-AB 1234
  { kind: "plate", re: /\b[A-ZÄÖÜ]{1,3}-[A-ZÄÖÜ]{1,2}\s?\d{1,4}\b/g },

  { kind: "date", re: /\b(?:0?[1-9]|[12]\d|3[01])[.\/-](?:0?[1-9]|1[0-2])[.\/-](?:19|20)\d{2}\b/g },

  // Links can carry identifiers in the query string.
  { kind: "url", re: /https?:\/\/[^\s<>"')]+/g },

  // Bare 7+ digit runs: customer numbers, contract ids, meter readings.
  { kind: "digits", re: /\b\d{7,}\b/g },
];

export type Span = { start: number; end: number; kind: PiiKind; value: string };
export type Segment = { text: string; kind: PiiKind | null };

/** Longest match wins; earlier rules win ties. */
export function findPii(text: string): Span[] {
  if (!text) return [];

  const found: Span[] = [];
  for (const { kind, re } of RULES) {
    const rx = new RegExp(re.source, re.flags);
    for (const m of text.matchAll(rx)) {
      if (m.index === undefined) continue;
      const value = m[0];
      // Trim trailing punctuation the regex may have swallowed.
      const trimmed = value.replace(/[\s.,;:!?)\]]+$/, "");
      if (trimmed.length < 4) continue;
      found.push({ start: m.index, end: m.index + trimmed.length, kind, value: trimmed });
    }
  }

  found.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const kept: Span[] = [];
  let cursor = -1;
  for (const span of found) {
    if (span.start >= cursor) {
      kept.push(span);
      cursor = span.end;
    }
  }
  return kept;
}

/** Splits text into plain and flagged segments for rendering. */
export function segment(text: string): Segment[] {
  const spans = findPii(text);
  if (spans.length === 0) return text ? [{ text, kind: null }] : [];

  const out: Segment[] = [];
  let at = 0;
  for (const s of spans) {
    if (s.start > at) out.push({ text: text.slice(at, s.start), kind: null });
    out.push({ text: text.slice(s.start, s.end), kind: s.kind });
    at = s.end;
  }
  if (at < text.length) out.push({ text: text.slice(at), kind: null });
  return out;
}

export function countByKind(text: string): Array<{ kind: PiiKind; count: number }> {
  const tally = new Map<PiiKind, number>();
  for (const s of findPii(text)) tally.set(s.kind, (tally.get(s.kind) ?? 0) + 1);
  return [...tally.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count);
}
