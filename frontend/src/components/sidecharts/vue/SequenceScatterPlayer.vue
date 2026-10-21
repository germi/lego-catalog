<template>
  <!-- ── Scroll mode ───────────────────────────────────────────────────────── -->
  <div v-if="mode === 'scroll'" class="slp-scroll-root">
    <div class="slp-scroll-steps">
      <div v-for="(sc, i) in story.scenes" :key="i"
           :ref="(el) => setStepRef(el, i)"
           :style="{ minHeight: scrollStep }"
           class="slp-scroll-step">
        <div v-if="sc.title || sc.narration?.text" class="slp-scroll-caption">
          <p v-if="sc.title" class="slp-scroll-caption-title">{{ sc.title }}</p>
          <p v-if="sc.narration?.text" class="slp-scroll-caption-text">{{ sc.narration.text }}</p>
        </div>
      </div>
      <div v-if="addScrollPadding" class="slp-scroll-padding" />
    </div>

    <div class="slp-scroll-sticky"
         :style="{ top: headerHeight + 'px', height: 'calc(100vh - ' + headerHeight + 'px)' }">
      <SuperScatterPlot
        :data="activeYearData"
        :chart="effectiveChart"
        :x-key="activeScene.xKey ?? null"
        :y-key="activeScene.yKey ?? null"
        :r-key="activeScene.rKey ?? null"
        :x-scale-type="activeScene.xScaleType ?? null"
        :y-scale-type="activeScene.yScaleType ?? null"
        :highlighted="activeScene.highlighted ?? []"
        :ref-areas="activeScene.refAreas ?? []"
        :ref-lines="activeScene.refLines ?? []"
        :zoom="activeScene.zoom ?? null"
        class="slp-chart"
      />
      <transition name="slp-fade">
        <div v-if="activeScene.title" :key="currentIndex" class="slp-scene-title-pill">
          {{ activeScene.title }}
        </div>
      </transition>
      <div class="slp-scroll-dots">
        <span v-for="(_, i) in story.scenes" :key="i"
              :class="['slp-dot', i === currentIndex && 'active']" />
      </div>
    </div>
  </div>

  <!-- ── Manual / auto mode ────────────────────────────────────────────────── -->
  <div v-else class="slp-root">
    <div class="slp-chart-area">
      <SuperScatterPlot
        :data="activeYearData"
        :chart="effectiveChart"
        :x-key="activeScene.xKey ?? null"
        :y-key="activeScene.yKey ?? null"
        :r-key="activeScene.rKey ?? null"
        :x-scale-type="activeScene.xScaleType ?? null"
        :y-scale-type="activeScene.yScaleType ?? null"
        :highlighted="activeScene.highlighted ?? []"
        :ref-areas="activeScene.refAreas ?? []"
        :ref-lines="activeScene.refLines ?? []"
        :zoom="activeScene.zoom ?? null"
        class="slp-chart"
      />
      <transition name="slp-fade">
        <div v-if="activeScene.title || activeScene.narration?.text || activeYear"
             :key="currentIndex"
             class="slp-info-card">
          <p v-if="activeScene.title" class="slp-info-card-title">{{ activeScene.title }}</p>
          <p v-if="activeYear" class="slp-info-card-year">{{ activeYear }}</p>
          <p v-if="activeScene.narration?.text" class="slp-info-card-text">{{ activeScene.narration.text }}</p>
        </div>
      </transition>
    </div>

    <div class="slp-controls">
      <button class="slp-nav-btn" :disabled="!canPrev" @click="prev" aria-label="Previous scene">
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
          <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd"/>
        </svg>
      </button>

      <div class="slp-center">
        <div class="slp-dots">
          <button v-for="(sc, i) in story.scenes" :key="i"
                  :class="['slp-dot', i === currentIndex && 'active']"
                  :title="sc.title ?? `Scene ${i + 1}`"
                  @click="goTo(i)" />
        </div>
        <span class="slp-counter">{{ currentIndex + 1 }} / {{ story.scenes.length }}</span>
      </div>

      <button v-if="mode === 'auto'" class="slp-nav-btn"
              @click="togglePlay" :aria-label="playing ? 'Pause' : 'Play'">
        <svg v-if="!playing" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
        </svg>
        <svg v-else viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
          <path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clip-rule="evenodd"/>
        </svg>
      </button>

      <button class="slp-nav-btn" :disabled="!canNext && !loop" @click="next" aria-label="Next scene">
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
          <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd"/>
        </svg>
      </button>

      <!-- Duration override — overrides every scene's chart.duration while set.
           The ⟳ button clears it back to per-scene durations. -->
      <div class="slp-duration" :title="durationOverride == null ? 'Using each scene\'s own duration' : 'Overriding all scene durations'">
        <span class="slp-duration-label">dur</span>
        <input
          type="range" min="0" max="3000" step="50"
          :value="durationOverride ?? sceneDuration"
          @input="durationOverride = +$event.target.value"
        />
        <span class="slp-duration-val">
          {{ durationOverride ?? sceneDuration }}ms
        </span>
        <button
          class="slp-duration-reset"
          :class="{ active: durationOverride != null }"
          title="Use each scene's own duration"
          @click="durationOverride = null"
        >⟳</button>
      </div>
    </div>

    <div v-if="mode === 'auto'" class="slp-progress-track">
      <div :key="progressKey"
           :class="['slp-progress-fill', playing && 'running']"
           :style="playing ? { animationDuration: currentHoldMs + 'ms' } : {}" />
    </div>
  </div>
