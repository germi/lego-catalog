<template>
  <div class="sce-root">
    <!-- ── Left: live chart ────────────────────────────────────────────────── -->
    <div class="sce-chart-pane">
      <SuperLineChart
        ref="chartRef"
        class="sce-chart"
        :data="data"
        :chart="scene.chart"
        :series="scene.series ?? []"
        :areas="scene.areas ?? []"
        :ref-areas="scene.refAreas ?? []"
        :ref-lines="scene.refLines ?? []"
        :zoom="scene.zoom"
        @draw="zoomState.onDraw"
        @zoom="zoomState.onZoom"
      />
    </div>

    <!-- ── Right: editor panel ─────────────────────────────────────────────── -->
    <div class="sce-panel">

      <!-- ─ Chart ──────────────────────────────────────────────────────────── -->
      <section class="sce-section">
        <h3 class="sce-section-title">Chart</h3>

        <div class="sce-row">
          <label class="sce-label">duration</label>
          <input type="range" min="0" max="3000" step="100"
                 :value="scene.chart?.duration ?? 700"
                 @input="setChart('duration', +$event.target.value)" />
          <span class="sce-num-display">{{ scene.chart?.duration ?? 700 }}ms</span>
        </div>

        <div class="sce-row">
          <label class="sce-label">ease</label>
          <select :value="scene.chart?.ease ?? 'easeCubic'"
                  @change="setChart('ease', $event.target.value)">
            <option v-for="e in EASES_LIST" :key="e" :value="e">{{ e }}</option>
          </select>
        </div>

        <div class="sce-row">
          <label class="sce-label">curve</label>
          <select :value="scene.chart?.curve ?? 'curveLinear'"
                  @change="setChart('curve', $event.target.value)">
            <option v-for="c in CURVES_LIST" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <div class="sce-row">
          <label class="sce-label">forceY</label>
          <input type="number" class="sce-num-input"
                 :value="scene.chart?.forceY?.[0] ?? ''"
                 placeholder="min"
                 @change="setForceY(0, $event.target.value)" />
          <span class="sce-sep">–</span>
          <input type="number" class="sce-num-input"
                 :value="scene.chart?.forceY?.[1] ?? ''"
                 placeholder="max"
                 @change="setForceY(1, $event.target.value)" />
        </div>

        <div class="sce-row">
          <label class="sce-label">maxZoom</label>
          <input type="range" min="1" max="40" step="1"
                 :value="scene.chart?.maxZoom ?? 10"
                 @input="setChart('maxZoom', +$event.target.value)" />
          <span class="sce-num-display">{{ scene.chart?.maxZoom ?? 10 }}×</span>
        </div>

        <div class="sce-row">
          <label class="sce-label">allowZoom</label>
          <input type="checkbox"
                 :checked="!!(scene.chart?.allowZoom)"
                 @change="setChart('allowZoom', $event.target.checked)" />
        </div>

        <div class="sce-row">
          <label class="sce-label">showXGrid</label>
          <input type="checkbox"
                 :checked="!!(scene.chart?.showXGrid)"
                 @change="setChart('showXGrid', $event.target.checked)" />
        </div>

        <div class="sce-row">
          <label class="sce-label">showYGrid</label>
          <input type="checkbox"
                 :checked="!!(scene.chart?.showYGrid)"
                 @change="setChart('showYGrid', $event.target.checked)" />
        </div>
      </section>

      <!-- ─ Series ─────────────────────────────────────────────────────────── -->
      <section class="sce-section">
        <h3 class="sce-section-title">Series</h3>

        <div v-for="(s, si) in (scene.series ?? [])" :key="s.key ?? si" class="sce-series">
          <!-- Header (click to expand) -->
          <button class="sce-series-header" @click="openSeries[si] = !openSeries[si]">
            <span class="sce-swatch" :style="{ background: seriesHexColor(s) }"></span>
            <span class="sce-series-label">{{ s.label ?? s.key }}</span>
            <span class="sce-chevron">{{ openSeries[si] ? '▲' : '▼' }}</span>
          </button>

          <!-- Expanded body -->
          <div v-if="openSeries[si]" class="sce-series-body">
            <div class="sce-sub-label">stroke fill</div>
            <FillEditor
              class="sce-fill-block"
              :fill="s.stroke?.color ?? null"
              @update="setSeriesColor(s, $event)"
            />

            <div class="sce-row">
              <label class="sce-label">width</label>
              <input type="range" min="0.5" max="8" step="0.5"
                     :value="s.stroke?.width ?? 2"
                     @input="setSStroke(s, 'width', +$event.target.value)" />
              <span class="sce-num-display">{{ s.stroke?.width ?? 2 }}px</span>
            </div>

            <div class="sce-row">
              <label class="sce-label">opacity</label>
              <input type="range" min="0" max="1" step="0.05"
                     :value="s.stroke?.opacity ?? 1"
                     @input="setSStroke(s, 'opacity', +$event.target.value)" />
              <span class="sce-num-display">{{ (+(s.stroke?.opacity ?? 1)).toFixed(2) }}</span>
            </div>

            <div class="sce-row">
              <label class="sce-label">dasharray</label>
              <input type="text" class="sce-text-input"
                     :value="s.stroke?.dasharray ?? ''"
                     placeholder="e.g. 5 4"
                     @change="setSStroke(s, 'dasharray', $event.target.value || null)" />
            </div>

            <div class="sce-row">
              <label class="sce-label">curve</label>
              <select :value="s.curve ?? ''"
                      @change="s.curve = $event.target.value || null">
                <option value="">inherit</option>
                <option v-for="c in CURVES_LIST" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>

            <div class="sce-row">
              <label class="sce-label">highlighted</label>
              <input type="checkbox" :checked="!!s.highlighted"
                     @change="s.highlighted = $event.target.checked" />
            </div>

            <!-- Reveal toggle + sliders -->
            <div class="sce-row">
              <label class="sce-label">reveal</label>
              <input type="checkbox" :checked="s.reveal != null"
                     @change="toggleReveal(s)" />
            </div>
            <template v-if="s.reveal != null">
              <div class="sce-row sce-indent">
                <label class="sce-label">start</label>
                <input type="range"
                       :min="dataXRange[0]" :max="dataXRange[1]" :step="dataXStep"
                       :value="s.reveal.start ?? dataXRange[0]"
                       @input="s.reveal.start = +$event.target.value" />
                <span class="sce-num-display">{{ s.reveal.start ?? dataXRange[0] }}</span>
              </div>
              <div class="sce-row sce-indent">
                <label class="sce-label">end</label>
                <input type="range"
                       :min="dataXRange[0]" :max="dataXRange[1]" :step="dataXStep"
                       :value="s.reveal.end ?? dataXRange[1]"
                       @input="s.reveal.end = +$event.target.value" />
                <span class="sce-num-display">{{ s.reveal.end ?? dataXRange[1] }}</span>
              </div>
            </template>

            <!-- Band toggle + controls -->
            <div class="sce-row">
              <label class="sce-label">band</label>
              <input type="checkbox" :checked="s.band != null"
                     @change="toggleBand(s)" />
            </div>
            <template v-if="s.band != null">
              <div class="sce-indent">
                <div class="sce-sub-label">band fill</div>
                <FillEditor
                  class="sce-fill-block"
                  :fill="s.band.fill ?? null"
                  @update="s.band.fill = $event"
                />
              </div>
              <div class="sce-row sce-indent">
                <label class="sce-label">opacity</label>
                <input type="range" min="0" max="1" step="0.05"
                       :value="s.band.opacity ?? 0.18"
                       @input="s.band.opacity = +$event.target.value" />
                <span class="sce-num-display">{{ (+(s.band.opacity ?? 0.18)).toFixed(2) }}</span>
              </div>
              <div class="sce-row sce-indent">
                <label class="sce-label">upperKey</label>
                <input type="text" class="sce-text-input" :value="s.band.upperKey ?? ''"
                       @change="s.band.upperKey = $event.target.value" />
              </div>
              <div class="sce-row sce-indent">
                <label class="sce-label">lowerKey</label>
                <input type="text" class="sce-text-input" :value="s.band.lowerKey ?? ''"
                       @change="s.band.lowerKey = $event.target.value" />
              </div>
            </template>
          </div>
        </div>

        <p v-if="!scene.series?.length" class="sce-empty">No series configured</p>
      </section>

      <!-- ─ Ref Areas ───────────────────────────────────────────────────────── -->
      <section class="sce-section">
        <h3 class="sce-section-title">
          Ref Areas
          <button class="sce-add-btn" title="Add ref area" @click="addRefArea">＋</button>
        </h3>

        <div v-for="(a, ai) in (scene.refAreas ?? [])" :key="a.id ?? ai" class="sce-ref">
          <div class="sce-ref-hdr">
            <span class="sce-ref-id">{{ a.id ?? `area-${ai}` }}</span>
            <button class="sce-rm-btn" title="Remove" @click="removeRefArea(ai)">✕</button>
          </div>

          <div class="sce-row">
            <label class="sce-label">id</label>
            <input type="text" class="sce-text-input" :value="a.id ?? ''"
                   @change="a.id = $event.target.value" />
          </div>
          <div class="sce-row">
            <label class="sce-label">x1</label>
            <input type="number" class="sce-num-input"
                   :value="Number.isFinite(a.x1) ? a.x1 : ''"
                   placeholder="-∞"
                   @change="a.x1 = parseCoord($event.target.value, -Infinity)" />
          </div>
          <div class="sce-row">
            <label class="sce-label">x2</label>
            <input type="number" class="sce-num-input"
                   :value="Number.isFinite(a.x2) ? a.x2 : ''"
                   placeholder="∞"
                   @change="a.x2 = parseCoord($event.target.value, Infinity)" />
          </div>
          <div class="sce-row">
            <label class="sce-label">y1</label>
            <input type="number" class="sce-num-input"
                   :value="Number.isFinite(a.y1) ? a.y1 : ''"
                   placeholder="-∞"
                   @change="a.y1 = parseCoord($event.target.value, -Infinity)" />
          </div>
          <div class="sce-row">
            <label class="sce-label">y2</label>
            <input type="number" class="sce-num-input"
                   :value="Number.isFinite(a.y2) ? a.y2 : ''"
                   placeholder="∞"
                   @change="a.y2 = parseCoord($event.target.value, Infinity)" />
          </div>
          <div class="sce-sub-label">fill</div>
          <FillEditor
            class="sce-fill-block"
            :fill="a.fill"
            @update="a.fill = $event"
          />
          <div class="sce-row">
            <label class="sce-label">fillOpacity</label>
            <input type="range" min="0" max="1" step="0.05"
                   :value="a.fillOpacity ?? 1"
                   @input="a.fillOpacity = +$event.target.value" />
            <span class="sce-num-display">{{ (+(a.fillOpacity ?? 1)).toFixed(2) }}</span>
          </div>
          <div class="sce-row">
            <label class="sce-label">stroke</label>
            <input type="color"
                   :value="a.stroke?.startsWith?.('#') ? a.stroke : '#000000'"
                   @input="a.stroke = $event.target.value" />
            <input type="text" class="sce-text-input" :value="a.stroke ?? ''"
                   placeholder="CSS color or none"
                   @change="a.stroke = $event.target.value || undefined" />
          </div>
          <div class="sce-row">
            <label class="sce-label">strokeWidth</label>
            <input type="range" min="0.5" max="4" step="0.5"
                   :value="a.strokeWidth ?? 1"
                   @input="a.strokeWidth = +$event.target.value" />
            <span class="sce-num-display">{{ a.strokeWidth ?? 1 }}</span>
          </div>
          <div class="sce-row">
            <label class="sce-label">dasharray</label>
            <input type="text" class="sce-text-input" :value="a.strokeDasharray ?? ''"
                   placeholder="e.g. 5 4"
                   @change="a.strokeDasharray = $event.target.value || undefined" />
          </div>
        </div>

        <p v-if="!scene.refAreas?.length" class="sce-empty">No ref areas</p>
      </section>

      <!-- ─ Ref Lines ───────────────────────────────────────────────────────── -->
      <section class="sce-section">
        <h3 class="sce-section-title">
          Ref Lines
          <button class="sce-add-btn" title="Add ref line" @click="addRefLine">＋</button>
        </h3>

        <div v-for="(l, li) in (scene.refLines ?? [])" :key="l.id ?? li" class="sce-ref">
          <div class="sce-ref-hdr">
            <span class="sce-ref-id">{{ l.id ?? `line-${li}` }}</span>
            <button class="sce-rm-btn" title="Remove" @click="removeRefLine(li)">✕</button>
          </div>

          <div class="sce-row">
            <label class="sce-label">id</label>
            <input type="text" class="sce-text-input" :value="l.id ?? ''"
                   @change="l.id = $event.target.value" />
          </div>
          <div class="sce-row">
            <label class="sce-label">y</label>
            <input type="number" class="sce-num-input" :value="l.y ?? ''"
                   placeholder="—"
                   @change="l.y = $event.target.value !== '' ? +$event.target.value : undefined" />
          </div>
          <div class="sce-row">
            <label class="sce-label">x</label>
            <input type="number" class="sce-num-input" :value="l.x ?? ''"
                   placeholder="—"
                   @change="l.x = $event.target.value !== '' ? +$event.target.value : undefined" />
          </div>
          <div class="sce-row">
            <label class="sce-label">color</label>
            <input type="color" :value="l.color ?? '#000000'"
                   @input="l.color = $event.target.value" />
            <input type="text" class="sce-text-input" :value="l.color ?? ''"
                   @change="l.color = $event.target.value || null" />
          </div>
          <div class="sce-row">
            <label class="sce-label">strokeWidth</label>
            <input type="range" min="0.5" max="5" step="0.5"
                   :value="l.strokeWidth ?? 1.5"
                   @input="l.strokeWidth = +$event.target.value" />
            <span class="sce-num-display">{{ l.strokeWidth ?? 1.5 }}</span>
          </div>
          <div class="sce-row">
            <label class="sce-label">dasharray</label>
            <input type="text" class="sce-text-input" :value="l.dasharray ?? ''"
                   placeholder="e.g. 5 4"
                   @change="l.dasharray = $event.target.value || null" />
          </div>
          <div class="sce-row">
            <label class="sce-label">label</label>
            <input type="text" class="sce-text-input" :value="l.label ?? ''"
                   @change="l.label = $event.target.value || null" />
          </div>
          <div class="sce-row">
            <label class="sce-label">labelAlign</label>
            <select :value="l.labelAlign ?? 'start'"
                    @change="l.labelAlign = $event.target.value">
              <option value="start">start</option>
              <option value="middle">middle</option>
              <option value="end">end</option>
            </select>
          </div>
        </div>

        <p v-if="!scene.refLines?.length" class="sce-empty">No ref lines</p>
      </section>

      <!-- ─ Zoom ────────────────────────────────────────────────────────────── -->
      <section class="sce-section">
        <h3 class="sce-section-title">Zoom</h3>

        <div class="sce-row">
          <span class="sce-label">live x</span>
          <code class="sce-domain">{{ formatDomain(zoomState.xDomain.value) }}</code>
        </div>
        <div class="sce-row">
          <span class="sce-label">live y</span>
          <code class="sce-domain">{{ formatDomain(zoomState.yDomain.value) }}</code>
        </div>
        <div class="sce-row" v-if="scene.zoom">
          <span class="sce-label">locked</span>
          <code class="sce-domain">{{ formatZoom(scene.zoom) }}</code>
        </div>

        <div class="sce-btn-row">
          <button class="sce-btn" @click="captureZoom"
                  :disabled="!zoomState.xDomain.value">Capture zoom</button>
          <button class="sce-btn" :disabled="!scene.zoom" @click="clearZoom">Clear</button>
        </div>
      </section>

      <!-- ─ Export ──────────────────────────────────────────────────────────── -->
      <section class="sce-section">
        <h3 class="sce-section-title">Export</h3>
        <div class="sce-btn-row">
          <button class="sce-btn primary" @click="copyJson">
            {{ copied ? '✓ Copied!' : 'Copy scene JSON' }}
          </button>
        </div>
        <pre class="sce-json-preview">{{ sceneJson }}</pre>
      </section>

      <!-- ─ Snapshots ─────────────────────────────────────────────────────────── -->
      <section class="sce-section">
        <h3 class="sce-section-title">Snapshots</h3>

        <!-- Edit-mode banner -->
        <div v-if="editingRef" class="sce-edit-banner">
          <span>Editing scene {{ editingRef.sceneIndex + 1 }} in "{{ editingRef.storyTitle }}"</span>
          <button class="sce-rm" title="Cancel edit" @click.prevent="cancelEdit">✕</button>
        </div>

        <!-- Save rows -->
        <div class="sce-row">
          <label class="sce-label">story</label>
          <input type="text" class="sce-text-input"
                 v-model="snapStoryTitle"
                 :disabled="!!editingRef"
                 placeholder="Story name…" />
        </div>
        <div class="sce-row">
          <label class="sce-label">scene</label>
          <input type="text" class="sce-text-input"
                 v-model="snapSceneTitle"
                 placeholder="Scene title…" />
        </div>
        <div class="sce-btn-row">
          <button class="sce-btn primary" style="flex:1" @click="saveSnapshot">
            {{ editingRef ? 'Update scene' : 'Save scene' }}
          </button>
        </div>

        <!-- Story list -->
        <p v-if="!store.stories.value.length" class="sce-empty">No saved snapshots</p>

        <div v-for="story in store.stories.value" :key="story.id" class="sce-story">
          <div class="sce-story-hdr">
            <span class="sce-story-title">{{ story.title }}</span>
            <span class="sce-story-count">{{ story.scenes.length }}
              {{ story.scenes.length === 1 ? 'scene' : 'scenes' }}</span>
            <button class="sce-rm" title="Delete story"
                    @click.prevent="store.deleteStory(story.id)">✕</button>
          </div>

          <div v-for="(sc, si) in story.scenes" :key="si" class="sce-snap-row">
            <span class="sce-snap-idx">{{ si + 1 }}</span>
            <span class="sce-snap-summary">
              <span v-if="sc.title" class="sce-snap-title">{{ sc.title }}</span>
              <span class="sce-snap-meta">{{ snapSummary(sc) }}</span>
            </span>
            <button class="sce-btn sm" @click="loadScene(sc)">Load</button>
            <button class="sce-btn sm"
                    :class="editingRef?.storyId === story.id && editingRef?.sceneIndex === si ? 'active' : ''"
                    @click="startEditScene(story, si)">Edit</button>
            <button class="sce-rm" @click.prevent="deleteSceneAndCancelEdit(story.id, si)">✕</button>
          </div>
        </div>

        <!-- Export / Import -->
        <div class="sce-btn-row" style="margin-top: 6px">
          <button class="sce-btn" :disabled="!store.stories.value.length"
                  @click="store.exportJSON()">Export JSON</button>
          <label class="sce-btn">
            Import JSON
            <input type="file" accept=".json" class="sce-file-input"
                   @change="onImportFile" />
          </label>
        </div>
        <p v-if="importError" class="sce-error">{{ importError }}</p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from "vue";
