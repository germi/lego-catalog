<template>
  <!-- ── Scroll mode: two-column — captions left / sticky chart right ─────── -->
  <div v-if="mode === 'scroll'" class="slp-scroll-root">

    <!-- Left column: one step block per scene (caption text) -->
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

    <!-- Right column: sticky chart -->
    <div class="slp-scroll-sticky"
         :style="{ top: headerHeight + 'px', height: 'calc(100vh - ' + headerHeight + 'px)' }">
      <SuperLineChart
        :data="data"
        :chart="activeScene.chart"
        :series="activeScene.series ?? []"
        :ref-areas="activeScene.refAreas ?? []"
        :ref-lines="activeScene.refLines ?? []"
        :zoom="activeScene.zoom ?? null"
        class="slp-chart"
      />
      <!-- Scene title pill (narration shown in left column) -->
      <transition name="slp-fade">
        <div v-if="activeScene.title" :key="currentIndex" class="slp-scene-title-pill">
          {{ activeScene.title }}
        </div>
      </transition>
      <!-- Dot indicator -->
      <div class="slp-scroll-dots">
        <span v-for="(_, i) in story.scenes" :key="i"
              :class="['slp-dot', i === currentIndex && 'active']" />
      </div>
    </div>
  </div>

  <!-- ── Manual / auto mode: fixed chart + bottom controls bar ────────────── -->
  <div v-else class="slp-root">
    <div class="slp-chart-area">
      <SuperLineChart
        :data="data"
        :chart="activeScene.chart"
        :series="activeScene.series ?? []"
        :ref-areas="activeScene.refAreas ?? []"
        :ref-lines="activeScene.refLines ?? []"
        :zoom="activeScene.zoom ?? null"
        class="slp-chart"
      />
      <!-- Info card: scene title + narration text -->
      <transition name="slp-fade">
        <div v-if="activeScene.title || activeScene.narration?.text"
             :key="currentIndex"
             class="slp-info-card">
          <p v-if="activeScene.title" class="slp-info-card-title">{{ activeScene.title }}</p>
          <p v-if="activeScene.narration?.text" class="slp-info-card-text">{{ activeScene.narration.text }}</p>
        </div>
      </transition>
    </div>

    <!-- Controls bar -->
    <div class="slp-controls">
      <!-- Prev -->
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

      <!-- Play / Pause -->
      <button v-if="mode === 'auto'" class="slp-nav-btn"
              @click="togglePlay" :aria-label="playing ? 'Pause' : 'Play'">
        <!-- Play icon -->
        <svg v-if="!playing" viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
        </svg>
        <!-- Pause icon -->
        <svg v-else viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
          <path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clip-rule="evenodd"/>
        </svg>
      </button>

      <!-- Next -->
      <button class="slp-nav-btn" :disabled="!canNext && !loop" @click="next" aria-label="Next scene">
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
          <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd"/>
        </svg>
      </button>
    </div>

    <!-- Auto-mode progress bar (CSS animation, reset via :key) -->
    <div v-if="mode === 'auto'" class="slp-progress-track">
      <div :key="progressKey"
           :class="['slp-progress-fill', playing && 'running']"
           :style="playing ? { animationDuration: currentHoldMs + 'ms' } : {}" />
    </div>
  </div>
</template>

<script setup>
import {
  ref, reactive, computed, watch,
  onMounted, onUnmounted, nextTick,
} from "vue";
import SuperLineChart from "./SuperLineChart.vue";
import { serializeScene, deserializeScene } from "../utils/scene/captureScene.js";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// ── Props & emits ─────────────────────────────────────────────────────────────

const props = defineProps({
  /** Story object: { id, title, scenes: Scene[] } */
  story:      { type: Object,  required: true },
  /** Data in LineChart format (same as SuperLineChart's data prop). */
  data:       { type: Array,   required: true },
  /**
   * Playback mode.
   *  "manual" — prev / next buttons (default)
   *  "auto"   — advances automatically after holdMs per scene
   *  "scroll" — each scene is bound to a scroll step (scrollytelling)
   */
  mode:       { type: String,  default: "manual" },
  /** Default ms to hold each scene in auto mode. */
  holdMs:     { type: Number,  default: 3000 },
  /** Loop back to scene 0 after the last scene (auto / manual). */
  loop:       { type: Boolean, default: false },
  /**
   * Height of each scroll-step block in scroll mode.
   * Any CSS length value, e.g. "80vh", "600px".
   */
  scrollStep: { type: String,  default: "80vh" },
  /** Whether to start playing immediately in auto mode. */
  autoPlay:         { type: Boolean, default: true },
  /**
   * Height of any fixed page header (px). Offsets the sticky chart in scroll
   * mode so it sits below the header. Mirrors ScrollerSection's headerHeight.
   */
  headerHeight:     { type: Number,  default: 0 },
  /** Adds 200 px of extra padding below the last scroll step. */
  addScrollPadding: { type: Boolean, default: false },
});

const emit = defineEmits(["scene-change"]);

// ── Active scene ──────────────────────────────────────────────────────────────

const currentIndex = ref(0);
const progressKey  = ref(0);   // bumped on every advance → restarts CSS animation
const activeScene  = reactive({});

function _applyScene(i) {
  const sc = props.story.scenes?.[i];
  if (!sc) return;
  currentIndex.value = i;

  // Deep-clone via JSON round-trip so edits to the reactive activeScene never
  // bleed back into the stored snapshot (same reason as loadScene in the editor).
  const clone = deserializeScene(serializeScene(sc));
  for (const k of Object.keys(activeScene)) {
    if (!(k in clone)) delete activeScene[k];
  }
  Object.assign(activeScene, clone);
  progressKey.value++;
  emit("scene-change", { index: i, scene: clone });
}