</template>

<script setup>
/**
 * SequenceScatterPlayer — sibling to SequencePlayer but renders
 * SuperScatterPlot and derives the active year's rows from a per-year
 * data map. Each scene picks a year via `scene.data.year` (or
 * `scene.year` shortcut); the player looks that year up in
 * `props.dataByYear` and hands the matching rows to the chart.
 *
 * Logic / styles intentionally copy SequencePlayer so the two surfaces
 * feel identical — same controls, same scroll mode, same auto-mode
 * progress bar.
 */
import {
  ref, reactive, computed, watch,
  onMounted, onUnmounted, nextTick,
} from "vue";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SuperScatterPlot from "./SuperScatterPlot.vue";
import { serializeScene, deserializeScene } from "../utils/scene/captureScene.js";

gsap.registerPlugin(ScrollTrigger);

const props = defineProps({
  /** Story object: { id, title, scenes: Scene[], defaultYear? }. */
  story:       { type: Object, required: true },
  /**
   * Map of { [year: string | number]: countryRows[] }. The player
   * looks up `scene.data.year` (or `scene.year`) and hands the matching
   * rows down to SuperScatterPlot. Build this from your dataset once
   * and pass it in — the player doesn't know how to parse the raw file.
   */
  dataByYear:  { type: Object, required: true },
  /** Fallback year used when a scene omits one. */
  defaultYear: { type: [String, Number], default: null },
  mode:        { type: String, default: "manual" },
  holdMs:      { type: Number, default: 3000 },
  loop:        { type: Boolean, default: false },
  scrollStep:  { type: String, default: "80vh" },
  autoPlay:    { type: Boolean, default: true },
  headerHeight: { type: Number, default: 0 },
  addScrollPadding: { type: Boolean, default: false },
  /**
   * Initial value for the duration-override slider. null → use each
   * scene's own chart.duration. A number overrides every scene's
   * transition duration. The in-player slider edits this live; pass a
   * value here to seed it (e.g. from a parent slider).
   */
  durationOverride: { type: Number, default: null },
});

const emit = defineEmits(["scene-change"]);

// ── Active scene & year-derived data ───────────────────────────────────────

const currentIndex = ref(0);
const progressKey  = ref(0);
const activeScene  = reactive({});

// ── Duration override ───────────────────────────────────────────────────────
// null → each scene uses its own chart.duration. A number overrides all.
// Seeded from the prop; the slider mutates this local ref.
const durationOverride = ref(props.durationOverride);
watch(() => props.durationOverride, (v) => { durationOverride.value = v; });

