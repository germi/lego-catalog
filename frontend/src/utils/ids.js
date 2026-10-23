export const ID = "ID";

/**
 * Inventory line roles, as the backend's InventoryRole enum serialises them.
 *
 * BrickLink's vocabulary: a spare is a real piece in the bag that is not part of the
 * model, a counterpart is a part with a sticker applied, an alternate differs between
 * official releases of the same kit.
 */
export const ROLE = {
  REGULAR: "regular",
  SPARE: "spare",
  COUNTERPART: "counterpart",
  ALTERNATE: "alternate",
};

/** What a wanted line points at, from WantedLine::getTargetType(). */
export const WANTED_TARGET = {
  ELEMENT: "element",
  SET: "set",
  MINIFIG: "minifig",
};

/** Taxonomy slugs seeded by app:seed. */
export const TAXONOMY = {
  REBRICKABLE: "rebrickable",
  BRICKLINK: "bricklink",
  BRICK_ARCHITECT: "brick-architect",
};

/** Page sizes, matching paginationItemsPerPage on the API resources. */
export const PER_PAGE = {
  PARTS: 60,
  SETS: 48,
};