// Re-initialise when the story prop is swapped.
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
  if (canNext.value) {
    goTo(currentIndex.value + 1);
  } else if (props.loop) {
    goTo(0);
  } else if (props.mode === "auto") {
    _pause();
  }
}

// ── Auto mode ─────────────────────────────────────────────────────────────────

const playing  = ref(false);
let   autoTimer = null;

/** Per-scene hold duration: respects narration.holdMs or falls back to prop. */
const currentHoldMs = computed(() => {
  const sc = props.story.scenes?.[currentIndex.value];
  return sc?.narration?.holdMs ?? props.holdMs;
});

function _play() {
  playing.value = true;
  _scheduleNext();
}

function _pause() {
  playing.value = false;
  clearTimeout(autoTimer);
  autoTimer = null;
}

function togglePlay() {
  if (playing.value) _pause(); else _play();
}

function _scheduleNext() {
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    if (!playing.value) return;
    next();
    if (playing.value) _scheduleNext();
  }, currentHoldMs.value);
}

// ── Scroll mode (GSAP ScrollTrigger — same mechanism as ScrollerSection) ─────

/** DOM refs indexed by scene index — one per scroll step block. */
const stepRefs    = [];
const _stTriggers = [];

function setStepRef(el, i) {
  stepRefs[i] = el;
}

function _setupScrollTrigger() {
  _destroyScrollTriggers();
  nextTick(() => {
    for (let i = 0; i < stepRefs.length; i++) {
      const el = stepRefs[i];
      if (!el) continue;
      const idx = i; // capture loop variable
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

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(() => {
  if (props.mode === "scroll") _setupScrollTrigger();
  if (props.mode === "auto" && props.autoPlay) _play();
});

onUnmounted(() => {
  clearTimeout(autoTimer);
  _destroyScrollTriggers();
});

// ── Public API ────────────────────────────────────────────────────────────────

defineExpose({ goTo, prev, next, currentIndex, playing, togglePlay });
</script>

<style scoped>
/* ── Shared ─────────────────────────────────────────────────────────────── */
.slp-chart {
  width: 100%;
  height: 100%;
}

/* Info card — scene title + narration text (top-left, fades on scene change) */
.slp-info-card {
  position: absolute;
  top: 14px;
  left: 14px;
  max-width: 260px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border-radius: 10px;
  padding: 9px 13px;
  pointer-events: none;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.07);
}

.slp-info-card-title {
  font-size: 11px;
  font-weight: 700;
  color: #111827;
  margin: 0;
  line-height: 1.3;
  letter-spacing: 0.01em;
}

.slp-info-card-text {
  font-size: 11px;
  color: #4b5563;
  line-height: 1.55;
  margin: 5px 0 0;
}

.slp-fade-enter-active,
.slp-fade-leave-active { transition: opacity 0.3s ease; }
.slp-fade-enter-from,
.slp-fade-leave-to    { opacity: 0; }

/* Dot row shared across modes */
.slp-dots {
  display: flex;
  gap: 5px;
  align-items: center;
  justify-content: center;
}

.slp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: #d1d5db;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: background 0.2s, transform 0.15s;
}

.slp-dot.active {
  background: #374151;
  transform: scale(1.3);
}

.slp-dot:hover:not(.active) {
  background: #9ca3af;
}

/* ── Manual / auto mode layout ───────────────────────────────────────────── */
.slp-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.slp-chart-area {
  flex: 1;
  min-height: 0;
  position: relative;
}

/* Controls bar */
.slp-controls {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

.slp-nav-btn {
  flex-shrink: 0;
  width: 30px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  color: #374151;
  transition: background 0.15s;
}

.slp-nav-btn:hover:not(:disabled) {
  background: #f3f4f6;
}

.slp-nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* slp-play-btn kept for back-compat but no longer needed — SVG scales itself */

.slp-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 0;
}

.slp-counter {
  font-size: 10px;
  color: #9ca3af;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

/* Auto mode progress bar */
.slp-progress-track {
  height: 3px;
  background: #e5e7eb;
  overflow: hidden;
  flex-shrink: 0;
}

.slp-progress-fill {
  height: 100%;
  width: 0%;
  background: #374151;
}

.slp-progress-fill.running {
  animation: slp-progress linear forwards;
}

@keyframes slp-progress {
  from { width: 0%; }
  to   { width: 100%; }
}

/* ── Scroll mode layout ──────────────────────────────────────────────────── */
.slp-scroll-root {
  display: grid;
  grid-template-columns: 1fr 3fr;
  gap: 24px;
  align-items: start;
}

/* Left column */
.slp-scroll-steps {
  position: relative;
}

.slp-scroll-step {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
}

/* Right column: sticky chart */
.slp-scroll-sticky {
  position: sticky;
  overflow: hidden;
  background: white;
}

.slp-scroll-dots {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 5px;
  pointer-events: none;
}

.slp-scroll-padding {
  height: 200px;
}

.slp-scroll-caption {
  max-width: 280px;
}

.slp-scroll-caption-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px;
}

.slp-scroll-caption-text {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.6;
  margin: 0;
}

/* Scroll-mode: title-only pill over the sticky chart */
.slp-scene-title-pill {
  position: absolute;
  top: 14px;
  left: 14px;
  font-size: 11px;
  font-weight: 700;
  color: #111827;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  padding: 5px 10px;
  border-radius: 20px;
  pointer-events: none;
  white-space: nowrap;
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.07);
}
</style>
