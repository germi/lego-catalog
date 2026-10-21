<template>
  <div class="sfe-root">
    <!-- ── Type selector ─────────────────────────────────────────────────── -->
    <select class="sfe-type-select" :value="fillType" @change="onTypeChange($event.target.value)">
      <option value="none">— none —</option>
      <option value="color">solid color</option>
      <option value="linearGradient">linear gradient</option>
      <option value="texture">texture / hatch</option>
      <option value="preset">preset</option>
      <option value="css">CSS string</option>
    </select>

    <!-- ── Solid color ───────────────────────────────────────────────────── -->
    <template v-if="fillType === 'color'">
      <div class="sfe-row">
        <input type="color"
               :value="fill?.value ?? '#3b82f6'"
               @input="emit('update', { type: 'color', value: $event.target.value })" />
        <input type="text" class="sfe-text"
               :value="fill?.value ?? ''"
               placeholder="#hex"
               @change="emit('update', { type: 'color', value: $event.target.value })" />
      </div>
    </template>

    <!-- ── Linear gradient ──────────────────────────────────────────────── -->
    <template v-else-if="fillType === 'linearGradient'">
      <div class="sfe-row">
        <span class="sfe-lbl">direction</span>
        <div class="sfe-dir-group">
          <button v-for="d in GRADIENT_DIRS" :key="d.id"
                  :class="['sfe-dir-btn', gradientDirId === d.id ? 'active' : '']"
                  :title="d.label"
                  @click.prevent="setGradientDir(d)">{{ d.icon }}</button>
        </div>
      </div>
      <div class="sfe-stops-hdr">
        <span class="sfe-lbl">stops</span>
        <button class="sfe-add-stop" @click.prevent="addStop">＋</button>
      </div>
      <div v-for="(stop, si) in (fill?.stops ?? [])" :key="si" class="sfe-stop-row">
        <input type="color" :value="hexOrBlack(stop.color)"
               @input="setStopProp(si, 'color', $event.target.value)" />
        <input type="text" class="sfe-offset"
               :value="stop.offset ?? ''"
               placeholder="0%"
               @change="setStopProp(si, 'offset', $event.target.value)" />
        <input type="range" min="0" max="1" step="0.05"
               :value="stop.opacity ?? 1"
               @input="setStopProp(si, 'opacity', +$event.target.value)" />
        <span class="sfe-stop-val">{{ (+(stop.opacity ?? 1)).toFixed(2) }}</span>
        <button class="sfe-rm" @click.prevent="removeStop(si)">✕</button>
      </div>
    </template>

    <!-- ── Texture / hatch ───────────────────────────────────────────────── -->
    <template v-else-if="fillType === 'texture'">
      <div class="sfe-row">
        <span class="sfe-lbl">shape</span>
        <select :value="fill?.shape ?? 'lines'"
                @change="setTexProp('shape', $event.target.value)">
          <option value="lines">lines</option>
          <option value="circles">circles / dots</option>
        </select>
      </div>

      <template v-if="(fill?.shape ?? 'lines') === 'lines'">
        <div class="sfe-row">
          <span class="sfe-lbl">orientation</span>
          <select :value="fill?.orientation ?? 'diagonal'"
                  @change="setTexProp('orientation', $event.target.value)">
            <option value="diagonal">diagonal (↗)</option>
            <option value="horizontal">horizontal (→)</option>
            <option value="vertical">vertical (↓)</option>
          </select>
        </div>
        <div class="sfe-row">
          <span class="sfe-lbl">stroke</span>
          <input type="color" :value="hexOrBlack(fill?.stroke)"
                 @input="setTexProp('stroke', $event.target.value)" />
          <input type="text" class="sfe-text" :value="fill?.stroke ?? ''"
                 placeholder="rgba(…) or #hex"
                 @change="setTexProp('stroke', $event.target.value || null)" />
        </div>
        <div class="sfe-row">
          <span class="sfe-lbl">strokeWidth</span>
          <input type="range" min="0.5" max="4" step="0.5"
                 :value="fill?.strokeWidth ?? 1"
                 @input="setTexProp('strokeWidth', +$event.target.value)" />
          <span class="sfe-val">{{ fill?.strokeWidth ?? 1 }}</span>
        </div>
      </template>

      <template v-if="(fill?.shape ?? 'lines') === 'circles'">
        <div class="sfe-row">
          <span class="sfe-lbl">fill color</span>
          <input type="color" :value="hexOrBlack(fill?.fill)"
                 @input="setTexProp('fill', $event.target.value)" />
          <input type="text" class="sfe-text" :value="fill?.fill ?? ''"
                 placeholder="rgba(…) or #hex"
                 @change="setTexProp('fill', $event.target.value || null)" />
        </div>
        <div class="sfe-row">
          <span class="sfe-lbl">radius</span>
          <input type="range" min="0.5" max="8" step="0.5"
                 :value="fill?.radius ?? 2"
                 @input="setTexProp('radius', +$event.target.value)" />
          <span class="sfe-val">{{ fill?.radius ?? 2 }}</span>
        </div>
      </template>

      <div class="sfe-row">
        <span class="sfe-lbl">size</span>
        <input type="range" min="3" max="20" step="1"
               :value="fill?.size ?? 7"
               @input="setTexProp('size', +$event.target.value)" />
        <span class="sfe-val">{{ fill?.size ?? 7 }}</span>
      </div>

      <div class="sfe-row">
        <span class="sfe-lbl">background</span>
        <input type="color" :value="hexOrBlack(fill?.background ?? '#ffffff')"
               @input="setTexProp('background', $event.target.value)" />
        <input type="text" class="sfe-text" :value="fill?.background ?? ''"
               placeholder="none"
               @change="setTexProp('background', $event.target.value || null)" />
        <button v-if="fill?.background" class="sfe-rm" title="Clear background"
                @click.prevent="setTexProp('background', null)">✕</button>
      </div>
    </template>

    <!-- ── Preset ────────────────────────────────────────────────────────── -->
    <template v-else-if="fillType === 'preset'">
      <div class="sfe-row">
        <span class="sfe-lbl">name</span>
        <select :value="fill?.name ?? PRESETS[0]"
                @change="emit('update', { type: 'preset', name: $event.target.value })">
          <option v-for="p in PRESETS" :key="p" :value="p">{{ p }}</option>
        </select>
      </div>
    </template>

    <!-- ── CSS string ─────────────────────────────────────────────────────── -->
    <template v-else-if="fillType === 'css'">
      <div class="sfe-row">
        <input type="text" class="sfe-text sfe-full"
               :value="typeof fill === 'string' ? fill : ''"
               placeholder="rgba(…) or #hex or any CSS value"
               @change="emit('update', $event.target.value || null)" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { listTexturePresets } from "../fill/textureRegistry.js";

