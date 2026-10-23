# CLAUDE.md

Context for Claude Code working in this repository.

## What this is

A personal LEGO catalogue: a Symfony + API Platform backend holding parts, elements,
colours, sets and minifigures imported from Rebrickable, plus what of it I actually own,
want, and have built. A Vue 3 SPA browses it. Single user, runs on localhost.
See [README.md](README.md) for the full picture and
[docs/DATA-MODEL.md](docs/DATA-MODEL.md) for the schema and its reasoning.

## Layout

```
backend/    Symfony 7.4 LTS + API Platform 5 + Doctrine (MySQL)
frontend/   Vite + Vue 3 + Tailwind 4, started from OneTandem/ot-starter-template
```

`frontend` builds into `backend/public/app/` (gitignored), so in production one Symfony
server answers both the API and the SPA.

## Running

Ports 8000–8003 and 8077 are taken by other local projects, so this one uses **8078**.

```bash
cd backend  && symfony server:start --port=8078 --daemon
cd frontend && npm run dev
```

**Where the UI actually is.** Two different things serve it:

- `npm run dev` — Vite, with hot reload. It prints the port it settled on; 5173–5175 are
  usually taken by other local projects, so it is often 5176. This is the one to use
  while working.
- `http://localhost:8078/app/` — the built bundle, which only exists after
  `npm run build`. `http://localhost:8078/` redirects here, and says so when there is no
  build yet.

The API is on 8078 either way; `.env.development` points the dev server at it, and CORS
allows localhost on any port.

First run, in order — the importer needs the seeded taxonomy to file parts into:

```bash
cd backend
php bin/console doctrine:migrations:migrate
php bin/console app:seed
php -d memory_limit=2G bin/console app:import:rebrickable   # ~1 minute
php bin/console app:categories:rebuild-paths
php bin/console app:sets:recount
```

## The one thing to get right

**Part is a shape. Element is a shape in a colour.** Part `3001` is "Brick 2 x 4";
element `4211385` is that brick in Light Bluish Gray. Inventories — sets, minifigures,
MOCs, what you own — always reference an Element, never a Part, because a quantity is
meaningless until the colour is pinned down. Everything else in the schema follows from
this.

## Things worth knowing before changing code

- **A print is a separate Part, not a property of an Element.** The decorated head is
  `3626cpb0001`, the plain mould is `3626c`, joined by a `part_relationship` of type
  `print`. Both BrickLink and Rebrickable work this way, and it is right: a print then
  exists in its own set of colours, which a colour attribute could not express.
- **Colour has two orthogonal axes**, `family` (hue) and `finish`. "Trans-Dark Blue" is
  family Blue, finish Transparent. One field each. `ColorClassifier` reads both out of
  the name, because Rebrickable publishes neither; it returns null for a family rather
  than guessing when the name names no hue (Trans-Clear, [Unknown], Glow In Dark).
- **There is no single category tree, and that is why `taxonomy` exists.** BrickLink
  classifies by shape, Brick Architect by what you build with the part, Rebrickable by
  its own flat list of 65. A part gets at most one category *per taxonomy*. Do not
  collapse this back to a single `part.category_id` — `primaryCategory` is only a
  denormalised pointer into the default taxonomy, and the assignments are the truth.
- **`sets.num_parts` excludes spares *and* minifigure parts.** The number on the box is
  `num_parts + num_minifig_parts`, which is `getBoxPieceCount()`. This reconciles exactly:
  75192-1 comes to 7,541, which is what the box says. Both columns are rebuilt by
  `app:sets:recount`; don't hand-edit either.
- **Rebrickable writes booleans as `True`/`False`, not `t`/`f`.** Reading only `t` filed
  every spare as a regular line, where it collided with the real regular line on the
  unique key and overwrote its quantity — a 4% undercount on every large set. Use
  `RebrickableImporter::truthy()` for any new boolean column.
- **The importer's upsert update-lists are deliberately narrow.** `color.family_id` and
  `color.name` are inserted but never updated, so a correction made by hand survives a
  re-import. The cost is that improving the classifier does not reach existing rows,
  which is what `app:colors:classify` is for — it only ever fills a gap.