import SuperLineChart from "./SuperLineChart.vue";
import FillEditor from "./SuperChartFillEditor.vue";
import { useChartZoom } from "./composables/useChartZoom.js";
import { useSnapshotStore } from "./composables/useSnapshotStore.js";
import { captureScene, serializeScene, deserializeScene } from "../utils/scene/captureScene.js";
import { VALID_CURVES, VALID_EASES } from "../utils/scene/schema.js";

const props = defineProps({
  /** Reactive scene object from the parent. Mutations here drive the chart. */
  scene: { type: Object, required: true },
  /** Data in LineChart format: [{ id, name, values }] */
  data:  { type: Array,  default: () => [] },
});

// ── Chart ref + zoom composable ──────────────────────────────────────────────

const chartRef = ref(null);
const zoomState = useChartZoom(chartRef);

// ── Snapshot store ────────────────────────────────────────────────────────────

const store = useSnapshotStore();
const snapStoryTitle = ref("My Story");
const snapSceneTitle = ref("");
const importError    = ref(null);

// editingRef: { storyId, sceneIndex, storyTitle } while an edit is in progress
const editingRef = ref(null);

function saveSnapshot() {
  const snapshot = captureScene(zoomState, props.scene);
  if (snapSceneTitle.value.trim()) snapshot.title = snapSceneTitle.value.trim();

  if (editingRef.value) {
    // Overwrite the original scene in-place
    store.updateScene(editingRef.value.storyId, editingRef.value.sceneIndex, snapshot);
    editingRef.value = null;
  } else {
    store.saveScene(snapStoryTitle.value, snapshot);
  }
}

