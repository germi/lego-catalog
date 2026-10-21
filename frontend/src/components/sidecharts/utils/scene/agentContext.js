/**
 * agentContext.js — Agent API for SuperLineChart stories.
 *
 * Exports
 * -------
 *   buildAgentContext(datasets)   → context bundle to hand an LLM agent
 *   parseStory(json, opts?)       → { story, valid, errors, warnings }
 *
 * Usage
 * -----
 *   // 1. Build context and copy to clipboard / send to LLM
 *   const ctx = buildAgentContext(listDatasets());
 *   // paste ctx into your prompt: "Given this context, write a story about X"
 *
 *   // 2. Take the agent's response (a story JSON string) and play it
 *   const { story, valid, errors } = parseStory(agentJson);
 *   if (valid) player.loadStory(story);
 */

import { validateStory } from "./schema.js";

// ── Enums exposed to agents ────────────────────────────────────────────────────

export const FILL_TYPES = [
  "color",
  "linearGradient",
  "radialGradient",
  "texture",
];

export const TEXTURE_SHAPES       = ["lines", "circles", "paths"];
export const TEXTURE_ORIENTATIONS = ["vertical", "horizontal", "diagonal", "diagonal-back"];
export const LABEL_ALIGNS         = ["start", "middle", "end"];

// ── Schema summary (plain JSON — no code, safe to serialise) ─────────────────

/**
 * A condensed, agent-readable description of the story/scene schema.
 */
