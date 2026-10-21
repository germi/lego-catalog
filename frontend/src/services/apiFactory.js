import axios from "axios";

/**
 * Creates a cached API client backed by axios.
 *
 * Returns an async function that makes HTTP requests and optionally caches
 * the processed response in an in-memory Map for the lifetime of the session.
 * The returned function also exposes a `clearCache()` method to invalidate all cached entries.
 *
 * @param {string} baseURL - The base URL prepended to all request paths.
 * @param {function} [parseResponseFunction=(data) => data] - A transform applied
 *   to the raw response data before any per-request processing (e.g. CSV parsing).
 * @param {function} [configureApi=(api) => api] - A callback that receives the
 *   axios instance for setup (e.g. adding interceptors). Mutates the instance in place.
 * @returns {function} cachedAPI - An async request function with a `.clearCache()` method.
 */
export function createCachedAPI(
  baseURL,
  parseResponseFunction = (data) => data,
  configureApi = (api) => api,
) {
  const cache = new Map();
  const inflight = new Map();

  const api = axios.create({ baseURL });
  configureApi(api);

  /**
   * Makes an HTTP request, applying parsing and processing, with optional caching.
   *
   * Duplicate concurrent requests for the same URL are deduplicated: the second
   * caller receives the same Promise as the first, so only one network request
   * is ever made even if both calls arrive before either has resolved.
   *
   * @param {string} url - The request path (relative to the baseURL).
   * @param {function} [processFunction=(data) => data] - A per-request transform
   *   applied after `parseResponseFunction`.
   * @param {string} [method="get"] - The HTTP method (must match an axios method name).
   * @param {boolean} [useCache=true] - Whether to read from / write to the in-memory cache.
   * @param {*} [postData=undefined] - The request body, passed as the second arg to axios[method].
   * @returns {Promise<*>} The processed response data.
   */
  function cachedAPI(
    url,
    processFunction = (data) => data,
    method = "get",
    useCache = true,
    postData = undefined,
  ) {
    const id = `${method} ${url}`;

    if (useCache && cache.has(id)) return cache.get(id);
    if (useCache && inflight.has(id)) return inflight.get(id);

    const promise = (async () => {
      try {
        const response = await api[method](url, postData);
        const processed = processFunction(parseResponseFunction(response.data));
        if (useCache) cache.set(id, processed);
        return processed;
      } finally {
        inflight.delete(id);
      }
    })();

    if (useCache) inflight.set(id, promise);

    return promise;
  }

  cachedAPI.clearCache = () => { cache.clear(); inflight.clear(); };

  return cachedAPI;
}

/**
 * Wraps label API response data into a locale-keyed object.
 *
 * @param {*} data - The raw label data from the API.
 * @param {string} locale - The locale code used as the object key.
 * @returns {Object} An object keyed by locale, e.g. `{ en: data }`.
 */
export function processLabels(data, locale) {
  return { [locale]: data };
}

/**
 * Converts a params object into a URI-encoded query string, with optional
 * key remapping and key exclusion.
 *
 * @param {Object} params - Key-value pairs to serialize.
 * @param {Object} [ignore={ locale: true }] - Keys to exclude from the output.
 * @returns {string} A query string like "key1=val1&key2=val2".
 */
export function queryParamsToString(params, ignore = { locale: true }) {
  params = { ...params };

  // map frontend query params to backend expected params if necessary
  const mapped = {
    // iso: "nab.iso",
  };

  // for multiple query params (arrays), see multipleParamToString
  // example: multipleParamToString(params, "type", params.type);

  return Object.keys(params)
    .filter((key) => !ignore[key])
    .map(
      (key) =>
        `${encodeURIComponent(mapped[key] || key)}=${encodeURIComponent(params[key])}`,
    )
    .join("&");
}

/**
 * Expands a comma-separated parameter value into multiple indexed bracket-notation
 * entries for Symfony API Platform compatibility. Mutates `params` in place.
 *
 * @example
 * // { type: "1,2,3" } becomes { "type.id[0]": "1", "type.id[1]": "2", "type.id[2]": "3" }
 *
 * @param {Object} params - The params object (mutated in place).
 * @param {string} paramName - The key whose value should be expanded.
 * @returns {Object} The mutated params object.
 */
export function multipleParamToString(params, paramName) {
  if (params[paramName] && params[paramName].includes(",")) {
    const values = params[paramName].split(",");
    delete params[paramName];
    values.forEach((v, i) => {
      params[`${paramName}.id[${i}]`] = v;
    });
  }
  return params;
}
