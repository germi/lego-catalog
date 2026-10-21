<template>
  <div class="sc-editchart" ref="rootEl">
    <button
      class="sc-editchart-pencil"
      title="Edit chart props"
      @click="open = true"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    </button>

    <Teleport to="body" v-if="open">
      <div class="sc-editchart-backdrop">
        <div class="sc-editchart-modal" role="dialog">
          <header class="sc-editchart-header">
            <h2>Edit chart props</h2>
            <button class="sc-editchart-close" @click="open = false">×</button>
          </header>

          <div class="sc-editchart-body">
            <section v-for="(propList, sectionName) in groupedSections" :key="sectionName">
              <h3>{{ sectionName }}</h3>
              <PropControl
                v-for="key in propList"
                :key="key"
                :prop-key="key"
                :value="effective[key]"
                :default-value="defaults[key]"
                :hint="meta?.props?.[key]"
                :is-overridden="key in overrides"
                @set="(v) => $emit('set', key, v)"
                @reset="$emit('reset', key)"
              />
            </section>
          </div>

          <footer class="sc-editchart-footer">
            <label class="sc-editchart-explode" title="Fan the chart's layers apart to inspect them">
              <input type="checkbox" v-model="explode" />
              Explode layers
            </label>
            <button class="sc-editchart-btn" @click="copyJson">Copy as JSON</button>
            <button class="sc-editchart-btn" @click="$emit('reset-all')">Reset all</button>
            <button class="sc-editchart-btn primary" @click="open = false">Close</button>
            <span v-if="copied" class="sc-editchart-copied">copied!</span>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from "vue";
import PropControl from "./EditChartPropControl.vue";

const props = defineProps({
  effective: { type: Object, required: true }, // current values (with overrides)
  defaults:  { type: Object, required: true }, // *_CHART_DEFAULTS
  meta:      { type: Object, default: null },  // *_CHART_META (optional)
  overrides: { type: Object, required: true }, // raw overrides object (for "is overridden" indicator)
});

defineEmits(["set", "reset", "reset-all"]);

const open   = ref(false);
const copied = ref(false);

// ── "Explode layers" — fan the chart's layer <g>s apart for inspection ──────
// Self-contained: EditChart sits inside the BaseCanvas `.ot-canvas` div next to
// the <svg>, so it can find the SVG and transform each top-level layer group
// without any per-preset wiring.  Static-inspect mode: we override each group's
// transform (so it does NOT compose with live zoom); toggling off restores it
// on the next render.
const rootEl  = ref(null);
const explode = ref(false);

const SVG_NS      = "http://www.w3.org/2000/svg";
const FRAME_CLASS = "sc-explode-frame";
const GAP_X = 26; // px left per layer (diagonal stack, bottom-left)
const GAP_Y = 20; // px down per layer

function getSvg() {
  return rootEl.value?.closest(".ot-canvas")?.querySelector("svg") ?? null;
}

// Top-level layer groups: the children of BaseCanvas's inner margin <g>
// (cartesian layers) plus any layer <g> mounted directly on the svg root.
function getLayerGroups(svg) {
  if (!svg) return [];
  const inner = svg.querySelector(":scope > g");
  const out = [];
  if (inner) out.push(...[...inner.children].filter((n) => n.tagName === "g"));
  out.push(...[...svg.children].filter((n) => n.tagName === "g" && n !== inner));
  return out;
}