const STORY_SCHEMA = {
  story: {
    _note: "Top-level object you return.",
    version: 1,
    title: "string — shown in the UI",
    scenes: "Scene[]  — ordered array; ≥ 1 required",
    data: {
      _note:
        "Optional. Full dataset for this story in compact form — same shape as " +
        "context.datasets[n].values. Include ALL series you want to render " +
        "(base keys you use + any new computed keys). " +
        "If omitted, the base dataset is used unchanged. " +
        "Each key maps to { [year: string]: number } pairs.",
      _example: {
        usa:           { "2018": 2.9, "2019": 2.3, "2020": -3.4 },
        china:         { "2018": 6.7, "2019": 6.0, "2020":  2.3 },
        china_forecast: { "2021": 5.5, "2022": 4.8, "2023": 4.2 },
      },
    },
  },
  scene: {
    _note: "One scene = one animated frame.",
    title: "string — short overlay shown on the chart (≤ 40 chars)",
    chart: {
      duration: "ms for transition animation (default 700)",
      forceY: "[min, max] — KEEP STABLE across all scenes, e.g. [-2, 13]",
      maxZoom: "max zoom level — raise if zoom.x span is narrow (default 10)",
      showXGrid: "boolean",
      showYGrid: "boolean",
    },
    // NOTE on the [ { ... } ] form below — series / areas / refAreas / refLines
    // are ARRAYS of objects with the shape shown. The array wrapper is part of
    // the contract; you ALWAYS put a [ ... ] here even when there's only one
    // entry. Writing a bare object (no surrounding []) is a validation error.
    series: [
      {
        _note:
          "ARRAY OF OBJECTS — order = draw order. Each entry references a " +
          "base dataset key OR a key from story.data. " +
          "Omit `scene.series` entirely → all base keys at defaults.",
        key: "string — REQUIRED; must exist in dataset or story.data",
        label: "string — legend / tooltip",
        stroke: {
          color: "FillDescriptor or CSS color string",
          width: "number (px)",
          opacity: "0–1",
          dasharray: "SVG dasharray e.g. '6 3', or null",
        },
        reveal: {
          _note: "Animate a growing clip rect — great for prediction / future series.",
          start: "number (data-x, e.g. year)",
          end:   "number (data-x)",
        },
        band: {
          _note: "Shaded band between two keys (confidence interval, range, etc.).",
          upperKey: "string — key for upper bound (base or story.data)",
          lowerKey: "string — key for lower bound (base or story.data)",
          fill: "FillDescriptor or CSS color string",
          opacity: "0–1",
        },
      },
    ],
    areas: [
      {
        _note:
          "ARRAY OF OBJECTS — standalone shaded areas drawn UNDER the lines " +
          "using AreaLayer. Same renderer the series `band` uses, but as " +
          "independent specs you can compose at will. Each entry becomes its " +
          "own MaskLayer + AreaLayer, so `reveal` works per area. Use for: " +
          "(a) shaded fill UNDER a single key (baseline-to-value area), " +
          "(b) confidence/forecast bands between two computed series, " +
          "(c) decorative backdrops keyed to actual data. " +
          "Difference from refAreas: refAreas are rectangle/half-plane primitives " +
          "in data-space coords (good for marking time ranges, threshold strips). " +
          "areas follow the data curve itself.",
        id: "string — REQUIRED, stable across scenes for morph animation",
        key:      "string — single-key area: fills from baseline to that series",
        keys:     "string[] — multi-key area; combine with stacked:true for stacked layers",
        upperKey: "string — for a band between two series (paired with lowerKey)",
        lowerKey: "string — for a band between two series (paired with upperKey)",
        color:    "FillDescriptor or CSS color string. For multi-key the same fill is applied to every key.",
        opacity:  "0–1",
        stacked:  "boolean — stack multi-key areas into layered bands",
        curve:    "d3 curve name (e.g. 'monotoneX', 'catmullRom')",
        reveal:   "{ start, end } in data-x — clip-reveal window. Set start === end to hide, then advance end to draw in.",
      },
    ],
    _areas_example_value: [
      { id: "usa-fill",     key:  "usa",                  color: { type: "color", value: "#3b82f6" }, opacity: 0.15 },
      { id: "forecast-band", upperKey: "china_high",       lowerKey: "china_low", color: { type: "color", value: "#ef4444" }, opacity: 0.18,
                            reveal: { start: 2024, end: 2024 } },
    ],
    refAreas: [
      {
        _note:
          "ARRAY OF OBJECTS — shaded rectangular overlays. Annotate events, " +
          "periods, value thresholds. " +
          "IMPORTANT: JSON does not support Infinity literals. " +
          "For unbounded edges use 1e308 (max) or -1e308 (min) — e.g. y1: -1e308, y2: 1e308 fills the full chart height.",
        id: "string — REQUIRED, stable across scenes for morph animation",
        x1: "number — use -1e308 for unbounded left",
        x2: "number — use  1e308 for unbounded right",
        y1: "number — use -1e308 for unbounded bottom",
        y2: "number — use  1e308 for unbounded top",
        fill: "FillDescriptor",
        fillOpacity: "0–1",
        stroke: "CSS color or null",
        strokeWidth: "number",
        strokeDasharray: "SVG dasharray or null",
      },
    ],
    _refAreas_example_value: [
      { id: "gfc-2008", x1: 2008, x2: 2009, y1: -1e308, y2: 1e308, fill: { type: "color", value: "#fb923c" }, fillOpacity: 0.15 },
      { id: "positive-zone", y1: 0,     y2: 1e308, x1: -1e308, x2: 1e308, fill: { type: "color", value: "#10b981" }, fillOpacity: 0.05 },
    ],
    refLines: [
      {
        _note:
          "ARRAY OF OBJECTS — horizontal or vertical rules. Thresholds, " +
          "averages, baselines.",
        id: "string — REQUIRED, stable across scenes",
        y: "horizontal rule at this y value",
        x: "vertical rule at this x value",
        color: "CSS color",
        strokeWidth: "number",
        dasharray: "SVG dasharray or null",
        label: "string",
        labelAlign: "'start' | 'middle' | 'end'",
      },
    ],
    _refLines_example_value: [
      { id: "zero",     y: 0,     color: "#6b7280", strokeWidth: 1,   dasharray: "4 2", label: "zero growth", labelAlign: "end" },
      { id: "crisis-x", x: 2008,  color: "#dc2626", strokeWidth: 1.5, label: "Lehman collapse" },
    ],
    zoom: {
      _note: "Data-space viewport — null resets to full view.",
      x: "[xMin, xMax]",
      y: "[yMin, yMax] — optional",
    },
    narration: {
      text: "caption in scroll / auto player",
      holdMs: "ms to hold this scene in auto mode",
    },
  },
  FillDescriptor: {
    _note: "Use one of these objects wherever a fill/color is expected.",
    color:          { type: "color", value: "#ef4444" },
    linearGradient: {
      type: "linearGradient", x1: 0, y1: 0, x2: 0, y2: 1,
      stops: [{ offset: "0%", color: "#ef4444", opacity: 0.8 }, { offset: "100%", color: "#3b82f6", opacity: 0.2 }],
    },
    texture_lines:   { type: "texture", shape: "lines",   orientation: "diagonal", stroke: "rgba(185,28,28,0.5)", strokeWidth: 1, size: 7 },
    texture_circles: { type: "texture", shape: "circles", fill: "#3b82f6", radius: 3, size: 8 },
  },
};

