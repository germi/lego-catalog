# Data model

The vocabulary and the reasoning behind the schema. If you are about to change a table,
read the section for it first — most of these choices were made against a specific
alternative, and the alternative is written down.

## Vocabulary

The catalogues agree on a three-way distinction, and the whole schema turns on it.

| Term | What it is | Example |
| --- | --- | --- |
| **Part** (mould, design) | A *shape*. No colour. | `3001`, "Brick 2 x 4" |
| **Element** | Part × colour. The piece you can hold. | `3001` in Red |
| **Design ID** | LEGO's number for the shape, moulded under the studs | `3001` |
| **Element ID** | LEGO's 7-digit number for shape *and* colour | `300121`, `4211385` |
| **Set** | A boxed product, base number + variant | `10179-1` |
| **Minifig** | Its own catalogue item, with its own parts | `sw0001` |

Two consequences that are easy to get wrong:

- **A print is a separate Part, not a property of an Element.** The decorated head is
  `3626cpb0001` and the plain mould is `3626c`, joined by a `part_relationship` of type
  `print`. This is BrickLink's model and Rebrickable's, and it is right: the print then
  exists in its own set of colours, which a colour attribute on an element could not
  express.
- **Colour has two orthogonal axes.** A *family* (hue: Blue, Green, Brown…) and a
  *finish* (Solid, Transparent, Chrome, Pearl, Satin, Metallic, Milky, Glitter, Speckle,
  Modulex). "Trans-Dark Blue" is family Blue, finish Transparent. One field each, never
  one field for both.

## There is no single category tree

This is the reason `taxonomy` exists, and it is the thing most likely to be mistaken for
over-engineering.

Three public catalogues classify parts, and all three disagree:

- **BrickLink** classifies by shape name — `Brick`, `Brick, Modified`,
  `Brick, Modified, Decorated`. Over 200 entries, and its own tree is *flat*: the
  hierarchy is faked with commas in the name.
- **Brick Architect** classifies by what you build with the part — twelve categories,
  `BASIC`, `WALL`, `SNOT`, `ANGLE`, `CURVE`, `VEHICLE`, `MINIFIG`, `NATURE`, `TECHNIC`,
  `ELECTRONICS`, `ARTICULATION`, `DUPLO`, each with its own code.
- **Rebrickable** keeps a flat list of about 65 of its own, matching neither.

A 1 × 2 brick with studs on the side is `Brick, Modified` to the first and `SNOT` to the
second. Neither is wrong; they answer different questions. So:

- `part_category` belongs to a `taxonomy` and has a real `parent_id` tree, even where the
  source is flat — we parse the intent into a hierarchy because that is what is good to
  browse.
- `part_category_assignment` gives a part **at most one category per taxonomy**, and lets
  it sit in every taxonomy at once. The unique constraint is on
  `(part_id, taxonomy_id)`, which is why that table carries a denormalised `taxonomy_id`:
  the database cannot enforce the rule through a join.
- `part.primary_category_id` is a denormalised pointer to the category in the *default*
  taxonomy, so the common parts list needs no join. The assignments are the truth.

## Hierarchies

`part_category`, `theme` and `storage_location` are all the same shape: `parent_id` is
the truth, and `path` (`brick/modified/decorated`) plus `depth` are derived. The path is
there so that "everything under Brick" is one indexed `LIKE 'brick/%'` instead of a
recursive walk.

`rebuildPath()` recomputes both. It is **not** a lifecycle callback, deliberately:
moving a node has to update its entire subtree, which an entity cannot see from the
inside. `app:categories:rebuild-paths` does all three trees, shallowest first. Anything
that reparents a node must run it afterwards.

## Inventories

`set_element` is the "x5, x6" of a parts list: a set, an element, a quantity. It points
at an Element and never at a Part, because a quantity is only meaningful once the colour
is pinned down. `minifig_element` and `set_minifig` are the same shape.

`role` is BrickLink's inventory vocabulary:

- `regular` — part of the model.
- `spare` — BrickLink's "Extra". Real pieces in the bag, but **not part of the model**,
  and so excluded from `sets.num_parts`. Including them makes the count disagree with
  the box.
- `counterpart` — a part with a sticker applied.
- `alternate` — differs between official releases of the same kit.

`match_group` is BrickLink's match ID. Regular lines sit in group `0`; an alternate line
carries the same non-zero group as the line it can stand in for, which is the only way
to say "this kit shipped either of these two" without inventing a second inventory. It
defaults to `0` rather than being nullable, because MySQL treats every NULL as distinct
and the unique constraint would stop working.

## Sentinel rows, not nullable columns

Two places use a well-known row instead of a nullable foreign key, for the same reason:
MySQL does not enforce uniqueness across rows where a column is NULL, so a nullable FK
inside a unique constraint silently permits duplicates.