function startEditScene(story, si) {
  const sc = story.scenes[si];
  loadScene(sc);
  snapStoryTitle.value = story.title;
  snapSceneTitle.value = sc.title ?? "";
  editingRef.value = { storyId: story.id, sceneIndex: si, storyTitle: story.title };
}

function cancelEdit() {
  editingRef.value = null;
}

function deleteSceneAndCancelEdit(storyId, si) {
  if (editingRef.value?.storyId === storyId && editingRef.value?.sceneIndex === si) {
    editingRef.value = null;
  }
  store.deleteScene(storyId, si);
}

function loadScene(sc) {
  // Deep-clone the snapshot before merging so that subsequent edits to the
  // reactive scene cannot mutate the stored snapshot object.  Without this,
  // Object.assign would share nested array/object references (series, refAreas,
  // etc.) between the live scene and the stored snapshot — edits would then
  // silently corrupt the stored scene.  Zoom survives the shallow path because
  // captureZoom *replaces* scene.zoom with a new object, but nested mutations
  // (moving a ref-area, editing a fill, etc.) would silently mutate the clone.
  const clone = deserializeScene(serializeScene(sc));
  for (const k of Object.keys(props.scene)) {
    if (!(k in clone)) delete props.scene[k];
  }
  Object.assign(props.scene, clone);
}