// The active scene's own duration (slider default position / reset target).
const sceneDuration = computed(() => activeScene.chart?.duration ?? 700);

// Chart props handed to SuperScatterPlot, with the duration override folded
// in when the slider is active.
const effectiveChart = computed(() =>
  durationOverride.value == null
    ? activeScene.chart
    : { ...activeScene.chart, duration: durationOverride.value },
);

const activeYear = computed(
  () => activeScene.data?.year ?? activeScene.year ?? props.defaultYear ?? null,
);

const activeYearData = computed(() => {
  const y = activeYear.value;
  if (y == null) return [];
  return (
    props.dataByYear[y]
    ?? props.dataByYear[String(y)]
    ?? props.dataByYear[Number(y)]
    ?? []
  );
});

function _applyScene(i) {
  const sc = props.story.scenes?.[i];
  if (!sc) return;
  currentIndex.value = i;
  const clone = deserializeScene(serializeScene(sc));
  for (const k of Object.keys(activeScene)) {
    if (!(k in clone)) delete activeScene[k];
  }
  Object.assign(activeScene, clone);
  progressKey.value++;
  emit("scene-change", { index: i, scene: clone });
}

watch(() => props.story, () => _applyScene(0), { immediate: true });

const canPrev = computed(() => currentIndex.value > 0);
const canNext = computed(() => currentIndex.value < (props.story.scenes?.length ?? 0) - 1);

function goTo(i) {
  const len = props.story.scenes?.length ?? 0;
  if (i < 0 || i >= len) return;
  _applyScene(i);
}

function prev() { goTo(currentIndex.value - 1); }
function next() {
  if (canNext.value) goTo(currentIndex.value + 1);
  else if (props.loop) goTo(0);
  else if (props.mode === "auto") _pause();
}

// ── Auto mode ──────────────────────────────────────────────────────────────

const playing = ref(false);
let autoTimer = null;

const currentHoldMs = computed(() => {
  const sc = props.story.scenes?.[currentIndex.value];
  return sc?.narration?.holdMs ?? props.holdMs;
});

function _play()      { playing.value = true; _scheduleNext(); }
function _pause()     { playing.value = false; clearTimeout(autoTimer); autoTimer = null; }
function togglePlay() { if (playing.value) _pause(); else _play(); }
function _scheduleNext() {
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    if (!playing.value) return;
    next();
    if (playing.value) _scheduleNext();
  }, currentHoldMs.value);
}

// ── Scroll mode ────────────────────────────────────────────────────────────

const stepRefs    = [];
const _stTriggers = [];
function setStepRef(el, i) { stepRefs[i] = el; }

function _setupScrollTrigger() {
  _destroyScrollTriggers();
  nextTick(() => {
    for (let i = 0; i < stepRefs.length; i++) {
      const el = stepRefs[i];
      if (!el) continue;
      const idx = i;
      _stTriggers.push(
        ScrollTrigger.create({
          trigger: el,
          start: "50% 90%",
          end:   "bottom 25%",
          onEnter:     () => goTo(idx),
          onEnterBack: () => goTo(idx),
        }),
      );
    }
  });
}

function _destroyScrollTriggers() {
  _stTriggers.forEach((t) => t.kill());
  _stTriggers.length = 0;
}

onMounted(() => {
  if (props.mode === "scroll") _setupScrollTrigger();
  if (props.mode === "auto" && props.autoPlay) _play();
});

onUnmounted(() => {
  clearTimeout(autoTimer);
  _destroyScrollTriggers();
});

defineExpose({ goTo, prev, next, currentIndex, playing, togglePlay });
</script>

<style scoped>
/* Identical to SequencePlayer.vue's styles — copy is intentional so the
   two surfaces feel uniform without depending on each other. */
.slp-chart { width: 100%; height: 100%; }