const props = defineProps({
  /** Current fill value: null | CSS string | fill descriptor object. */
  fill: { default: null },
});

const emit = defineEmits(["update"]);

// ── Preset names ─────────────────────────────────────────────────────────────

const PRESETS = listTexturePresets();

// ── Gradient direction presets ────────────────────────────────────────────────

const GRADIENT_DIRS = [
  { id: "h", icon: "→", label: "horizontal (left → right)", x1: 0, y1: 0, x2: 1, y2: 0 },
  { id: "v", icon: "↓", label: "vertical (top → bottom)",   x1: 0, y1: 0, x2: 0, y2: 1 },
  { id: "d", icon: "↘", label: "diagonal (↗)",              x1: 0, y1: 0, x2: 1, y2: 1 },
];

const gradientDirId = computed(() => {
  const f = props.fill;
  if (!f) return "v";
  if (f.x2 === 1 && f.y2 === 0) return "h";
  if (f.x2 === 0 && f.y2 === 1) return "v";
  if (f.x2 === 1 && f.y2 === 1) return "d";
  return "custom";
});

// ── Fill-type detection ───────────────────────────────────────────────────────

const fillType = computed(() => {
  const f = props.fill;
  if (f == null) return "none";
  if (typeof f === "string") return "css";
  return f.type ?? "none";
});

// ── Type change ───────────────────────────────────────────────────────────────

