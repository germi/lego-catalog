import { t } from "@/i18n";

/**
 * Pulls a human-readable message out of an axios error.
 *
 * API Platform answers a failed write with `detail` (and `violations` for field-level
 * validation), so prefer those over axios's generic "Request failed with status 422".
 */
export function apiError(error, fallback = null) {
  const data = error?.response?.data;

  if (data?.violations?.length) {
    return data.violations.map((violation) => violation.message).join(" ");
  }
  if (data?.detail) return data.detail;
  if (data?.["hydra:description"]) return data["hydra:description"];
  if (error?.message === "Network Error") {
    return t("ERRORS.NO_API");
  }

  return error?.message || fallback || t("ERRORS.GENERIC");
}