const AGENT_TIPS = [
  // ── DENSITY EXPECTATIONS (pinned at top — affects every other choice)
  "DENSITY CHECKLIST — before finalising each scene, ask: " +
    "do I have ≥2 refAreas shading the periods/events I'm narrating? " +
    "do I have ≥2 labelled refLines marking thresholds, averages, or pivotal years? " +
    "have I used scene.areas to fill under a series or visualise a gap? " +
    "is zoom.x focused on a meaningful window (not just the full range)? " +
    "does narration reference specific years/numbers that exist as a visible mark? " +
    "If you answer 'no' to two or more of these, the scene is too sparse — add layers until at least 4 of 5 are 'yes'.",
  "MINIMUM 4 SCENES — fewer scenes leave no room to build momentum: scene 1 introduces context, scene 2 zooms into a tension point, scene 3 reveals a new computed series or contrast, scene 4 resolves or zooms back out. 5–7 scenes is even better for richer stories.",
  "INFOGRAPHIC MINDSET — picture each scene as a hand-crafted dashboard frame, not a bare line chart. The lines are the spine; the annotations (refAreas/refLines/areas/zoom) are the muscle that makes a reader stop and read.",

  // ── y-axis stability
  "Keep chart.forceY identical across all scenes — changing it rescales the y-axis mid-story which is disorienting.",

  // ── zoom
  "Use zoom.x to focus on a specific time window in each scene. Pan across eras, zoom in on a crisis, zoom back out for the full picture — zoom transitions are one of the most powerful storytelling tools available.",
  "zoom.x implies a zoom level k = fullXRange / zoomSpan. Set chart.maxZoom ≥ k or the first user gesture will snap.",

  // ── array-shape reminder (common LLM mistake)
  "ARRAY FIELDS — scene.series, scene.areas, scene.refAreas, scene.refLines are ALL arrays. Write `refAreas: [{...}]` NOT `refAreas: {...}` even if you only have one entry. The schema docs show each entry's shape inside [ ... ] to make this unambiguous.",

  // ── refAreas
  "Use refAreas generously — annotate every important period, event, or threshold you mention in narration.text. A shaded band for a recession, a highlighted decade, a threshold zone all add visual context. Use y1: -1e308, y2: 1e308 to fill the full chart height. IMPORTANT: never write -Infinity/Infinity, those are not valid JSON.",
  "Use stable id values on refAreas/refLines/areas across scenes so they morph and fade smoothly rather than flicker.",

  // ── areas (standalone AreaLayer)
  "Use scene.areas for shaded fills that follow the DATA CURVE — single-key fills under a series, forecast bands between two computed series, stacked-area decompositions. They're rendered with the same AreaLayer used internally for series bands, but as freely-composable specs (their own MaskLayer each → reveal animations work per area).",
  "areas vs refAreas, quick rule: if the shape follows the data curve (under a series, between two series), use areas. If it's a fixed rectangle in data-space (mark a year range, a threshold strip), use refAreas. They coexist — render order: refAreas (back) → areas → series lines → refLines (front).",
  "Use areas[].reveal exactly like series[].reveal: set start === end on introduction (fully hidden), then advance end across scenes to draw the fill in left-to-right. Combine with a matching series reveal for a synced line + fill animation.",

  // ── areas storytelling patterns
  // ① GAP-BETWEEN-TWO-SERIES — the one of the most powerful uses
  "STORYTELLING PATTERN — gap between two series: when two lines drift apart and you want the divergence to be visible at a glance, drop an area with upperKey + lowerKey set to those two series, a moderate opacity (0.15–0.25), and a colour that suggests the relationship (warm/red for gap widening unfavourably, cool for narrowing). Example: { id: 'usa-vs-china-gap', upperKey: 'usa', lowerKey: 'china', color: { type:'color', value:'#ef4444' }, opacity: 0.18 } — the shaded region literally IS the gap between the two GDP lines. Pair with a refLine at the crossover year and narration calling out the inflection.",
  // ② ABOVE/BELOW-THRESHOLD using a synthetic key
  "STORYTELLING PATTERN — area above/below a threshold: include a synthetic constant key in story.data (e.g. { zero: { '1980': 0, '1981': 0, … } }), then use it as either upperKey or lowerKey to shade the region between a real series and that threshold. Lets you visually highlight, say, 'years where GDP growth was negative' as a red fill below zero.",
  // ③ FORECAST/CONFIDENCE BAND
  "STORYTELLING PATTERN — forecast cone: compute upper/lower projection keys (e.g. *_high / *_low) into story.data, then add an area with upperKey + lowerKey covering them, a low opacity (~0.12), and the same colour as the central projection. Combine with reveal.start = the first forecast year so the cone draws in from where history ends. The cone visually says 'uncertainty', not 'forecast'.",
  // ④ STACKED DECOMPOSITION
  "STORYTELLING PATTERN — stacked composition: when the story is about parts-of-a-whole, use keys: [...] with stacked: true on a single area spec to render multiple keys stacked. Cleaner than multiple line series for showing 'X is made of these components'.",
  // ⑤ HIGHLIGHT A SINGLE SERIES with its own backdrop
  "STORYTELLING PATTERN — series spotlight: in the scene where you're focused on one series, add an area with `key: '<that series>'` and a faint version of its stroke colour (opacity 0.10–0.18). The filled area makes that line read as the protagonist while leaving the other lines as context. Drop the area in the next scene to release the spotlight.",

  // ── refLines
  "Add refLines with labels for meaningful thresholds: zero-growth baseline, historical averages, target values, etc. A labelled refLine turns a raw number into an insight.",

  // ── series reveal
  "Use series[].reveal to animate a line growing from left to right. A line can start fully hidden by setting reveal.start and reveal.end to the same value (e.g. both 1980). In the next scene advance reveal.end to draw the line forward. Spread this across multiple scenes for a dramatic progressive reveal.",
  "RULE: any series whose data comes from story.data (i.e. a computed or new series not present in the base dataset) MUST use reveal. Always set reveal.start to the first year of that series' data. In the scene where the series is introduced set reveal.end equal to reveal.start (fully hidden). Then advance reveal.end across subsequent scenes to draw the line in.",
  "Use series[].band with upperKey/lowerKey to shade a range between any two keys present in story.data.",

  // ── data
  "If you add new computed keys (forecasts, averages, etc.), include them in story.data alongside the base keys.",
  "You have full access to the dataset values — compute rolling means, ratios, forecasts, whatever tells the story best.",
];