function onTypeChange(type) {
  switch (type) {
    case "none":
      emit("update", null);
      break;
    case "color":
      emit("update", { type: "color", value: "#3b82f6" });
      break;
    case "linearGradient":
      emit("update", {
        type:  "linearGradient",
        x1: 0, y1: 0, x2: 1, y2: 0,   // horizontal default
        stops: [
          { offset: "0%",   color: "#3b82f6", opacity: 1 },
          { offset: "100%", color: "#8b5cf6", opacity: 1 },
        ],
      });
      break;
    case "texture":
      emit("update", {
        type:        "texture",
        shape:       "lines",
        orientation: "diagonal",
        stroke:      "rgba(55,65,81,0.55)",
        strokeWidth: 1,
        size:        7,
      });
      break;
    case "preset":
      emit("update", { type: "preset", name: PRESETS[0] ?? "diagonalHatch" });
      break;
    case "css":
      emit("update", "rgba(59,130,246,0.15)");
      break;
  }
}

// ── Gradient helpers ──────────────────────────────────────────────────────────

function setGradientDir(d) {
  emit("update", { ...props.fill, x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2 });
}

function setStopProp(si, key, val) {
  const stops = (props.fill?.stops ?? []).map((s, i) =>
    i === si ? { ...s, [key]: val } : s,
  );
  emit("update", { ...props.fill, stops });
}

function addStop() {
  const stops = [
    ...(props.fill?.stops ?? []),
    { offset: "100%", color: "#000000", opacity: 1 },
  ];
  emit("update", { ...props.fill, stops });
}

function removeStop(si) {
  const stops = (props.fill?.stops ?? []).filter((_, i) => i !== si);
  emit("update", { ...props.fill, stops });
}

// ── Texture helpers ───────────────────────────────────────────────────────────

function setTexProp(key, val) {
  emit("update", { ...props.fill, type: "texture", [key]: val });
}

// ── Colour util ───────────────────────────────────────────────────────────────

function hexOrBlack(v) {
  if (typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v)) return v;
  return "#000000";
}
</script>

<style scoped>
.sfe-root {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11px;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.sfe-type-select {
  width: 100%;
  padding: 3px 5px;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  font-size: 11px;
  background: white;
  color: #111827;
  margin-bottom: 2px;
}

.sfe-row {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 22px;
}

.sfe-lbl {
  flex: 0 0 72px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 10px;
  color: #6b7280;
}

.sfe-row input[type="color"] {
  width: 26px;
  height: 22px;
  padding: 0;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  cursor: pointer;
  flex-shrink: 0;
}

.sfe-row input[type="range"] {
  flex: 1;
  min-width: 0;
  accent-color: #374151;
}

.sfe-row select {
  flex: 1;
  min-width: 0;
  padding: 2px 4px;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  font-size: 11px;
  background: white;
}

.sfe-text {
  flex: 1;
  min-width: 0;
  padding: 2px 4px;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  font-size: 10.5px;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.sfe-full {
  width: 100%;
}

.sfe-val {
  flex: 0 0 26px;
  text-align: right;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 10px;
  color: #374151;
}

/* Gradient direction buttons */
.sfe-dir-group {
  display: flex;
  gap: 3px;
}

.sfe-dir-btn {
  padding: 2px 7px;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  background: white;
  cursor: pointer;
  font-size: 12px;
  line-height: 1.4;
}

.sfe-dir-btn:hover {
  background: #f3f4f6;
}

.sfe-dir-btn.active {
  background: #374151;
  color: white;
  border-color: #374151;
}

/* Gradient stops */
.sfe-stops-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 2px;
}

.sfe-add-stop {
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  padding: 0 5px;
  font-size: 13px;
  line-height: 16px;
  cursor: pointer;
  color: #374151;
}

.sfe-add-stop:hover {
  background: #f3f4f6;
}

.sfe-stop-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sfe-stop-row input[type="color"] {
  width: 22px;
  height: 20px;
  padding: 0;
  border: 1px solid #d1d5db;
  border-radius: 2px;
  cursor: pointer;
  flex-shrink: 0;
}

.sfe-stop-row input[type="range"] {
  flex: 1;
  min-width: 0;
  accent-color: #374151;
}

.sfe-offset {
  width: 40px;
  padding: 1px 3px;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  text-align: center;
}

.sfe-stop-val {
  flex: 0 0 30px;
  text-align: right;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 10px;
  color: #374151;
}

.sfe-rm {
  background: none;
  border: none;
  padding: 1px 3px;
  font-size: 10px;
  cursor: pointer;
  color: #9ca3af;
  border-radius: 2px;
}

.sfe-rm:hover {
  color: #ef4444;
  background: #fee2e2;
}
</style>
