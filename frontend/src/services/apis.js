import { createCachedAPI } from "./apiFactory";

/**
 * The catalogue API. Same origin in production, where Symfony serves the SPA from
 * /app/; the dev server points at the Symfony dev server on 8078.
 */
export const legoApi = createCachedAPI(
  import.meta.env.VITE_API_URL || "/",
  (data) => data,
  (api) => {
    // API Platform is configured with plain JSON first, so ask for it explicitly
    // rather than getting a JSON-LD document.
    api.defaults.headers.common["Accept"] = "application/json";
  },
);
