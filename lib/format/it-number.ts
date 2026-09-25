// Italian number formatting, with grouping pinned. Use this instead of calling
// Intl.NumberFormat("it-IT", …) directly.
//
// WHY THIS EXISTS. Italian sets minimumGroupingDigits = 2, so under the default
// useGrouping: "auto" a four-digit number keeps its separator on one ICU build
// and drops it on another — "8.744" vs "8744". The server and the browser then
// disagree about the rendered text, React reports a hydration mismatch and
// throws away the server HTML for that subtree. It is environment-dependent, so
// it appears intermittently and only for some visitors.
//
// This was diagnosed once and fixed only in lib/dashboard-review/format.ts.
// Seventeen other formatters were left on "auto", so the hazard stayed live
// everywhere a four-digit value could appear — including every chart on the
// antibiotics page. They now all route through here, which is the point: the
// decision is made once and cannot drift back a formatter at a time.
//
// useGrouping is applied LAST, after the caller's options, so it cannot be
// restored to "auto" by accident.
//
// YEARS MUST NOT GO THROUGH THIS. 2025 would render "2.025". Every year in the
// product is printed raw — chart X axes use dataKey="year" with no
// tickFormatter, tables print {r.year} directly — and that was verified across
// every affected component before this was introduced. Keep it that way; if a
// year ever needs formatting, use String(year).
//
// Compact formatters (notation: "compact") are deliberately NOT routed through
// here. Grouping is not meaningful for "1,2 Mln", and forcing it would be a
// behaviour change for no benefit.

export function itNumberFormat(options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  return new Intl.NumberFormat("it-IT", { ...options, useGrouping: true });
}

/** One-off formatting, for call sites that do not keep a formatter around. */
export function itNumber(value: number, options: Intl.NumberFormatOptions = {}): string {
  return itNumberFormat(options).format(value);
}
