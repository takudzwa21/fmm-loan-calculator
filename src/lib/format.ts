export function money(value: number | null | undefined, currency = ""): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const n = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return currency ? `${currency} ${n}` : n;
}

export function num(value: number | null | undefined, dp = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(value);
}

/** Fraction (0.08) -> "8.0%" */
export function pctFromFraction(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${num(value * 100, 1)}%`;
}

/** Already-a-percentage number (151.9) -> "151.9%" */
export function pct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${num(value, 1)}%`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** ISO date string -> "31 Jul 2026" */
export function longDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function compactStamp(iso?: string): string {
  const d = iso ? new Date(`${iso.slice(0, 10)}T00:00:00`) : new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function slug(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "client";
}

export function titleise(key: string): string {
  return key
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w|\s\w/g, (c) => c.toUpperCase());
}
