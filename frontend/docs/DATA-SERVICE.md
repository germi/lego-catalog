# Data Service

This folder provides a layered system for defining and consuming API endpoints across the app.

```
apiFactory.js         ← factory functions & utilities (never touch)
apis.js               ← shared API client instances
language.js           ← built-in label/translation endpoints
data.js               ← YOUR endpoints go here

../functions/
  useLoadData.js      ← Vue composable that calls data.js endpoints in components
```

### Setup order

When starting a project, work through these two files in order:

1. **`apis.js`** — configure your API clients: adjust the CSV delimiter, set base URLs, or define which of `localApi` / `externalApi` / `googleSheetsApi` you'll use.
2. **`data.js`** — add your actual endpoints (data consumers) once the clients are ready.

Both files are yours to modify freely.

---

## data.js — where you work

This is the only file you need to edit day-to-day. Add your project endpoints here.

```js
import { localApi, externalApi } from "./apis";
import { queryParamsToString } from "./apiFactory";
import language from "./language";

export default {
  ...language, // built-in label endpoints, keep unless unused

  // Fetch a local CSV from /public/data/
  async getData() {
    return await localApi(`/data.csv`);
  },

  // Fetch with a per-endpoint transform applied before caching
  async getProjects() {
    return await localApi(`/projects.csv`, processProjects);
  },

  // Fetch from the external backend
  async getItems(params) {
    return await externalApi(`/items?${queryParamsToString(params)}`);
  },

  // POST to the external backend (no cache)
  async createItem(_, __, data) {
    return await externalApi(`/items`, undefined, "post", false, data);
  },
};
```

The exported object is what the rest of the app imports via `import data from "@/services/data"`.

---

## apis.js — API client instances

Defines and exports the pre-configured axios-backed clients. Edit this file when you need to:

- Change the base URL of an existing client
- Add a new client for a different backend or data source
- Change the auth strategy (e.g. swap Bearer token for an API key)

`apiConfigure` — the Bearer-token auth helper — lives here (not in `apiFactory.js`) so you can adapt it per-project without touching the factory.

```js
// Add a new unauthenticated JSON API client
import { createCachedAPI } from "./apiFactory";

export const publicApi = createCachedAPI("https://api.example.com/v1");
```

Available out of the box:

| Client            | Base URL                | Parse                     | Auth         |
| ----------------- | ----------------------- | ------------------------- | ------------ |
| `externalApi`     | `VITE_API_URL` + `/api` | none (JSON)               | Bearer token |
| `localApi`        | `/public/data`          | comma CSV + d3 `autoType` | none         |
| `googleSheetsApi` | _(full URL per call)_   | CSV → JSON                | none         |

---

## language.js — label/translation endpoints

Contains the built-in endpoints for fetching UI labels:

- `getLabels(params)` — fetches labels for a locale from the external API
- `postLabels(_, __, data)` — imports labels via POST
- `getLabelsFromGSheets()` — fetches labels from a published Google Sheet

These are spread into `data.js` automatically via `...language`. If your project doesn't use labels, remove that line.

To add a locale, add a URL entry to `sheetUrls` inside `getLabelsFromGSheets` and update the destructuring.

---

## apiFactory.js — building blocks

Contains the factory and utilities. You shouldn't need to modify this file, but you'll import from it when creating new clients or writing endpoints.

### `createCachedAPI(baseURL, parseResponseFunction, configureApi)`

Creates a cached axios-backed request function.

```js
const myApi = createCachedAPI(
  "https://api.example.com",
  parseResponseFunction, // runs once on the raw response body
  configureApi,          // receives the axios instance for setup
);

// Call it per endpoint:
const data = await myApi(
  "/endpoint",           // path
  processFunction,       // runs on the parsed result
  "get",                 // HTTP method
  true,                  // use cache?
  postData,              // body for POST/PUT
);

// Bust the cache when needed:
myApi.clearCache();
```

#### Caching pipeline

The two transform functions run in sequence, and their **combined output is what gets stored in the cache**:

```
raw response
  → parseResponseFunction   (set at client creation — e.g. CSV parsing, autoType)
  → processFunction         (set per call — e.g. data cleanup, backfilling nulls)
  → cached result
```

This means any per-endpoint preprocessing (backfilling, filtering, shaping) only runs once — subsequent calls return the already-processed data directly from cache.

#### Inflight deduplication

Each API client maintains two internal Maps:

- **`cache`** — stores resolved values, keyed by `"method url"`. Hit on every subsequent call after the first resolves.
- **`inflight`** — stores in-flight Promises, keyed the same way. Hit when a second call arrives while the first is still awaiting a response.

```
Component A mounts → cache: miss, inflight: miss → fires fetch, stores Promise in inflight
Component B mounts → cache: miss, inflight: HIT  → returns the same Promise (no new request)
Fetch resolves     → result written to cache, Promise removed from inflight
Both A and B resolve with the same data — one network request total
```

On failure: `inflight` is cleaned up via `finally`, so neither caller caches the error and a later retry will attempt a fresh request.

When `useCache: false` (e.g. POST endpoints): both Maps are bypassed entirely — every call fires its own request, which is the correct behaviour for mutations.

**`parseResponseFunction` examples:**

