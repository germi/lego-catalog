import { legoApi } from "./apis";

/**
 * Every call the SPA makes, in one place.
 *
 * Each function takes (params, query) so it can be handed straight to useLoadData,
 * which passes the route's params and query string through.
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

/** An entity's IRI from its id, which is how API Platform wants relations filtered. */
function iri(resource, id) {
  return id ? `/api/${resource}/${id}` : null;
}

const PARTS_PER_PAGE = 60;

export default {
  // --- Parts -----------------------------------------------------------------

  /**
   * The parts list. `q` searches the name and every number the part answers to;
   * `family` narrows to shapes that exist in some colour of that family.
   */
  getParts(params = {}, query = {}) {
    return legoApi(
      `/api/parts${qs({
        q: query.q,
        category: iri("part_categories", query.category),
        color: iri("colors", query.color),
        decorated: query.decorated,
        page: query.page || 1,
        itemsPerPage: PARTS_PER_PAGE,
        "sort[number]": query.sort ? undefined : "asc",
        [`sort[${query.sort || "number"}]`]: query.dir || "asc",
      })}`,
    );
  },

  getPart(params = {}) {
    return legoApi(`/api/parts${qs({ number: params.number })}`).then(
      (rows) => rows[0] ?? null,
    );
  },

  /** Every colour a given shape was made in — the part's elements. */
  getPartElements(params = {}, query = {}) {
    return legoApi(
      `/api/elements${qs({
        part: iri("parts", params.id),
        colorFamily: iri("color_families", query.family),
        itemsPerPage: 200,
      })}`,
    );
  },

  // --- Colours ---------------------------------------------------------------

  getColorFamilies() {
    return legoApi("/api/color_families");
  },

  getColors(params = {}, query = {}) {
    return legoApi(
      `/api/colors${qs({
        family: iri("color_families", query.family),
        finish: query.finish,
      })}`,
    );
  },

  // --- Taxonomies and categories --------------------------------------------

  getTaxonomies() {
    return legoApi("/api/taxonomies");
  },

  /** A taxonomy's whole tree; the caller nests it by `path`. */
  getPartCategories(params = {}, query = {}) {
    return legoApi(
      `/api/part_categories${qs({
        taxonomy: iri("taxonomies", query.taxonomy),
      })}`,
    );
  },

  // --- Sets ------------------------------------------------------------------

  getSets(params = {}, query = {}) {
    return legoApi(
      `/api/sets${qs({
        q: query.q,
        theme: iri("themes", query.theme),
        "year[gte]": query.yearFrom,
        "year[lte]": query.yearTo,
        page: query.page || 1,
        itemsPerPage: 48,
      })}`,
    );
  },

  getSet(params = {}) {
    return legoApi(`/api/sets${qs({ number: params.number })}`).then(
      (rows) => rows[0] ?? null,
    );
  },

  /** One set's inventory. Spares come back too, flagged by their role. */
  getSetInventory(params = {}) {
    return legoApi(
      `/api/set_elements${qs({
        set: iri("sets", params.id),
        itemsPerPage: 2000,
      })}`,
    );
  },

  /** The minifigures a set contains, with quantities. */
  getSetMinifigs(params = {}) {
    return legoApi(
      `/api/set_minifigs${qs({ set: iri("sets", params.id), itemsPerPage: 200 })}`,
    );
  },

  /** Sets packaged inside this one. */
  getSetSubsets(params = {}) {
    return legoApi(
      `/api/set_subsets${qs({ set: iri("sets", params.id), itemsPerPage: 200 })}`,
    );
  },

  getThemes() {
    return legoApi("/api/themes");
  },
};
