// Date-only values ("YYYY-MM-DD"), like atm-km's DATE columns. Everything is
// computed in UTC so hours and DST changes never leak in.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUTC(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function today() {
  const now = new Date();
  return fromUTC(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function addDays(iso: string, days: number) {
  return fromUTC(toUTC(iso) + days * MS_PER_DAY);
}

export function daysBetween(start: string, end: string) {
  return Math.round((toUTC(end) - toUTC(start)) / MS_PER_DAY);
}

/** Sunday of the date's week (weeks run Sunday to Saturday). */
export function startOfWeek(iso: string) {
  return addDays(iso, -new Date(toUTC(iso)).getUTCDay());
}

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

const shortFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const weekdayFormatter = new Intl.DateTimeFormat("es-PE", {
  weekday: "short",
  timeZone: "UTC",
});
const longFormatter = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const monthFormatter = new Intl.DateTimeFormat("es-PE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2 nov." */
export function formatShort(iso: string) {
  return shortFormatter.format(toUTC(iso));
}

/** "Lun." */
export function formatWeekday(iso: string) {
  return capitalize(weekdayFormatter.format(toUTC(iso)));
}

/** "Lunes, 2 de noviembre" */
export function formatLong(iso: string) {
  return capitalize(longFormatter.format(toUTC(iso)));
}

/** "Noviembre 2026" */
export function formatMonth(key: string) {
  return capitalize(monthFormatter.format(toUTC(`${key}-01`)).replace(" de ", " "));
}

/** "Hoy", "Ayer", or "28 oct." */
export function formatRelative(iso: string) {
  const diff = daysBetween(iso, today());
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return formatShort(iso);
}

/** "28 oct. – 2 nov.", or a single date when it is the same day. */
export function formatRange(start: string, end: string | null) {
  if (!end || end === start) return formatShort(start);
  return `${formatShort(start)} – ${formatShort(end)}`;
}

export function weekLabel(weekStart: string) {
  const current = startOfWeek(today());
  if (weekStart === current) return "Esta semana";
  if (weekStart === addDays(current, -7)) return "Semana pasada";
  return `Semana del ${formatShort(weekStart)}`;
}

/** The local calendar day of an instant (an ISO timestamp from the API). */
export function localDay(timestamp: string) {
  const date = new Date(timestamp);
  return fromUTC(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}