function snapSummary(sc) {
  const series = sc.series?.map((s) => s.label ?? s.key).join(", ") ?? "—";
  const zoom   = sc.zoom?.x ? `x[${sc.zoom.x.map((v) => +v.toFixed(0))}]` : "no zoom";
  return `${series} · ${zoom}`;
}

function onImportFile(event) {
  importError.value = null;
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      store.importJSON(e.target.result);
    } catch (err) {
      importError.value = `Import failed: ${err.message}`;
    }
  };
  reader.readAsText(file);
  // Reset file input so the same file can be re-imported
  event.target.value = "";
}

// ── Local UI state ────────────────────────────────────────────────────────────

// openSeries[i] = true → series i is expanded in the panel
const openSeries = reactive({});
const copied = ref(false);
let copyTimer = null;

// ── Data x-range (bounds reveal sliders) ─────────────────────────────────────

const dataXRange = computed(() => {
  if (!props.data?.length) return [0, 1];
  const xs = props.data.map((d) => +d.name).filter((v) => Number.isFinite(v));
  if (!xs.length) return [0, 1];
  return [Math.min(...xs), Math.max(...xs)];
});

const dataXStep = computed(() => {
  const range = dataXRange.value[1] - dataXRange.value[0];
  if (range <= 10)   return 0.1;
  if (range <= 100)  return 1;
  if (range <= 1000) return 5;
  return 10;
});