// ── buildAgentContext ─────────────────────────────────────────────────────────

/**
 * Build the context bundle to include in your LLM prompt.
 * The agent uses this to understand the available data and produce a valid story.
 *
 * Each dataset in `datasets` should include:
 *   - All the metadata fields (id, title, keys, keyLabels, xRange, etc.)
 *   - A `values` object: { [key]: { [year]: number } } — the actual data values
 *     (rounded to 2 dp is fine; see datasets.js toContextValues())
 *
 * @param {DatasetWithValues[]} datasets
 * @returns {AgentContext}
 */
export function buildAgentContext(datasets = []) {
  return {
    version: 1,
    role:
      "You are a data-visualisation storyteller. " +
      "You have full access to the dataset values below. " +
      "Analyse the numbers, find the interesting patterns, and " +
      "return a valid SuperLineChart story JSON that tells a compelling narrative.",

    // ── HARD output contract ────────────────────────────────────────────────
    // This block is intentionally redundant with `instructions`. Chat models
    // often skim long instruction lists; restating the format as a separate
    // top-level field with strong "MUST/DO NOT" language meaningfully
    // raises the rate of clean-JSON responses. The page UI also restates
    // the same rules at the END of the pasted prompt (recency bias matters).
    output_contract: {
      format: "ONE single JSON object matching story_schema.",
      must: [
        "First character of your reply MUST be `{`.",
        "Last character of your reply MUST be `}`.",
        "The entire reply MUST be valid JSON parsable by JSON.parse().",
      ],
      must_not: [
        "DO NOT begin with 'Here is', 'Sure', 'Of course', 'Let me', or any greeting.",
        "DO NOT wrap the JSON in ```json fences or any markdown.",
        "DO NOT add commentary, explanation, or prose before or after the JSON.",
        "DO NOT use Infinity / -Infinity literals (invalid JSON). Use 1e308 / -1e308.",
        "DO NOT emit trailing commas, comments (// or /* */), or single-quoted strings.",
      ],
      fallback:
        "If the request is impossible or the schema cannot be satisfied, reply ONLY with: " +
        '{"error":"<one short sentence>"}',
    },

    instructions: [
      // Format rules — restated here so they appear at the START of the joined
      // instruction paragraph too (output_contract above is for skim-readers,
      // these are for sequential readers).
      "CRITICAL: Your entire reply MUST be a single JSON object — nothing else. " +
        "No greeting, no markdown code fences, no commentary before or after. " +
        "The first character of your reply must be `{` and the last must be `}`. " +
        "See output_contract for the full format contract.",
      "The object must match story_schema exactly.",
      "IMPORTANT: base every number strictly on the dataset values provided in this context. " +
        "Do NOT use outside knowledge, real-world figures, or internet data. " +
        "If you compute projections, forecasts, or derived series (rolling averages, ratios, etc.), " +
        "calculate them exclusively from the provided values.",
      "Use series keys from the dataset's `keys` list.",
      "If you need new series (predictions, rolling averages, etc.), compute their values from the dataset, " +
        "add story.data with ALL keys you reference (base + new), in the same compact { [key]: { [year]: number } } format.",
      "If you only use base keys as-is, you may omit story.data entirely.",
      "Keep chart.forceY stable across ALL scenes.",
      "Add narration.text to every scene to guide the viewer.",
      "RICHNESS REQUIREMENT — every scene must be visually dense and impactful. " +
        "Each scene SHOULD use most of these tools in combination, not just one or two: " +
        "(a) MULTIPLE refAreas (typically 2–4 per scene) to shade the periods, events, " +
        "    crises, booms, and threshold zones referenced in narration; " +
        "(b) MULTIPLE labelled refLines (typically 2–3 per scene) for zero baselines, historical averages, " +
        "    target values, vertical markers at pivotal years; " +
        "(c) at least ONE scene.areas spec to fill under a key, between two series (gap/divergence), " +
        "    or to render a forecast cone — pick the storytelling pattern that fits; " +
        "(d) zoom.x progression — most scenes should zoom into a focused window rather than show the full range, " +
        "    and the zoom should move across scenes to guide the eye through the story; " +
        "(e) reveals on at least one series whenever a new/computed key is introduced. " +
        "Sparse scenes (one or two refAreas, no zoom, no areas) are a failure — aim for the look of a hand-crafted infographic.",
      "Any new/computed series (from story.data) MUST use reveal: set reveal.start to the series' first year, " +
        "reveal.end equal to reveal.start on introduction (fully hidden), then advance reveal.end across scenes.",
      "SCENE COUNT — return AT LEAST 4 scenes (4–7 is the sweet spot). " +
        "Stories with fewer scenes are rejected as too thin — there's not enough room to build narrative momentum, " +
        "introduce computed series with proper reveals, or change visual focus through zoom transitions. " +
        "If the user explicitly asks for a specific scene count, honour it; otherwise minimum 4.",
    ].join(" "),
    story_schema:  STORY_SCHEMA,
    datasets,
    enums: {
      fillTypes:           FILL_TYPES,
      textureShapes:       TEXTURE_SHAPES,
      textureOrientations: TEXTURE_ORIENTATIONS,
      labelAligns:         LABEL_ALIGNS,
    },
    tips: AGENT_TIPS,
  };
}

