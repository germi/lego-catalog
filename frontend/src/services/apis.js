import { createCachedAPI } from "./apiFactory";

const baseURL = import.meta.env.VITE_API_URL || "/";

/**
 * The catalogue API. Same origin in production, where Symfony serves the SPA from
 * /app/; in dev the Vite server points at the Symfony dev server (see .env.development).
 *
 * API Platform is configured with plain JSON first, so ask for it explicitly rather
 * than receiving a JSON-LD document.
 */
export const legoApi = createCachedAPI(
  baseURL,
  (data) => data,
  (api) => {
    api.defaults.headers.common["Accept"] = "application/json";
  },
);

/**
 * The same API, read as JSON-LD, for paginated collections.
 *
 * A plain-JSON collection is a bare array: it cannot say how many rows exist in total,
 * and a pager needs that to know how many pages there are. The JSON-LD representation
 * carries `totalItems` alongside `member`, so paginated lists go through this client
 * and everything else stays on the plain one.
 */
export const legoCollectionApi = createCachedAPI(
  baseURL,
  (data) => ({
    items: data.member ?? [],
    total: data.totalItems ?? 0,
  }),
  (api) => {
    api.defaults.headers.common["Accept"] = "application/ld+json";
  },
);