.slp-info-card {
  position: absolute; top: 14px; left: 14px; max-width: 260px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  border-radius: 10px; padding: 9px 13px;
  pointer-events: none; box-shadow: 0 1px 6px rgba(0, 0, 0, 0.07);
}
.slp-info-card-title { font-size: 11px; font-weight: 700; color: #111827; margin: 0; line-height: 1.3; letter-spacing: 0.01em; }
.slp-info-card-year  { font-size: 14px; font-weight: 700; color: #2563eb; margin: 2px 0 0; font-variant-numeric: tabular-nums; }
.slp-info-card-text  { font-size: 11px; color: #4b5563; line-height: 1.55; margin: 5px 0 0; }

.slp-fade-enter-active, .slp-fade-leave-active { transition: opacity 0.3s ease; }
.slp-fade-enter-from,   .slp-fade-leave-to    { opacity: 0; }

.slp-dots { display: flex; gap: 5px; align-items: center; justify-content: center; }
.slp-dot {
  width: 8px; height: 8px; border-radius: 50%;
  border: none; background: #d1d5db; cursor: pointer; padding: 0;
  flex-shrink: 0; transition: background 0.2s, transform 0.15s;
}
.slp-dot.active { background: #374151; transform: scale(1.3); }
.slp-dot:hover:not(.active) { background: #9ca3af; }

.slp-root { display: flex; flex-direction: column; width: 100%; height: 100%; }
.slp-chart-area { flex: 1; min-height: 0; position: relative; }

.slp-controls {
  flex-shrink: 0; display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; background: #f9fafb; border-top: 1px solid #e5e7eb;
}
.slp-nav-btn {
  flex-shrink: 0; width: 30px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; border: 1px solid #d1d5db; border-radius: 4px;
  background: white; cursor: pointer; color: #374151; transition: background 0.15s;
}
.slp-nav-btn:hover:not(:disabled) { background: #f3f4f6; }
.slp-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.slp-center { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 0; }
.slp-counter { font-size: 10px; color: #9ca3af; font-family: ui-monospace, SFMono-Regular, monospace; }

/* Duration override slider in the controls bar */
.slp-duration { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.slp-duration input[type="range"] { width: 90px; }
.slp-duration-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #9ca3af; }
.slp-duration-val { font-size: 10px; color: #6b7280; font-family: ui-monospace, SFMono-Regular, monospace; min-width: 48px; text-align: right; }
.slp-duration-reset {
  width: 20px; height: 20px; border: 1px solid #d1d5db; border-radius: 4px;
  background: white; cursor: pointer; color: #9ca3af; font-size: 12px; line-height: 1;
  display: flex; align-items: center; justify-content: center;
}
.slp-duration-reset.active { color: #2563eb; border-color: #93c5fd; }
.slp-duration-reset:hover { background: #f3f4f6; }

.slp-progress-track { height: 3px; background: #e5e7eb; overflow: hidden; flex-shrink: 0; }
.slp-progress-fill  { height: 100%; width: 0%; background: #374151; }
.slp-progress-fill.running { animation: slp-progress linear forwards; }
@keyframes slp-progress { from { width: 0%; } to { width: 100%; } }

.slp-scroll-root { display: grid; grid-template-columns: 1fr 3fr; gap: 24px; align-items: start; }
.slp-scroll-steps { position: relative; }
.slp-scroll-step  { display: flex; align-items: center; justify-content: center; padding: 40px 16px; }
.slp-scroll-sticky { position: sticky; overflow: hidden; background: white; }
.slp-scroll-dots {
  position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 5px; pointer-events: none;
}
.slp-scroll-padding { height: 200px; }
.slp-scroll-caption { max-width: 280px; }
.slp-scroll-caption-title { font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 8px; }
.slp-scroll-caption-text  { font-size: 14px; color: #6b7280; line-height: 1.6; margin: 0; }

.slp-scene-title-pill {
  position: absolute; top: 14px; left: 14px;
  font-size: 11px; font-weight: 700; color: #111827;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  padding: 5px 10px; border-radius: 20px;
  pointer-events: none; white-space: nowrap;
  max-width: 55%; overflow: hidden; text-overflow: ellipsis;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.07);
}
</style>