// ── Enum lists ────────────────────────────────────────────────────────────────

const CURVES_LIST = [...VALID_CURVES].sort();
const EASES_LIST  = [...VALID_EASES].sort();

// ── Chart-level helpers ───────────────────────────────────────────────────────

function setChart(key, val) {
  if (!props.scene.chart) props.scene.chart = {};
  props.scene.chart[key] = val;
}

function setForceY(index, raw) {
  if (!props.scene.chart) props.scene.chart = {};
  const current = [...(props.scene.chart.forceY ?? [null, null])];
  current[index] = raw === "" ? null : +raw;
  props.scene.chart.forceY = current.some((v) => v != null) ? current : null;
}

// ── Series helpers ────────────────────────────────────────────────────────────

function seriesHexColor(s) {
  const c = s.stroke?.color;
  if (!c) return "#000000";
  if (typeof c === "string") return /^#[0-9a-f]{3,8}$/i.test(c) ? c : "#000000";
  if (c?.type === "color")   return c.value ?? "#000000";
  // gradient / texture: use first stop color as a preview swatch
  if (c?.stops?.[0]?.color) return c.stops[0].color;
  return "#000000";
}

function setSeriesHexColor(s, hex) {
  if (!s.stroke) s.stroke = {};
  if (s.stroke.color?.type === "color") {
    s.stroke.color = { ...s.stroke.color, value: hex };
  } else {
    s.stroke.color = { type: "color", value: hex };
  }
}