- **The importer never deletes.** A part that drops out of a dump stays in the
  catalogue, because it did not stop existing in the real world.
- **`path` and `depth` on the three trees are derived, and `rebuildPath()` is not a
  lifecycle callback** — moving a node has to update its whole subtree, which an entity
  cannot see from the inside. Run `app:categories:rebuild-paths` after anything that
  reparents.
- **Sentinel rows, not nullable FKs**, in two places: colour `not-applicable` and storage
  location `unsorted`. MySQL does not enforce uniqueness across NULLs, so a nullable FK
  inside a unique constraint silently permits duplicates. `app:seed` creates both.
- **Money and measurements are `DOUBLE`, deliberately** — same decision and same reason
  as the price tracker's `Product`: Doctrine maps `DECIMAL` to a PHP `string`, which
  reaches the Serializer through PropertyInfo and makes it reject a JSON number on write.
- **Filters are `#[QueryParameter]`, never `#[ApiFilter]`.** `ApiFilter` has been
  deprecated since API Platform 4.4 and is due for removal in 6.0; the price tracker
  carries that debt and this project deliberately never takes it on. Two traps:
  `FreeTextQueryFilter` ANDs its sub-filters together unless you wrap them in
  `OrFilter`, and the filter needs its properties in its *own* constructor as well as on
  the parameter.
- **Don't put a resource's own read group on a relation that points back at it.**
  `PartRelationship` points at `Part` on both sides; tagging those with `part:read` made
  the serializer and the eager loader walk Part → relationship → Part without end (a
  500 from `EagerLoadingExtension`). `Part::getRelatedParts()` flattens them instead.
- **Reserved words**: the sets table is `` `sets` `` (`SET` is a MySQL keyword, though
  the *class* `Set` is fine); `WantedList` not `List` (reserved in PHP, same trap as the
  tracker's `ProductList`); `item_condition` not `condition` (reserved in MySQL).
- **All visible text goes through `OTText`**, never a bare string:
  `<OTText value="SECTION.KEY" />`, with the Catalan text in
  `frontend/src/locales/ca.json` under hierarchical keys. Attributes that cannot hold a
  component use `t("KEY")`. Every new key must be added to the locale file in the same
  change — a key that exists in code but not in `ca.json` renders as the key itself. See
  `frontend/docs/LANGUAGE-SYSTEM.md`. Part names, colour names, set names and numbers are
  **data, not labels**, and are shown exactly as the catalogues wrote them.
- **Never edit `frontend/src/components/sidecharts/`** — it is a vendored copy,
  overwritten by `npm run update-sidecharts`. Project-specific layers belong in
  `src/components/`. See `frontend/docs/SIDECHARTS.md`.
- **Timestamps are UTC** everywhere in the backend; the SPA formats to local time.
- **PHP casts numeric-looking array keys to `int`.** Part numbers are strings that often
  look like integers, so `$map[$part->getNumber()]` then yields an `int` back out of
  `array_keys()` or `foreach`, and the next `strlen()` fatals. This bit twice while
  writing the image importer. Iterate values and read the number off the entity, or cast
  back explicitly.

## Known gaps

- **Minifigure numbers are Rebrickable's `fig-000001`, not BrickLink's `sw0001`.** The
  dumps do not carry BrickLink's, so a BrickLink number cannot be looked up yet. Parts
  have `part_number` for exactly this; minifigures would need the equivalent.
- **Part images cover about 4% of parts, but about 95% of what you browse.** They are
  Brick Architect's drawings, used with Tom Alphin's permission and *not* openly
  licensed — credit him anywhere they appear. `app:images:brickarchitect` mirrors them;
  the long tail would need the LDraw route. See the Part images section of
  [README.md](README.md).
- **No BrickLink or Brick Architect category assignments.** Both taxonomies exist and
  Brick Architect's twelve roots are seeded, but only the Rebrickable tree is populated,
  because only it ships as data.

## Checks

```bash
cd backend
php bin/console doctrine:schema:validate
php bin/console app:import:rebrickable --stage=colors   # smallest end-to-end import
cd ../frontend && npm run build
```
