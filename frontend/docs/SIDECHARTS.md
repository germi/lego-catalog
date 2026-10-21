# Sidecharts

Full documentation: **[ot-components-docs.netlify.app](http://ot-components-docs.netlify.app/)**

---

## Available layers

Layers are composable SVG/canvas primitives placed inside a chart canvas component (e.g. `<RibbonChart>`, `<ScatterPlot>`). All are exported from `sidecharts/vue`.

| Layer | Purpose |
|---|---|
| `RibbonLayer` | Vertical bars (column/ribbon chart) |
| `LineLayer` | Line series |
| `AreaLayer` | Filled area under a line |
| `ScatterLayer` | Scatter / bubble plot |
| `SegmentLayer` | Horizontal lollipop / range segments |
| `AxisLayer` | X axis with ticks and labels |
| `YAxisLayer` | Y axis with ticks and labels |
| `LineAxisLayer` | Axis drawn as a single line (no ticks) |
| `LineLabelLayer` | Labels at line endpoints |
| `RefLineLayer` | Horizontal or vertical reference line |
| `RefAreaLayer` | Shaded reference band |
| `BrushLayer` | Interactive brush selection |
| `MaskLayer` | Cartesian clip mask |
| `GeoMaskLayer` | Geo clip mask |
| `RegionLayer` | Choropleth regions (geo) |
| `GeoShapeLayer` | Arbitrary GeoJSON shapes |
| `GeoCircleLayer` | Circles at geo coordinates |
| `GraticuleLayer` | Graticule grid lines on a map |
| `ArcLayer` | Great-circle arcs between geo points |
| `WindLayer` | Wind / flow field arrows |
| `ContourLayer` | Density contour lines |
| `RadialGridLayer` | Radial grid for rose/polar charts |
| `RadialLabelLayer` | Labels on a radial axis |
| `VoronoiLayer` | Voronoi cells for hover hit areas |
| `VoronoiHoverLayer` | Highlight on voronoi hover |
| `VoronoiMarkerLayer` | Marker pinned to hovered voronoi cell |
| `VoronoiLabelLayer` | Label pinned to hovered voronoi cell |

---

## Before building something new

1. **Check the docs first** — the desired chart type or behavior may already exist: [ot-components-docs.netlify.app](http://ot-components-docs.netlify.app/)
2. **Check the layer list above** — combine existing layers before writing new ones (e.g. a scatter + voronoi hover is just `<ScatterLayer>` + `<VoronoiLayer>` + `<VoronoiHoverLayer>`).
3. Only create a new layer when no combination of existing layers can produce the needed output.

---

## Creating a new layer

Full guide: [ot-components-docs.netlify.app/dev-guide/guides/creating-a-layer.html](https://ot-components-docs.netlify.app/dev-guide/guides/creating-a-layer.html)

**New layers live in the project, not in the library.** Create them alongside other project components (e.g. `src/components/MyCustomLayer.vue`), not inside `src/components/sidecharts/` (which is overwritten on every update).

A layer has two parts:

### 1. Core factory (`src/utils/myCustomLayer.js`)

```js
import { createLayer } from "sidecharts/core";

export function createMyCustomLayer() {
  let base, cachedPayload;

  function render(payload, props) {
    cachedPayload = payload;
    base.ensureGroup();
    const { project } = payload;
    // ... D3 join + enter/update/exit with transitions
  }

  function rerender(props) {
    if (!cachedPayload) return;
    render(cachedPayload, props);
  }

  function onZoom(transform) {
    base.onZoom(transform); // always call base first
    // counter-scale fixed-size elements here if needed
  }

  function destroy() { base.destroy(); }

  return { init(b) { base = b; }, render, rerender, onZoom, destroy };
}

export const myCustomLayerDefaults = {
  // your prop defaults here
};
```

### 2. Vue wrapper (`src/components/MyCustomLayer.vue`)

```vue
<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createMyCustomLayer } from "@/utils/myCustomLayer";

const props = defineProps({ /* mirror your defaults */ });
const draw = inject("draw");
const zoom = inject("zoom");

const layer = createMyCustomLayer();
layer.init({ /* base layer setup — see docs */ });
layer.setOrder(/* z-index */);

watch(draw, (payload) => layer.render(payload, props), { immediate: true });
watch(zoom, (t) => layer.onZoom(t));
watch(() => props, (p) => layer.rerender(p), { deep: true });

onBeforeUnmount(() => layer.destroy());
</script>
<template><slot /></template>
```

Use this wrapper inside any chart canvas component exactly like a built-in layer:

```vue
<RibbonChart :data="data">
  <RibbonLayer />
  <MyCustomLayer :highlight-ids="selected" />
</RibbonChart>
```

### Key rules

- `render` must call `base.ensureGroup()` first.
- `rerender` must guard against a missing cached payload.
- `onZoom` must always call `base.onZoom(transform)`.
- All D3 join branches (enter, update, exit) must include transitions so elements animate with the scene.
- For cartesian layers read scales from `payload` directly; for scatter/geo layers use `payload.project` / `payload.prevProject`.

---

## If the core library needs changes

If the new behavior genuinely requires modifying a file inside `src/components/sidecharts/`, **do not edit that file directly** — it will be overwritten on the next `npm run update-sidecharts`. Instead:

1. Note which core file needs touching and what change is needed.
2. Tell the user — they may want to contribute the change to the upstream sidecharts repo, then pull the update into this project.
