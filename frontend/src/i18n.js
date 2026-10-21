import { createI18n } from "vue-i18n";

import ca from "./locales/ca.json";

/**
 * Single-language for now. To add another locale, drop its JSON in src/locales/ and
 * register it here — see docs/LANGUAGE-SYSTEM.md.
 */
const i18n = createI18n({
  legacy: false,
  globalInjection: true, // so <OTText> can call $t in templates
  locale: "ca",
  fallbackLocale: "ca",
  messages: { ca },
});

export default i18n;

/** For translating outside a component (formatters, services). */
export const t = (key, options) => i18n.global.t(key, options ?? {});