```js
// Comma-delimited CSV with auto type coercion (current localApi setup)
import { dsvFormat, autoType } from "d3";
const csvParse = dsvFormat(",");
const api = createCachedAPI(baseURL, (data) => csvParse.parse(data, autoType));

// Convert CSV to nested JSON (built-in util)
import { csvToJson } from "@/utils/csvJsonUtils";
const api = createCachedAPI(baseURL, csvToJson);
```

**`configureApi` examples:**

```js
// Bearer token from localStorage — use the apiConfigure defined in apis.js
// (pass it as the third argument when creating a new authenticated client)

// Static API key header
function withApiKey(axiosInstance) {
  axiosInstance.interceptors.request.use((config) => {
    config.headers["X-API-Key"] = import.meta.env.VITE_API_KEY;
    return config;
  });
}
const api = createCachedAPI(baseURL, undefined, withApiKey);

// Basic auth
function withBasicAuth(axiosInstance) {
  axiosInstance.defaults.auth = {
    username: import.meta.env.VITE_API_USER,
    password: import.meta.env.VITE_API_PASS,
  };
}
```

### `queryParamsToString(params, ignore?)`

Serializes a params object to a query string, skipping `locale` by default.

```js
queryParamsToString({ year: 2024, type: "a", locale: "en" })
// → "year=2024&type=a"
```

To remap a frontend key to a different backend key, add it to the `mapped` object inside the function.

### `multipleParamToString(params, paramName)`

Expands a comma-separated value into Symfony API Platform bracket notation. Mutates `params` in place.

```js
multipleParamToString({ type: "1,2,3" }, "type")
// → { "type.id[0]": "1", "type.id[1]": "2", "type.id[2]": "3" }
```

Use it inside `queryParamsToString` before the return:

```js
multipleParamToString(params, "type");
```

---

## useLoadData — loading data in components

`src/functions/useLoadData.js` is the Vue composable that bridges page components and the data service. It handles loading state, error state, and automatic reloads based on route changes.

### Signature

```js
useLoadData(
  endpoint,     // string   — name of the method to call on the data service
  initialValue, // any      — starting value of data before the first load (default: [])
  resetData,    // boolean  — reset data to initialValue on every load (default: false)
  params,       // ref      — custom params to pass; falls back to route.params if null (default: ref(null))
  loadOnMount,  // boolean  — call loadData automatically when the component mounts (default: true)
  useWatchers,  // boolean  — enable the built-in route.name watcher (default: true)
  customWatch,  // ref      — an additional reactive value to watch; reloads when it changes (default: ref(null))
)
```

### What it returns

```js
const { data, loading, error, loadData } = useLoadData(...)
```

|                       |                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `data`                | `ref` — the result from the endpoint, starts at `initialValue`                                |
| `loading`             | `ref<boolean>` — true while the request is in flight (with a 200ms debounce to avoid flicker) |
| `error`               | `ref` — false normally, holds the caught error if the request fails                           |
| `loadData(postData?)` | async function — trigger a reload manually; pass a body for POST endpoints                    |

### How each endpoint is called

Every endpoint in `data.js` receives three arguments automatically:

```js
api[endpoint](params, route.query, postData)
//            ↑               ↑          ↑
//  route.params or        current    optional body
//  custom params ref      query      from loadData()
```

So endpoint methods in `data.js` should follow this signature:

```js
async getItems(params, query, postData) { ... }
```

### Basic usage

```vue
<script setup>
import useLoadData from "@/functions/useLoadData";

const { data, loading, error } = useLoadData("getData");
</script>

<template>
  <div v-if="loading">Loading…</div>
  <div v-else-if="error">Something went wrong.</div>
  <ul v-else>
    <li v-for="item in data" :key="item.id">{{ item.name }}</li>
  </ul>
</template>
```

### Reloading when a route param changes

The built-in watcher only watches `route.name`, so navigating between pages triggers a reload — but changing a param on the same route (e.g. `/country/fr` → `/country/de`) does not.

Use `customWatch` for that:

```vue
<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import useLoadData from "@/functions/useLoadData";

const route = useRoute();

// Watch the :iso param as a string to avoid reloading on every object reference change
const iso = computed(() => route.params.iso);

const { data, loading } = useLoadData(
  "getCountryData", // endpoint
  [],               // initialValue
  true,             // resetData — clear stale data between countries
  ref(null),        // params — use route.params automatically
  true,             // loadOnMount
  false,            // useWatchers — disable the route.name watcher (same route, different param)
  iso,              // customWatch — reload whenever :iso changes
);
</script>
```

> Tip: pass `resetData: true` when using `customWatch` on a param, otherwise the previous country's data stays visible while the new one loads.

### Manual trigger / POST

For actions that shouldn't fire on mount (forms, buttons):

```vue
<script setup>
import useLoadData from "@/functions/useLoadData";

const { loading, error, loadData } = useLoadData(
  "createItem",
  null,
  false,
  ref(null),
  false, // don't load on mount
);

async function submit(formData) {
  await loadData(formData); // formData is passed as the POST body
}
</script>
```

### Watching params or query deeply

If you need to reload when route params or query change — but want to avoid spurious reloads — compare them as strings:

```js
const paramsKey = computed(() => JSON.stringify(route.params));
const { data } = useLoadData("getItems", [], false, ref(null), true, false, paramsKey);
```

This triggers only when the serialized params actually differ, not on every route object update.
