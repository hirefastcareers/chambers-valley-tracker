import { format, isValid, parseISO } from "date-fns";

export function formatDateDDMMYYYY(value: Date | string | null | undefined) {
  if (!value) return "—";
  if (typeof value === "string") {
    // Calendar dates from Postgres (YYYY-MM-DD) must not use parseISO — it anchors at UTC midnight
    // and shifts the displayed day in non-UTC timezones.
    const part = value.split("T")[0] ?? "";
    const [y, m, d] = part.split("-").map((n) => Number(n));
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      const local = new Date(y, m - 1, d);
      if (isValid(local)) return format(local, "dd/MM/yyyy");
    }
  }
  const date = typeof value === "string" ? parseISO(value) : value;
  if (!isValid(date)) return "—";
  return format(date, "dd/MM/yyyy");
}

/** Calendar day in local time for comparisons (follow-up due vs today). */
export function parseDateStartOfDayLocal(value: string | null | undefined) {
  if (!value) return null;
  const part = value.split("T")[0] ?? "";
  const [y, m, d] = part.split("-").map((n) => Number(n));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = new Date(y, m - 1, d);
  if (!isValid(date)) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

export function startOfTodayLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatMoneyGBP(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "£0.00";
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "£0.00";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(num);
}

export function normalizePhoneToDigits(input: string) {
  return (input || "")
    .replace(/[^\d]/g, "")
    .replace(/^00/, "") // allow 00... international prefix
    .trim();
}

// UK format display, and international WhatsApp format for wa.me.
// Example: "07123 456 789" -> "44123456789"
export function toWhatsAppInternational(phoneUk: string) {
  const digits = normalizePhoneToDigits(phoneUk);
  if (!digits) return "";

  // If number already starts with 44, keep it; otherwise strip leading 0.
  if (digits.startsWith("44")) return digits;
  if (digits.startsWith("0")) return `44${digits.slice(1)}`;
  // Fallback: just prefix 44 for other UK-ish formats.
  return `44${digits}`;
}

