# Font Awesome Pro — Setup Guide

This project supports Font Awesome Pro via the official Vue component. Follow these steps after cloning the repo or setting up a new project from this template.

---

## 1. Configure the Pro token

Font Awesome Pro packages are hosted on a private npm registry. The token is read from an environment variable so the same `.npmrc` works locally and on Netlify without ever committing a secret.

### Step 1 — Set the environment variable

Locally, add it to your `.env` file (which should be in `.gitignore`):

```
FONT_AWESOME_TOKEN=your_token_here
```

On Netlify, go to **Site configuration → Environment variables** and add the same key/value.

You can find your token at [fontawesome.com](https://fontawesome.com) → Account → Tokens.

### Step 2 — Verify `.npmrc`

A `.npmrc` file is already included at the project root. Make sure it contains:

```
@fortawesome:registry=https://npm.fontawesome.com/
//npm.fontawesome.com/:_authToken=${FONT_AWESOME_TOKEN}
```

This file is **safe to commit** — it contains no secret, only the variable name. npm expands `${FONT_AWESOME_TOKEN}` automatically during `npm install`.

---

## 2. Install the packages

Install the Vue component, the SVG core, and whichever icon sets you need:

```bash
npm install @fortawesome/vue-fontawesome @fortawesome/fontawesome-svg-core
```

Then add the Pro icon sets you want to use:

```bash
# Solid, Regular, Light, Thin, Duotone — pick the ones you need
npm install @fortawesome/pro-solid-svg-icons
npm install @fortawesome/pro-regular-svg-icons
npm install @fortawesome/pro-light-svg-icons
npm install @fortawesome/pro-thin-svg-icons
npm install @fortawesome/pro-duotone-svg-icons

# Free icon sets (no token needed, but install after the pro ones)
npm install @fortawesome/free-solid-svg-icons
npm install @fortawesome/free-brands-svg-icons
```

---

## 3. Register in `main.js`

Add the library and the `FontAwesomeIcon` component globally in [src/main.js](../src/main.js):

```js
import { library } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

// Import the specific icons you need — tree-shaking keeps the bundle small
import {
  faArrowRight,
  faChevronDown,
} from "@fortawesome/pro-regular-svg-icons";
import { faCircleCheck } from "@fortawesome/pro-solid-svg-icons";

// Add them to the library
library.add(faArrowRight, faChevronDown, faCircleCheck);

// Register the component globally
app.component("FontAwesomeIcon", FontAwesomeIcon);
```

Place the imports near the top of `main.js` and the `app.component()` call **before** `app.mount()`.

### Tip — Centralise icon imports

As the icon list grows, move library setup to its own file:

```
src/utils/icons.js
```

```js
// src/utils/icons.js
import { library } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowRight,
  faChevronDown,
} from "@fortawesome/pro-regular-svg-icons";
import { faCircleCheck } from "@fortawesome/pro-solid-svg-icons";

library.add(faArrowRight, faChevronDown, faCircleCheck);
```

Then in `main.js`:

```js
import "./utils/icons.js";
```

---

## 4. Use icons in templates

```vue
<!-- Basic usage -->
<FontAwesomeIcon icon="arrow-right" />

<!-- Specify the style prefix (fas, far, fal, fat, fad) -->
<FontAwesomeIcon :icon="['far', 'chevron-down']" />
<FontAwesomeIcon :icon="['fas', 'circle-check']" />

<!-- Size -->
<FontAwesomeIcon icon="arrow-right" size="lg" />
<FontAwesomeIcon icon="arrow-right" size="2xl" />

<!-- Fixed width (useful in lists / sidebars) -->
<FontAwesomeIcon icon="arrow-right" fixed-width />

<!-- Spin / pulse animation -->
<FontAwesomeIcon icon="spinner" spin />

<!-- Accessible label -->
<FontAwesomeIcon icon="arrow-right" aria-label="Continue" />

<!-- Decorative (hidden from screen readers) -->
<FontAwesomeIcon icon="arrow-right" aria-hidden="true" />
```

### Style prefixes

| Prefix | Package                 |
| ------ | ----------------------- |
| `fas`  | `pro-solid-svg-icons`   |
| `far`  | `pro-regular-svg-icons` |
| `fal`  | `pro-light-svg-icons`   |
| `fat`  | `pro-thin-svg-icons`    |
| `fad`  | `pro-duotone-svg-icons` |
| `fab`  | `free-brands-svg-icons` |

When only one icon set is used, the prefix can be omitted and Font Awesome will infer it from the library.

---

## Deploying to Netlify

If you followed step 1 above, Netlify works without any extra configuration. Just add `FONT_AWESOME_TOKEN` to **Site configuration → Environment variables** with the same token value you use locally. The `.npmrc` in the repo already reads from that variable, so `npm install` will authenticate correctly during the build.

---

## Using only free icons (no token needed)

If the project doesn't require Pro icons, you can skip the token entirely by using only the free packages:

```bash
npm install @fortawesome/vue-fontawesome @fortawesome/fontawesome-svg-core
npm install @fortawesome/free-solid-svg-icons
npm install @fortawesome/free-regular-svg-icons
npm install @fortawesome/free-brands-svg-icons
```

Then import from the free packages in `main.js` or `src/utils/icons.js`:

```js
import { faArrowRight } from "@fortawesome/free-solid-svg-icons";
import { faEnvelope } from "@fortawesome/free-regular-svg-icons";
```

| Prefix | Free package                |
| ------ | --------------------------- |
| `fas`  | `free-solid-svg-icons`      |
| `far`  | `free-regular-svg-icons`    |
| `fab`  | `free-brands-svg-icons`     |

The free sets have fewer icons and no Light / Thin / Duotone styles. No `.npmrc` or token needed — Netlify builds will work out of the box.

---

## Troubleshooting

- **404 / 403 on install** — token is wrong or `FONT_AWESOME_TOKEN` is not set in the environment. Check your `.env` locally or the Netlify env var settings.
- **Netlify build fails with 404** — `FONT_AWESOME_TOKEN` is missing from Netlify's environment variables, or `.npmrc` was not committed.
- **Icon not found at runtime** — the icon was not added to `library.add()`. Import it and add it before `app.mount()`.
- **Large bundle** — avoid `import { fas } from "@fortawesome/pro-solid-svg-icons"` (imports the entire set). Always import individual icons.