function setSeriesColor(s, desc) {
  if (!s.stroke) s.stroke = {};
  s.stroke.color = desc;
}

function isComplexFill(c) {
  return c && typeof c === "object" && c.type !== "color";
}

function setSStroke(s, key, val) {
  if (!s.stroke) s.stroke = {};
  s.stroke[key] = val;
}

function toggleReveal(s) {
  s.reveal = s.reveal != null
    ? null
    : { start: dataXRange.value[0], end: dataXRange.value[1] };
}

function toggleBand(s) {
  s.band = s.band != null
    ? null
    : {
        upperKey: `${s.key}_upper`,
        lowerKey: `${s.key}_lower`,
        fill:    s.stroke?.color ?? { type: "color", value: "#3b82f6" },
        opacity: 0.18,
      };
}

function bandHexColor(s) {
  const f = s.band?.fill;
  if (!f) return "#000000";
  if (typeof f === "string") return /^#[0-9a-f]{3,8}$/i.test(f) ? f : "#000000";
  if (f.type === "color") return f.value ?? "#000000";
  if (f.stops?.[0]?.color) return f.stops[0].color;
  return "#000000";
}

function setBandHexColor(s, hex) {
  if (!s.band) return;
  s.band.fill = s.band.fill?.type === "color"
    ? { ...s.band.fill, value: hex }
    : { type: "color", value: hex };
}

// ── Ref-area helpers ──────────────────────────────────────────────────────────

function addRefArea() {
  if (!props.scene.refAreas) props.scene.refAreas = [];
  const [xMin, xMax] = dataXRange.value;
  const mid  = (xMin + xMax) / 2;
  const span = (xMax - xMin) * 0.1;
  props.scene.refAreas.push({
    id:          `area-${Date.now()}`,
    x1:          Math.round(mid - span),
    x2:          Math.round(mid + span),
    y1:          -Infinity,
    y2:           Infinity,
    fill:        "rgba(59,130,246,0.15)",
    fillOpacity: 1,
  });
}

function removeRefArea(i) {
  props.scene.refAreas.splice(i, 1);
}

// ── Ref-line helpers ──────────────────────────────────────────────────────────

function addRefLine() {
  if (!props.scene.refLines) props.scene.refLines = [];
  props.scene.refLines.push({
    id:          `line-${Date.now()}`,
    y:           0,
    color:       "#374151",
    strokeWidth: 1.5,
    label:       "Reference",
    labelAlign:  "start",
  });
}

function removeRefLine(i) {
  props.scene.refLines.splice(i, 1);
}

