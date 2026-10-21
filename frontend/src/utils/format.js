/**
 * Display formatters.
 *
 * Month names and relative times come from Intl pinned to ca-ES, not from the label
 * files — Intl generates them, so they cannot be label-managed. The two cases Intl
 * does not cover ("mai", "ara mateix") do go through the label system.
 *
 * Amounts come out as "224,99 €", the same way Amazon writes them.
 */
import { t } from "@/i18n";

const UI_LOCALE = "ca-ES";

export function money(value, currency = "EUR", { decimals = 2 } = {}) {
  if (value == null || !Number.isFinite(value)) return "—";

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "EUR",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    // Unknown currency code — fall back to a plain number plus the raw code.
    return `${number(value, decimals)} ${currency ?? ""}`.trim();
  }
}

export function number(value, decimals = 2) {
  if (value == null || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function percent(value, { signed = false } = {}) {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = signed && value > 0 ? "+" : "";

  return `${sign}${number(value, Math.abs(value) < 10 ? 1 : 0)}%`;
}

/** Timestamps are stored and served in UTC; rendering converts to local time. */
export function dateTime(iso) {
  if (!iso) return "—";

  return new Date(iso).toLocaleString(UI_LOCALE, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dateShort(iso) {
  if (!iso) return "—";

  return new Date(iso).toLocaleDateString(UI_LOCALE, { day: "2-digit", month: "short" });
}

export function dateLong(iso) {
  if (!iso) return "—";

  return new Date(iso).toLocaleDateString(UI_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "ara mateix", "fa 3 h", "fa 2 dies" — for the "last checked" line. */
export function relative(iso) {
  if (!iso) return t("TIME.NEVER");

  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 90) return t("TIME.JUST_NOW");

  const rtf = new Intl.RelativeTimeFormat(UI_LOCALE, { numeric: "auto" });
  const units = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];

  for (const [unit, size] of units) {
    if (seconds >= size) return rtf.format(-Math.round(seconds / size), unit);
  }

  return t("TIME.JUST_NOW");
}
