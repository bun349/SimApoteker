export const cn = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

const tz = "Asia/Jakarta";

export const formatDeadline = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
  })
    .format(new Date(iso))
    .replace(/\./g, ":")
    .replace(",", ",");

export const formatDate = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
  }).format(d).replace(".", ":");
  if (sameDay) return `Hari ini, ${time} WIB`;
  const date = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric", timeZone: tz,
  }).format(d);
  return `${date}, ${time} WIB`;
};

export const scoreTone = (s: number) =>
  s >= 85 ? "text-emerald-700" : s >= 75 ? "text-navy-800" : "text-red-700";

export const formatShortDate = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric", timeZone: tz,
  }).format(new Date(iso));