// ── parseStory ────────────────────────────────────────────────────────────────

/**
 * Parse and validate a story JSON string (or object) produced by an agent.
 * Never throws — all errors returned in the result object.
 *
 * Accepts:
 *   - Wrapped story:  { version, title, scenes: [...], data?: {...} }
 *   - Bare array:     [ scene1, scene2, ... ]
 *   - Already-parsed object
 *
 * @param {string | object} json
 * @param {{ data?: Array }} [opts]  Pass `data` for zoom range checks.
 * @returns {{ story: object|null, valid: boolean, errors: string[], warnings: string[] }}
 */
export function parseStory(json, opts = {}) {
  try {
    // 1. Strip markdown code fences — LLMs often wrap output in ```json … ```
    const fenced = typeof json === "string"
      ? json.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
      : json;

    // 2. JSON does not allow Infinity literals — replace them with finite stand-ins
    const sanitised = typeof fenced === "string"
      ? fenced.replace(/-Infinity\b/g, "-1e308").replace(/\bInfinity\b/g, "1e308")
      : fenced;

    const raw = typeof sanitised === "string" ? JSON.parse(sanitised) : sanitised;

    // 3. Accept bare scenes array — wrap it
    let story = Array.isArray(raw)
      ? { version: 1, title: "Agent story", scenes: raw }
      : raw;

    // 4. Unwrap { "story": { … } } double-envelope that some LLMs emit
    if (story && typeof story === "object" && !Array.isArray(story) &&
        !story.scenes && story.story && typeof story.story === "object") {
      story = story.story;
    }

    // 5. Lenient auto-wrap: if a scene's series / areas / refAreas / refLines
    //    field was emitted as a bare object instead of an array (a common LLM
    //    mistake when there's only one entry), wrap it in a single-element
    //    array so it passes validation. Schema docs show these fields with
    //    explicit [ ... ] wrappers but models sometimes still drop them.
    const arrayLikeFields = ["series", "areas", "refAreas", "refLines"];
    const autoWrapWarnings = [];
    if (Array.isArray(story?.scenes)) {
      story.scenes.forEach((scene, sIdx) => {
        if (!scene || typeof scene !== "object") return;
        for (const f of arrayLikeFields) {
          const v = scene[f];
          if (v == null) continue;
          if (Array.isArray(v)) continue;
          if (typeof v === "object") {
            scene[f] = [v];
            autoWrapWarnings.push(
              `scenes[${sIdx}].${f}: auto-wrapped bare object as single-element array`,
            );
          }
        }
      });
    }

    const { valid, errors, warnings } = validateStory(story, opts);
    warnings.push(...autoWrapWarnings);

    // 5. Append a diagnostic hint when scenes is still missing
    if (!Array.isArray(story?.scenes)) {
      const keys = story && typeof story === "object" ? Object.keys(story) : [];
      warnings.push(
        `Parsed object keys: [${keys.join(", ") || "none"}]. ` +
        "Expected a top-level \"scenes\" array.",
      );
    }

    return { story, valid, errors, warnings };
  } catch (e) {
    return {
      story:    null,
      valid:    false,
      errors:   [`JSON parse error: ${e.message}`],
      warnings: [],
    };
  }
}