- `color` slug `not-applicable` — for parts with no colour of their own, such as sticker
  sheets. Keeps `element`'s `(part_id, color_id)` unique constraint real. Rebrickable's
  own "[No Color/Any Color]" is folded into this row on import.
- `storage_location` slug `unsorted` — `owned_element` requires a location, so anything
  unfiled goes here rather than to NULL, and
  `(element_id, item_condition, storage_location_id)` stays enforceable.

Both are created by `app:seed`, which is idempotent.

## Storage granularity

`storage_location.granularity` follows Brick Architect's progression: no organisation,
then by group, then by part, then by part *and colour* — "which is to say, by element".
A drawer labelled "1x Plates" is `category`; a drawer of red 2 × 4s is `element`. The
matching nullable `for_*` pointer says what the bin is *for*, so a label can be checked
against its contents.

His other finding — sort by shape, not by colour, because a part in the wrong colour is
still easy to spot — is a UI default, not a schema fact: part-first browse, colour as a
facet.

## Floats, not DECIMAL

Weights, stud dimensions and every money column are `DOUBLE`. This is the same decision
as the price tracker's, for the same reason: Doctrine maps `DECIMAL` to a PHP `string`,
that string type reaches the Serializer through PropertyInfo, and the Serializer then
refuses a JSON number on write. These are measurements and prices to display, sort and
compare — never summed into a ledger — so a double is accurate enough and the API keeps
returning plain numbers. Do not "fix" them to DECIMAL without also solving that.

## Reserved words

- The sets table is `` `sets` ``, not `set`: `SET` is a MySQL keyword. The *class* is
  `Set`, which is fine — PHP does not reserve it.
- `WantedList`, not `List`: that one *is* reserved in PHP. Same trap as the tracker's
  `ProductList`.
- `owned_element.item_condition` and `owned_set.item_condition`: `CONDITION` is reserved
  in MySQL.

## One CHECK constraint

`wanted_line` points at exactly one of element, set or minifig — three nullable FKs
rather than three near-identical tables, because it is one list in the UI. "Exactly one"
is enforced twice: a `CHECK` constraint added by hand in the migration (Doctrine's
mapping cannot express it) so a direct SQL insert stays honest, and an `Assert\Callback`
so the API fails with a readable message instead of a driver error.

## What is derived, and what rebuilds it

| Column | Rebuilt by |
| --- | --- |
| `part_category.path`, `.depth` | `app:categories:rebuild-paths` |
| `theme.path`, `.depth` | same |
| `storage_location.path`, `.depth` | same |
| `part.primary_category_id` | the importer, from the default taxonomy |
| `part.is_decorated` | the importer, from `print`/`pattern` relationships |
| `sets.num_parts`, `.num_minifigs` | `app:sets:recount` |
| `minifig.num_parts` | same |
| `color.family_id` | `app:colors:classify` (fills gaps only) |

## Import

`app:import:rebrickable` reads the twelve published CSV dumps. Notes that matter:

- Every write is an upsert on a natural unique key, so a re-import updates in place and
  an interrupted run can simply be repeated.
- **Nothing is ever deleted.** A part that disappears from a dump stays in the
  catalogue, because it did not stop existing in the real world.
- The upsert's update list is deliberately narrow. `color.family_id` and `color.name`,
  for instance, are inserted but never updated, so a correction made by hand survives a
  re-import. The cost is that improving the classifier does not reach existing rows —
  hence `app:colors:classify`, which only fills gaps.
- Rebrickable versions its inventories and keeps minifigure part lists in the same table
  as set ones, told apart only by whether the number names a set or a figure. We keep the
  highest version of each and record which on `sets.inventory_version`.
- Element ids have to be read back before element codes can be written, and the full
  `(part, colour) → id` map is far too large to hold for a 1.9-million-row file. So it is
  rebuilt per 20,000-row chunk, for that chunk's pairs only.
- An inventory can name a `(part, colour)` that the elements file never listed. The set
  is evidence enough that the combination exists, so the element row is created.

## Query parameters, not ApiFilter

This project uses API Platform 5's `#[QueryParameter]` with the new filter classes
(`ExactFilter`, `PartialSearchFilter`, `IriFilter`, `SortFilter`, `BackedEnumFilter`,
`RangeFilter`, `FreeTextQueryFilter`) from the start.

`#[ApiFilter]` has been deprecated since API Platform 4.4 and is due for removal in 6.0.
The price tracker still carries that debt and migrating it would change its whole
query-string shape, so this project simply never takes it on. The shapes here are
`?sort[name]=asc`, `?q=brick`, `?color=/api/colors/4`.