// ── Fill helpers (shared for ref-area fill inputs) ────────────────────────────

function isSolidFill(fill) {
  if (typeof fill === "string") return true;
  return fill?.type === "color";
}

function fillHex(fill) {
  if (typeof fill === "string") {
    return /^#[0-9a-f]{3,8}$/i.test(fill) ? fill : "#000000";
  }
  return fill?.value ?? "#000000";
}

function fillText(fill) {
  if (fill == null) return "";
  if (typeof fill === "string") return fill;
  try { return JSON.stringify(fill); } catch { return ""; }
}

function parseFill(text) {
  if (!text) return null;
  if (text.trimStart().startsWith("{")) {
    try { return JSON.parse(text); } catch { return text; }
  }
  return text;
}

function parseCoord(raw, fallback) {
  if (raw === "" || raw == null) return fallback;
  const n = +raw;
  return Number.isFinite(n) ? n : fallback;
}

// ── Zoom helpers ──────────────────────────────────────────────────────────────

function captureZoom() {
  const x = zoomState.xDomain.value;
  const y = zoomState.yDomain.value;
  if (!x) return;
  props.scene.zoom = { x, ...(y ? { y } : {}) };
}

function clearZoom() {
  props.scene.zoom = null;
}

function formatDomain(d) {
  if (!d) return "—";
  const fmt = (v) => Number.isFinite(v) ? v.toFixed(2) : String(v);
  return `[${fmt(d[0])}, ${fmt(d[1])}]`;
}

function formatZoom(z) {
  if (!z) return "none";
  if (z.x) return `x: [${z.x.map((v) => +v.toFixed(2))}]${z.y ? ` y: [${z.y.map((v) => +v.toFixed(2))}]` : ""}`;
  if (z.transform) return `transform k=${z.transform.k?.toFixed(2)}`;
  return JSON.stringify(z);
}

// ── Export helpers ────────────────────────────────────────────────────────────

const sceneJson = computed(() => {
  try {
    return JSON.stringify(props.scene, (_k, v) => {
      if (v === Infinity)  return "Infinity";
      if (v === -Infinity) return "-Infinity";
      return v;
    }, 2);
  } catch (e) {
    return `// serialization error: ${e.message}`;
  }
});

