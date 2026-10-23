import { legoApi, legoCollectionApi } from "./apis";
import { PER_PAGE } from "@/utils/ids";

/**
 * Every call the SPA makes, in one place.
 *
 * Each function takes (params, query) so it can be handed straight to useLoadData,
 * which passes the route's params and query string through.
 *
 * Reads pass useCache: false, per the rule in CLAUDE.md: the session cache would serve
 * a stale list straight after an edit, which matters as soon as the collection screens
 * can write. Use read() / readCollection() rather than calling legoApi directly.
 *
 * The query-string shapes here are API Platform 5's #[QueryParameter] ones —
 * `sort[name]=asc`, `year[gte]=2000`, relations as IRIs — and not the old
 * `order[name]` / `exists[x]` shapes that #[ApiFilter] produced. If a filter stops
 * working, check the attribute on the entity before reaching for this file.
 */

/** Builds a query string, dropping anything empty so the URL stays readable. */
function qs(parts) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(parts)) {
    if (value === null || value === undefined || value === "") continue;
    search.append(key, value);
  }
  const string = search.toString();
  return string ? `?${string}` : "";
}

/** A GET that is never served from the session cache. */
function read(url, process) {
  return legoApi(url, process, "get", false);
}

/** A paginated GET, returning { items, total } so a pager knows how many pages exist. */
function readCollection(url) {
  return legoCollectionApi(url, undefined, "get", false);
}

/** An entity's IRI from its id, which is how API Platform wants relations filtered. */
function iri(resource, id) {
  return id ? `/api/${resource}/${id}` : null;
}

export default {
  // --- Parts -----------------------------------------------------------------

  /**
   * The parts list. `q` searches the name and every number the part answers to;
   * `family` narrows to shapes that exist in some colour of that family.
   */
  getParts(params = {}, query = {}) {
    return readCollection(
      `/api/parts${qs({
        q: query.q,
        category: iri("part_categories", query.category),
        color: iri("colors", query.color),
        decorated: query.decorated,
        page: query.page || 1,
        itemsPerPage: PER_PAGE.PARTS,
        "sort[number]": query.sort ? undefined : "asc",
        [`sort[${query.sort || "number"}]`]: query.dir || "asc",
      })}`,
    );
  },

  getPart(params = {}) {
    return read(`/api/parts${qs({ number: params.number })}`).then(
      (rows) => rows[0] ?? null,
    );
  },

  /** Every colour a given shape was made in — the part's elements. */
  getPartElements(params = {}, query = {}) {
    return read(
      `/api/elements${qs({
        part: iri("parts", params.id),
        colorFamily: iri("color_families", query.family),
        itemsPerPage: 200,
      })}`,
    );
  },

  // --- Colours ---------------------------------------------------------------

  getColorFamilies() {
    return read("/api/color_families");
  },

  getColors(params = {}, query = {}) {
    return read(
      `/api/colors${qs({
        family: iri("color_families", query.family),
        finish: query.finish,
      })}`,
    );
  },

  // --- Taxonomies and categories --------------------------------------------

  getTaxonomies() {
    return read("/api/taxonomies");
  },

  /** A taxonomy's whole tree; the caller nests it by `path`. */
  getPartCategories(params = {}, query = {}) {
    return read(
      `/api/part_categories${qs({
        taxonomy: iri("taxonomies", query.taxonomy),
      })}`,
    );
  },

  // --- Sets ------------------------------------------------------------------

  getSets(params = {}, query = {}) {
    return readCollection(
      `/api/sets${qs({
        q: query.q,
        theme: iri("themes", query.theme),
        "year[gte]": query.yearFrom,
        "year[lte]": query.yearTo,
        page: query.page || 1,
        itemsPerPage: PER_PAGE.SETS,
      })}`,
    );
  },

  getSet(params = {}) {
    return read(`/api/sets${qs({ number: params.number })}`).then(
      (rows) => rows[0] ?? null,
    );
  },

  /** One set's inventory. Spares come back too, flagged by their role. */
  getSetInventory(params = {}) {
    return read(
      `/api/set_elements${qs({
        set: iri("sets", params.id),
        itemsPerPage: 2000,
      })}`,
    );
  },

  /** The minifigures a set contains, with quantities. */
  getSetMinifigs(params = {}) {
    return read(
      `/api/set_minifigs${qs({ set: iri("sets", params.id), itemsPerPage: 200 })}`,
    );
  },

  /** Sets packaged inside this one. */
  getSetSubsets(params = {}) {
    return read(
      `/api/set_subsets${qs({ set: iri("sets", params.id), itemsPerPage: 200 })}`,
    );
  },

  getThemes() {
    return read("/api/themes");
  },
};