function applyExplode() {
  const svg = getSvg();
  if (!svg) return;
  svg.style.overflow = "visible"; // let the fanned-out layers spill past the viewBox
  getLayerGroups(svg).forEach((g, i) => {
    g.style.transition = "transform .45s cubic-bezier(.4,0,.2,1)";
    g.style.transform  = `translate(${i * -GAP_X}px, ${i * GAP_Y}px)`;
    // Frame: outline + faint fill sized to the layer's content bounds.
    g.querySelectorAll(`rect.${FRAME_CLASS}`).forEach((r) => r.remove());
    let box = null;
    try { box = g.getBBox(); } catch { /* not laid out / empty */ }
    if (box && box.width > 0 && box.height > 0) {
      const pad = 4;
      const r = document.createElementNS(SVG_NS, "rect");
      r.setAttribute("class", FRAME_CLASS);
      r.setAttribute("x", box.x - pad);
      r.setAttribute("y", box.y - pad);
      r.setAttribute("width",  box.width  + pad * 2);
      r.setAttribute("height", box.height + pad * 2);
      r.setAttribute("rx", "3");
      r.setAttribute("fill",   "rgba(37,99,235,0.05)");
      r.setAttribute("stroke", "rgba(37,99,235,0.55)");
      r.setAttribute("stroke-width", "1");
      r.setAttribute("pointer-events", "none");
      g.insertBefore(r, g.firstChild); // behind the layer's own content
    }
  });
}

function clearExplode() {
  const svg = getSvg();
  if (!svg) return;
  const groups = getLayerGroups(svg);
  // Animate each layer back home, then strip the inline styles + frames.
  groups.forEach((g) => { g.style.transform = "translate(0px, 0px)"; });
  setTimeout(() => {
    if (explode.value) return; // re-toggled during the settle — leave it exploded
    groups.forEach((g) => {
      g.style.transform  = "";
      g.style.transition = "";
      g.querySelectorAll(`rect.${FRAME_CLASS}`).forEach((r) => r.remove());
    });
    svg.style.overflow = "";
  }, 480);
}

watch(explode, (on) => (on ? applyExplode() : clearExplode()));
onBeforeUnmount(() => { if (explode.value) clearExplode(); });

// Group props into sections defined by meta.sections, with anything missing
// dropped into "other". Skipped props (meta.props.x.skip === true) are
// filtered out entirely.
const groupedSections = computed(() => {
  const skipped = new Set(
    Object.entries(props.meta?.props ?? {})
      .filter(([, v]) => v?.skip)
      .map(([k]) => k),
  );
  const allKeys = Object.keys(props.defaults).filter((k) => !skipped.has(k));

  const result = {};
  const sections = props.meta?.sections ?? null;
  if (sections) {
    const seen = new Set();
    for (const [name, keys] of Object.entries(sections)) {
      const filtered = keys.filter((k) => allKeys.includes(k));
      if (filtered.length) result[name] = filtered;
      filtered.forEach((k) => seen.add(k));
    }
    const leftover = allKeys.filter((k) => !seen.has(k));
    if (leftover.length) result.other = leftover;
  } else {
    result.props = allKeys;
  }
  return result;
});

function copyJson() {
  const json = JSON.stringify(props.overrides, null, 2);
  navigator.clipboard?.writeText(json);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 1500);
}
</script>

<style scoped>
.sc-editchart-pencil {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid #d97706;
  background: #fef3c7;
  color: #92400e;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
.sc-editchart-pencil:hover {
  background: #fde68a;
}

.sc-editchart-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 24px;
  pointer-events: none; /* let clicks through to the chart — only the modal catches */
}
.sc-editchart-modal {
  pointer-events: auto;
  background: white;
  border-radius: 8px;
  width: min(420px, 90vw);
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
  border: 1px solid #e5e7eb;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  font-size: 13px;
}
.sc-editchart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}
.sc-editchart-header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.sc-editchart-close {
  background: none;
  border: none;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  color: #6b7280;
}
.sc-editchart-body {
  overflow-y: auto;
  padding: 8px 16px 16px;
  flex: 1;
}
.sc-editchart-body section {
  margin-top: 12px;
}
.sc-editchart-body h3 {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6b7280;
}
.sc-editchart-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
}
.sc-editchart-explode {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-right: auto;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
  user-select: none;
}
.sc-editchart-explode input {
  cursor: pointer;
}
.sc-editchart-btn {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}
.sc-editchart-btn:hover {
  background: #f3f4f6;
}
.sc-editchart-btn.primary {
  background: #2563eb;
  color: white;
  border-color: #2563eb;
}
.sc-editchart-btn.primary:hover {
  background: #1d4ed8;
}
.sc-editchart-copied {
  font-size: 11px;
  color: #059669;
}
</style>
