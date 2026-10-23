# LEGO Catalog

A personal catalogue of LEGO parts, elements, colours, sets and minifigures — and of
which of them I actually own, want, or have used in a build. Single user, runs on
localhost.

The reference data is imported from [Rebrickable](https://rebrickable.com/downloads/)'s
published CSV dumps: about 65,000 parts, 108,000 elements, 28,500 sets, 17,300
minifigures and 1.3 million inventory lines, in roughly a minute.

## The vocabulary, because it is the whole point

| Term | What it is | Example |
| --- | --- | --- |
| **Part** | A *shape*. The mould. No colour. | `3001`, "Brick 2 x 4" |
| **Element** | Part × colour. The piece you can hold. | `3001` in Light Bluish Gray |
| **Design ID** | LEGO's number for the shape, moulded under the studs | `3001` |
| **Element ID** | LEGO's 7-digit number for shape *and* colour | `4211385` |
| **Set** | A boxed product: base number + variant | `10179-1` |
| **Minifig** | Its own catalogue item, with its own parts | `fig-000001` |

A colour belongs to a **family** (hue — Blue, Green, Brown…) and separately has a
**finish** (Solid, Transparent, Chrome, Pearl, Satin, Metallic, Milky, Glitter, Speckle,
Modulex). "Trans-Dark Blue" is family Blue, finish Transparent.

Inventories always reference an **Element**, never a Part: "five of these" is not a
question you can answer until the colour is known.

[docs/DATA-MODEL.md](docs/DATA-MODEL.md) has the full schema and, more usefully, the
reasoning — including what each decision was made *against*.

## Stack

```
backend/    Symfony 7.4 LTS + API Platform 5 + Doctrine (MySQL)
frontend/   Vite + Vue 3 + Tailwind 4
```

`frontend` builds into `backend/public/app/`, so in production a single Symfony server
answers both the API and the SPA. Ports 8000–8003 and 8077 belong to other local
projects; this one uses **8078**.

## Setup

```bash
# Backend
cd backend
composer install
php bin/console doctrine:database:create
php bin/console doctrine:migrations:migrate
php bin/console app:seed                                    # families, taxonomies, sentinels
php -d memory_limit=2G bin/console app:import:rebrickable    # ~1 min, ~18 MB downloaded
php bin/console app:categories:rebuild-paths
php bin/console app:sets:recount
symfony server:start --port=8078 --daemon

# Frontend
cd ../frontend
npm install
npm run dev
```

The order matters: `app:seed` creates the taxonomy the importer files parts into, and
the two rebuild commands fill columns that are derived from what the import just wrote.

## Commands

| Command | What it does |
| --- | --- |
| `app:seed` | Colour families, the three taxonomies, Brick Architect's twelve roots, and the two sentinel rows. Idempotent. |
| `app:import:rebrickable` | Imports the twelve dumps. `--stage=` to run one, `--force-download` to ignore the cache. Every run is recorded as an `ImportRun`. |
| `app:categories:rebuild-paths` | Recomputes `path`/`depth` on part categories, themes and storage locations. |
| `app:sets:recount` | Rebuilds `num_parts`, `num_minifig_parts`, `num_minifigs` and minifigure part counts. |
| `app:colors:classify` | Guesses the colour family for colours that have none. Fills gaps only, unless `--overwrite`. |

## API

API Platform, plain JSON first. Browse it at `http://localhost:8078/api`.

Filters use API Platform 5's `#[QueryParameter]`, so the query-string shapes are:

```
/api/parts?q=3001                       free text over name and every number the part answers to
/api/parts?color=/api/colors/4          every shape made in that colour
/api/parts?categoryPath=bricks          a whole category subtree
/api/parts?sort[name]=asc
/api/elements?q=4211385                 look a LEGO element ID straight up
/api/sets?q=Millennium&year[gte]=2000
/api/set_elements?set=/api/sets/123     one set's inventory, with quantities and roles
```

## Piece counts

`sets.num_parts` counts regular inventory lines only: no spares, and no parts that
arrive inside minifigures. The number printed on the box is `num_parts +
num_minifig_parts`, exposed as `boxPieceCount`. For 75192-1 that comes to 7,541, which
is exactly what the box says.

## Part images

Part drawings come from [Brick Architect](https://brickarchitect.com/parts/), **used with
Tom Alphin's permission**. They are not openly licensed — the site otherwise states that
use of its content without permission is prohibited — so credit him anywhere they appear,
as `PartThumb` and the part page do.

`app:images:brickarchitect` mirrors them:

```bash
php bin/console app:images:brickarchitect --delay=400   # ~20 minutes, polite spacing
```

Notes on how it works and what it covers:

- **Which parts he covers is read from his twelve top-level category pages**, which list
  every part in the guide with its image URL. Twelve requests to learn the whole set,
  rather than probing all 64,901 of our part numbers against his server.
- **The images are mirrored, not hot-linked.** 2,500 requests per page-load is not a
  reasonable thing to do to someone else's server, local copies survive his URLs
  changing, and serving them same-origin avoids referrer and CORS surprises. They land
  in `backend/public/parts/brickarchitect/` (gitignored) and `Part.imageUrl` points at
  them.
- **Coverage is 2,509 drawings over 2,682 of our parts** — 2,368 matched by exact number
  and 314 as mould variants, because he names a part by its base mould number where
  Rebrickable adds a variant letter (his `2412` is our `2412a` and `2412b`; his `973` our
  `973c00`). The drawing is of the mould, so it is true of every variant of it.
- **Against the whole catalogue that is about 4%, but against what you actually browse it
  is about 95%**: of the twenty most-used parts, nineteen have a drawing; of twenty
  random parts, four do. A curated guide covers the parts people handle, not the long
  tail of printed variants and Duplo.
- **Only one size is published**, 170 × 119 PNG. Fine for the grid tiles, soft on a
  high-density display. Worth asking Tom for larger renders, since he generated them.
- The run is resumable: a part already on disk is skipped unless `--force`.

For the long tail the guide does not cover, the licence-clean route is the
[LDraw Parts Library](https://ldraw.org/legal-info) — CC BY, and LDraw's legal page
states that rendered images are not derivative works of the parts. LDraw `.dat` files
carry explicitly authored edge geometry (type 2 edges, type 5 conditional edges), so
true black-on-white vector art is a parser, a projection and an SVG writer rather than a
research project. Nothing off the shelf does it: LDView's SVG export never left
experimental by its author's own account. `Part.ldrawId` and `PartNumberSource::LDraw`
are already in the schema for this.

## Credits

- Catalogue data from [Rebrickable](https://rebrickable.com/downloads/).
- The vocabulary and inventory conventions follow
  [BrickLink](https://www.bricklink.com/) and
  [New Elementary's glossary](https://www.newelementary.com/p/glossary.html).
- Part drawings, the functional taxonomy and the storage-granularity idea are Tom
  Alphin's, from [Brick Architect](https://brickarchitect.com/). The drawings are used
  with his permission and remain his.
- LEGO® is a trademark of the LEGO Group, which does not sponsor, authorise or endorse
  this project.
