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

Not implemented yet, and worth writing down because the licensing is the deciding
factor rather than the code.

- **[Brick Architect](https://brickarchitect.com/parts/)'s black-on-white line drawings
  are the look to aim for, and cannot be used.** The site states "Use of this content
  without permission is prohibited", the images are © Brick Architect LLC, the labels
  ship only as Brother `.lbx` files plus a low-resolution PDF contact sheet, and no
  vector format is offered. The page does say they were made with "custom LDraw
  scripts", which are described as proprietary — and that is the useful part, because it
  names the source.
- **The [LDraw Parts Library](https://ldraw.org/legal-info) is the licence-clean route.**
  It is CC BY (2.0, with a 4.0 migration under way), and LDraw's own legal page states
  that rendered images — "any conversion of a 3D model into a 2D image" — are *not*
  considered derivative works of the parts, and that crediting "The LDraw Parts Library"
  is sufficient in lieu of a full author list. We would credit it regardless.
- **`.dat` files already contain the lines.** LDraw geometry is explicit: line type 2 is
  an edge, type 5 is a conditional edge that draws only when it lies on the silhouette.
  So black-on-white vector art does not need silhouette detection from facets — the
  creases are authored, and the conditional rule is a cheap test. A recursive reader
  (type 1 sub-file references carry a 3×4 transform), an orthographic or isometric
  projection, and an SVG writer is a tractable amount of code.
- **Nothing off the shelf does this.** LDView has an SVG export, but its author says it
  is bad enough that it was never moved out of experimental, and it is disabled by
  default. The three.js route loses outlines under `SVGRenderer`. Existing converters go
  the wrong way (SVG → `.dat`) or to other formats (OpenSCAD, three.js JSON).
- **Meanwhile**, Rebrickable's own part and element images are the pragmatic placeholder:
  colour renders rather than line art, at predictable CDN URLs. `Part.imageUrl` and
  `Element.imageUrl` exist and are empty.

The schema is already ready for the LDraw route: `Part.ldrawId` and
`PartNumberSource::LDraw` are both in place.

## Credits

- Catalogue data from [Rebrickable](https://rebrickable.com/downloads/).
- The vocabulary and inventory conventions follow
  [BrickLink](https://www.bricklink.com/) and
  [New Elementary's glossary](https://www.newelementary.com/p/glossary.html).
- The functional taxonomy and the storage-granularity idea are Tom Alphin's, from
  [Brick Architect](https://brickarchitect.com/).
- LEGO® is a trademark of the LEGO Group, which does not sponsor, authorise or endorse
  this project.