function copyJson() {
  navigator.clipboard?.writeText(sceneJson.value).then(() => {
    copied.value = true;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copied.value = false), 2000);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

defineExpose({
  zoomState,
  captureZoom,
  clearZoom,
  store,
  saveSnapshot,
  loadScene,
  get chartRef() { return chartRef.value; },
});
</script>

<style scoped>
/* ── Root layout ─────────────────────────────────────────────────────────── */
.sce-root {
  display: flex;
  height: 100%;
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 12px;
  color: #111827;
  overflow: hidden;
}

.sce-chart-pane {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.sce-chart {
  width: 100%;
  height: 100%;
}

/* ── Panel ───────────────────────────────────────────────────────────────── */
.sce-panel {
  flex: 0 0 300px;
  overflow-y: auto;
  border-left: 1px solid #e5e7eb;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
}

.sce-section {
  border-bottom: 1px solid #e5e7eb;
  padding: 10px 12px;
}

.sce-section-title {
  margin: 0 0 7px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* ── Row ─────────────────────────────────────────────────────────────────── */
.sce-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 0;
  min-height: 24px;
}

.sce-indent {
  padding-left: 14px;
}

.sce-label {
  flex: 0 0 68px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 10.5px;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sce-sep {
  flex-shrink: 0;
  color: #9ca3af;
}

/* ── Form controls ───────────────────────────────────────────────────────── */
.sce-row input[type="range"] {
  flex: 1;
  min-width: 0;
  height: 4px;
  accent-color: #374151;
}

.sce-row select {
  flex: 1;
  min-width: 0;
  padding: 2px 4px;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  font-size: 11px;
  background: white;
  color: #111827;
}

.sce-num-display {
  flex: 0 0 50px;
  text-align: right;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 10.5px;
  color: #374151;
}

.sce-num-input {
  width: 60px;
  padding: 2px 4px;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  font-size: 11px;
  text-align: right;
  background: white;
}

.sce-text-input {
  flex: 1;
  min-width: 0;
  padding: 2px 5px;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  font-size: 10.5px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  background: white;
}

.sce-row input[type="color"] {
  width: 26px;
  height: 22px;
  padding: 0;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  cursor: pointer;
  flex-shrink: 0;
}

.sce-row input[type="checkbox"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
  flex-shrink: 0;
}

.sce-badge {
  font-size: 9px;
  padding: 1px 4px;
  background: #dbeafe;
  color: #1d4ed8;
  border-radius: 3px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  flex-shrink: 0;
}

/* ── Series blocks ───────────────────────────────────────────────────────── */
.sce-series {
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  margin-bottom: 4px;
  background: white;
  overflow: hidden;
}

.sce-series-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 11px;
  text-align: left;
}

.sce-series-header:hover {
  background: #f3f4f6;
}

.sce-swatch {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1px solid rgba(0,0,0,0.1);
}

.sce-series-label {
  flex: 1;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
  color: #374151;
}

.sce-chevron {
  font-size: 8px;
  color: #9ca3af;
}

.sce-series-body {
  padding: 4px 8px 6px;
  border-top: 1px solid #f3f4f6;
}

.sce-sub-label {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #9ca3af;
  padding: 4px 0 2px;
}

.sce-fill-block {
  border: 1px solid #e5e7eb;
  border-radius: 3px;
  padding: 5px 6px;
  background: #fafafa;
  margin-bottom: 4px;
}

/* ── Ref blocks ──────────────────────────────────────────────────────────── */
.sce-ref {
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  padding: 5px 8px 6px;
  margin-bottom: 4px;
  background: white;
}

.sce-ref-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 3px;
}

.sce-ref-id {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 10.5px;
  color: #374151;
  font-weight: 500;
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.sce-add-btn {
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 3px;
  padding: 0 6px;
  font-size: 14px;
  line-height: 17px;
  cursor: pointer;
  color: #374151;
}

.sce-add-btn:hover {
  background: #f3f4f6;
}

.sce-rm-btn {
  background: none;
  border: none;
  padding: 1px 3px;
  font-size: 10px;
  cursor: pointer;
  color: #9ca3af;
  border-radius: 3px;
}

.sce-rm-btn:hover {
  color: #ef4444;
  background: #fee2e2;
}

.sce-empty {
  font-size: 11px;
  color: #9ca3af;
  text-align: center;
  padding: 6px 0;
  margin: 0;
  font-style: italic;
}

/* ── Zoom section ────────────────────────────────────────────────────────── */
.sce-domain {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 10px;
  color: #374151;
  background: #f3f4f6;
  padding: 1px 4px;
  border-radius: 3px;
}

.sce-btn-row {
  display: flex;
  gap: 5px;
  margin-top: 7px;
}

.sce-btn {
  flex: 1;
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  color: #374151;
}

.sce-btn:hover:not(:disabled) {
  background: #f3f4f6;
}

.sce-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.sce-btn.primary {
  background: #374151;
  color: white;
  border-color: #374151;
}

.sce-btn.primary:hover:not(:disabled) {
  background: #1f2937;
  border-color: #1f2937;
}

/* ── JSON preview ────────────────────────────────────────────────────────── */
.sce-json-preview {
  margin: 7px 0 0;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 9.5px;
  line-height: 1.45;
  color: #374151;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 3px;
  padding: 6px;
  overflow-x: auto;
  max-height: 220px;
  overflow-y: auto;
  tab-size: 2;
}

/* ── Snapshot section ────────────────────────────────────────────────────── */
.sce-story-name {
  flex: 1;
  min-width: 0;
}

.sce-hint {
  font-size: 9.5px;
  color: #9ca3af;
  margin: 1px 0 5px;
}

.sce-edit-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 3px;
  padding: 4px 7px;
  font-size: 10px;
  color: #92400e;
  margin-bottom: 4px;
}

.sce-btn.sm.active {
  background: #374151;
  color: white;
  border-color: #374151;
}

.sce-error {
  font-size: 10px;
  color: #ef4444;
  margin: 3px 0 0;
}

.sce-story {
  margin-top: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.sce-story-hdr {
  display: flex;
  align-items: center;
  gap: 5px;
  background: #f9fafb;
  padding: 4px 6px;
  border-bottom: 1px solid #e5e7eb;
}

.sce-story-title {
  flex: 1;
  font-size: 10.5px;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sce-story-count {
  flex-shrink: 0;
  font-size: 9.5px;
  color: #6b7280;
}

.sce-snap-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  border-bottom: 1px solid #f3f4f6;
}

.sce-snap-row:last-child {
  border-bottom: none;
}

.sce-snap-idx {
  flex: 0 0 14px;
  font-size: 9.5px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: #9ca3af;
  text-align: center;
}

.sce-snap-summary {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow: hidden;
}

.sce-snap-title {
  font-size: 10px;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sce-snap-meta {
  font-size: 9px;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sce-btn.sm {
  padding: 1px 6px;
  font-size: 9.5px;
}

.sce-file-input {
  display: none;
}
</style>