// ── compactToLineData ─────────────────────────────────────────────────────────

/**
 * Convert a compact agent data object into the LineChart-format row array
 * expected by SuperLineChart / SequencePlayer.
 *
 * Compact format (same shape used in agent context):
 *   { [key]: { [year: string]: number } }
 *
 * Output format:
 *   Array<{ id, name, values: { [key]: { id, name, value } } }>
 *   sorted ascending by year.
 *
 * @param {Record<string, Record<string, number>>} compact
 * @returns {Array}
 */
export function compactToLineData(compact) {
  if (!compact || typeof compact !== "object") return [];

  // Collect all distinct years across all keys
  const yearSet = new Set();
  for (const yearMap of Object.values(compact)) {
    if (yearMap && typeof yearMap === "object") {
      for (const y of Object.keys(yearMap)) yearSet.add(y);
    }
  }

  const years = Array.from(yearSet).sort((a, b) => parseFloat(a) - parseFloat(b));

  return years.map((year) => {
    const values = {};
    for (const [key, yearMap] of Object.entries(compact)) {
      if (yearMap && year in yearMap && typeof yearMap[year] === "number") {
        values[key] = { id: key, name: year, value: yearMap[year] };
      }
    }
    return { id: `y-${year}`, name: year, values };
  });
}
