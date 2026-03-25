import { format, isValid, parseISO } from "date-fns";

export function formatDateDDMMYYYY(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (!isValid(date)) return "—";
  return format(date, "dd/MM/yyyy");
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

