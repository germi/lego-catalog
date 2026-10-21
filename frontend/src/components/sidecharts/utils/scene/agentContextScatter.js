/**
 * agentContextScatter.js — Agent API for SuperScatterPlot stories.
 *
 * Sibling to agentContext.js (which targets SuperLineChart) — the scene
 * schema is different enough (no series, per-scene `year` of data,
 * highlighted point ids, axis-key picker) that a dedicated context
 * keeps the prompt focused and cuts the token count.
 *
 * Exports:
 *   buildScatterAgentContext(opts)   → context bundle to hand the LLM
 *   parseScatterStory(json, opts?)   → { story, valid, errors, warnings }
 */

// ── Schema summary (plain JSON for the agent) ─────────────────────────────────

const STORY_SCHEMA = {
  story: {
    _note: "Top-level object you return.",
    version: 1,
    title:   "string — shown in the UI",
    scenes:  "Scene[] — ordered array; ≥ 4 required (see SCENE COUNT rule)",
    defaultYear:
      "number — fallback year used by any scene that omits `data.year`. " +
      "Pick a recent year that exists in the dataset (see context.dataset.years).",
  },
  scene: {
    _note: "One scene = one frozen frame of the scatter chart.",
    title: "string — short overlay shown on the chart (≤ 40 chars)",
    chart: {
      duration:   "ms for transition animation (default 700)",
      showGrid:   "boolean",
      maxZoom:    "max zoom level — raise if zoom.x span is narrow (default 10)",
      dotOpacity: "0–1 (default 0.78)",
    },
    data: {
      _note:
        "Per-scene data selector. The chart shows ONE year's rows at a " +
        "time; specify the year here. The page swaps the underlying data " +
        "array between scenes — the dots animate smoothly to their new " +
        "x/y/r positions because country id stays stable across years.",
      year: "number — must be one of context.dataset.years",
    },
    // NOTE on the [ { ... } ] form for areas/refAreas/refLines below — these
    // are ARRAYS of objects with the shape shown. The array wrapper is part
    // of the contract; you ALWAYS put a [ ... ] here even with one entry.
    xKey:       "string — column to plot on x. One of context.dataset.metrics",
    yKey:       "string — column to plot on y. One of context.dataset.metrics",
    rKey:       "string — column for bubble radius. One of context.dataset.metrics",
    xScaleType: "'linear' | 'log' | 'sqrt' — overrides per-key default",
    yScaleType: "'linear' | 'log' | 'sqrt' — overrides per-key default",
    highlighted: [
      "string[] — array of point ids (country names) to spotlight. " +
      "Highlighted dots stay vivid; everything else dims. Use this to " +
      "draw attention to the protagonists of the scene's narration. " +
      "Empty / omitted = no highlight (every dot at full opacity).",
    ],
    refAreas: [
      {
        _note:
          "ARRAY OF OBJECTS — shaded rectangular overlays (data-space rectangles) " +
          "OR computed regions like a regression confidence band. " +
          "IMPORTANT: JSON does not allow Infinity literals. " +
          "Use 1e308 / -1e308 for unbounded edges — e.g. y1: -1e308, y2: 1e308 fills the full chart height.",
        id:          "string — REQUIRED, stable across scenes for morph animation",
        x1:          "number — use -1e308 for unbounded left",
        x2:          "number — use  1e308 for unbounded right",
        y1:          "number — use -1e308 for unbounded bottom",
        y2:          "number — use  1e308 for unbounded top",
        rule:        "string | null — alternative to x/y rects: 'regressionCI' draws the regression confidence band",
        ci:          "number — confidence level for regressionCI (e.g. 0.95)",
        fill:        "FillDescriptor or CSS color string",
        fillOpacity: "0–1",
        stroke:      "CSS color or null",
        strokeWidth: "number",
        strokeDasharray: "SVG dasharray or null",
      },
    ],
    _refAreas_example_value: [
      { id: "high-income",    x1: 25000, x2: 1e308, y1: -1e308, y2: 1e308, fill: { type: "color", value: "#3b82f6" }, fillOpacity: 0.07 },
      { id: "regression-ci",  rule: "regressionCI", ci: 0.95, fill: { type: "color", value: "#6b7280" }, fillOpacity: 0.10 },
    ],
    refLines: [
      {
        _note:
          "ARRAY OF OBJECTS — horizontal / vertical / regression / median rules. " +
          "Computed rules (medianX, medianY, meanX, meanY, regression) draw " +
          "themselves from the current scene's data.",
        id:    "string — REQUIRED, stable across scenes",
        y:     "number — horizontal rule at this y value",
        x:     "number — vertical rule at this x value",
        rule:  "string — 'medianX' | 'medianY' | 'meanX' | 'meanY' | 'regression'",
        color: "CSS color",
        strokeWidth: "number",
        dasharray:   "SVG dasharray or null",
        label:       "string",
        labelAlign:  "'start' | 'middle' | 'end'",
      },
    ],
    _refLines_example_value: [
      { id: "median-y", rule: "medianY",   color: "#2e7cb8", strokeWidth: 1.5, dasharray: "4 2", label: "median life exp", labelAlign: "end" },
      { id: "reg",      rule: "regression", color: "#a33333", strokeWidth: 1.5,                  label: "linear fit",      labelAlign: "end" },
    ],
    zoom: {
      _note: "Data-space viewport — null resets to full view.",
      x: "[xMin, xMax]",
      y: "[yMin, yMax] — optional",
    },
    narration: {
      text:   "caption text shown in the scroll / auto player",
      holdMs: "ms to hold this scene in auto mode (default 3000)",
    },
  },
  FillDescriptor: {
    _note: "Use one of these objects wherever a fill/color is expected.",
    color:          { type: "color", value: "#ef4444" },
    linearGradient: {
      type: "linearGradient", x1: 0, y1: 0, x2: 0, y2: 1,
      stops: [
        { offset: "0%",   color: "#ef4444", opacity: 0.8 },
        { offset: "100%", color: "#3b82f6", opacity: 0.2 },
      ],
    },
    texture_lines:   { type: "texture", shape: "lines",   orientation: "diagonal", stroke: "rgba(185,28,28,0.5)", strokeWidth: 1, size: 7 },
    texture_circles: { type: "texture", shape: "circles", fill: "#3b82f6", radius: 3, size: 8 },
  },
};

const AGENT_TIPS = [
  // ── DENSITY EXPECTATIONS — same bar as the line stories.
  "DENSITY CHECKLIST — before finalising each scene, ask: " +
    "do I have ≥1 refArea shading a meaningful region (quadrant, threshold strip, regression CI)? " +
    "do I have ≥1 labelled refLine (median / mean / regression / vertical marker)? " +
    "have I highlighted the 2–5 points the narration actually talks about? " +
    "is zoom.x focused on the relevant range, not just the full extent? " +
    "does narration reference specific countries/numbers that exist as visible marks? " +
    "If two or more answers are 'no', add layers until ≥ 4 of 5 are 'yes'.",
  "MINIMUM 4 SCENES — fewer leaves no room to build narrative momentum.",
  "INFOGRAPHIC MINDSET — picture each scene as a hand-crafted dashboard frame, not a bare scatter.",

  // ── stable ids
  "Use stable id values on refAreas / refLines across scenes so they morph and fade smoothly rather than flicker.",

  // ── array-shape reminder
  "ARRAY FIELDS — scene.refAreas, scene.refLines, scene.highlighted are ALL arrays. Write `refAreas: [{...}]` and `highlighted: [\"China\", \"India\"]` even with one entry. The schema docs show each entry's shape inside [ ... ] to make this unambiguous.",

  // ── year-driven data swap
  "YEAR SWAPS — each scene's `data.year` selects which year's rows the chart shows. Country ids are stable across years, so the dots animate smoothly to their new positions when you change year between scenes. Use this for time-travel stories: scene 1 shows 1960, scene 2 shows 1990, etc. and the same dots morph in place.",
  "Pick years that EXIST in context.dataset.years. If you reference a country in narration, double-check it actually has data for that year (see context.dataset.countries) — dots without all three metrics get filtered out.",

  // ── axis keys
  "AXIS KEYS — xKey/yKey/rKey select WHICH of context.dataset.metrics to plot on each axis. Pick combinations that surface interesting patterns: income vs life_exp (the classic Gapminder bubble), income vs population (size of economies vs people), life_exp vs population (developing-country health stories).",
  "When you change xKey or yKey between scenes, the points animate to their new positions on the new axes — beautiful for showing 'here's the same world ranked differently'.",

  // ── HIGHLIGHTING — the most powerful per-scene tool
  "HIGHLIGHTING — `scene.highlighted` is an array of country names (point ids). The named dots stay vivid; every OTHER dot dims to ~20% opacity. Use this to make narration land visually: when you mention China and India in the text, put them in highlighted. The reader's eye locks on the protagonists without you having to draw arrows.",
  "STORYTELLING PATTERN — protagonist arc: scene 1 highlights ONE country (the protagonist). Scene 2 highlights TWO (the protagonist + its closest peer or rival). Scene 3 highlights a CLUSTER (a continent, an income tier). Scene 4 clears highlighted entirely to release attention. The progression creates a film-like zoom-then-pull-back rhythm.",
  "STORYTELLING PATTERN — country pair: highlight exactly two countries the narration contrasts (e.g. ['South Korea', 'Argentina'] for a 'they started at the same income in 1960 — look at them now' beat).",
  "STORYTELLING PATTERN — continent spotlight: highlight every country of one continent (the agent context lists countries by continent). Pair with a refLine at that continent's median to anchor the eye.",

  // ── refAreas storytelling patterns
  "STORYTELLING PATTERN — quadrant: split the chart into meaningful quadrants with refAreas. E.g. high-income / low-life-expectancy (rich but unhealthy) is rare — shade it red @ opacity 0.08 to make the absence visible. Combine with refLines through the medians for the quadrant boundaries.",
  "STORYTELLING PATTERN — threshold strip: 'below this y value = extreme poverty', 'above this x value = high income'. Use refAreas with y1/y2 or x1/x2 set on one side and ±1e308 on the other.",
  "STORYTELLING PATTERN — regression CI: refAreas accepts `rule: 'regressionCI', ci: 0.95` to draw the confidence band around the linear fit of the current scene's data. Pair with `refLines: [{ rule: 'regression' }]` to get the line itself. Lets you show 'these countries are the outliers' visually.",

  // ── refLines storytelling patterns
  "Add labelled refLines with `rule: 'medianX' | 'medianY' | 'meanX' | 'meanY'` to mark the centre of the distribution. They redraw from the active scene's data — so when you swap years, the median shifts on its own.",
  "Use `rule: 'regression'` to draw a sampled regression curve. Works on any axis type (log / linear / sqrt) — the line traces the actual curve through the projection.",

  // ── zoom
  "Use zoom.x AND zoom.y to focus on a sub-region of the chart. Pan around between scenes — zoom in on Africa, then zoom out to the whole world. zoom transitions are one of the most powerful storytelling tools available.",
  "zoom.x implies a zoom level k = fullXRange / zoomSpan. Set chart.maxZoom ≥ k or the first user gesture will snap.",
];

// ── Output contract — copied verbatim from agentContext.js so chat models ────
// get the same JSON-only enforcement and the page can reuse the same footer
// in copyAgentContext.

const OUTPUT_CONTRACT = {
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
};

// ── buildScatterAgentContext ────────────────────────────────────────────────

/**
 * Build the LLM context bundle for SuperScatterPlot stories.
 *
 * @param {object} opts
 * @param {number[]} opts.years         All years available in the dataset.
 * @param {string[]} opts.metrics       Available metrics (the columns the
 *                                       agent can plot on x/y/r).
 * @param {Record<string, string>} opts.metricLabels  Human labels for metrics.
 * @param {Array<{country, continent}>} opts.countries  All distinct country
 *                                       ids + continent, sorted alphabetically.
 *                                       Lets the agent name protagonists
 *                                       without hallucinating ids.
 * @param {string[]} opts.continents    Distinct continent names.
 * @returns {object}
 */
export function buildScatterAgentContext({
  years     = [],
  metrics   = [],
  metricLabels = {},
  countries = [],
  continents   = [],
} = {}) {
  return {
    version: 1,
    role:
      "You are a data-visualisation storyteller. " +
      "You have full access to the dataset metadata below — the years " +
      "available, the metrics the agent can plot, and the full country " +
      "roster. Compose a SuperScatterPlot story that tells a compelling " +
      "narrative across multiple scenes.",
    output_contract: OUTPUT_CONTRACT,
    instructions: [
      "CRITICAL: Your entire reply MUST be a single JSON object — nothing else. " +
        "No greeting, no markdown code fences, no commentary before or after. " +
        "First char `{`, last char `}`. See output_contract for the full format contract.",
      "The object must match story_schema exactly.",
      "Base every country reference on context.dataset.countries — don't hallucinate ids. " +
        "Country ids in `highlighted` MUST be exact matches (case-sensitive).",
      "Pick years from context.dataset.years. Set story.defaultYear to a meaningful start year, " +
        "and scene.data.year on every scene unless you want it to inherit the default.",
      "Choose xKey / yKey / rKey from context.dataset.metrics. The classic Gapminder mapping is " +
        "xKey:'income', yKey:'life_exp', rKey:'population' — start there unless the story has a reason to diverge.",
      "RICHNESS REQUIREMENT — every scene must be visually dense and impactful: " +
        "(a) highlighted: 2–5 protagonists matching what narration mentions; " +
        "(b) ≥1 refArea per scene (quadrant, threshold strip, or regression CI); " +
        "(c) ≥1 labelled refLine (median / mean / regression / vertical marker); " +
        "(d) zoom.x focused on the relevant range when zooming-in adds clarity. " +
        "Sparse scenes (no highlight, one refLine, no zoom) are a failure — aim for the look of a hand-crafted infographic.",
      "SCENE COUNT — return AT LEAST 4 scenes (4–7 is the sweet spot).",
      "Add narration.text to every scene to guide the viewer. " +
        "Reference specific countries/numbers/years that the visual marks confirm.",
    ].join(" "),
    story_schema: STORY_SCHEMA,
    dataset: {
      years,
      metrics,
      metricLabels,
      continents,
      countries,
      _note:
        "`years` lists every year with data. " +
        "`metrics` lists the columns you can plot on x/y/r. " +
        "`countries` is the canonical list of point ids — use exact strings in scene.highlighted.",
    },
    tips: AGENT_TIPS,
  };
}

// ── parseScatterStory ──────────────────────────────────────────────────────

/**
 * Lenient parser: strips markdown fences, replaces Infinity literals,
 * unwraps double-envelope `{ story: {...} }`, auto-wraps bare objects in
 * single-element arrays for refAreas/refLines, then runs validation.
 */
export function parseScatterStory(json, opts = {}) {
  try {
    const fenced = typeof json === "string"
      ? json.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
      : json;
    const sanitised = typeof fenced === "string"
      ? fenced.replace(/-Infinity\b/g, "-1e308").replace(/\bInfinity\b/g, "1e308")
      : fenced;
    const raw = typeof sanitised === "string" ? JSON.parse(sanitised) : sanitised;

    let story = Array.isArray(raw)
      ? { version: 1, title: "Agent story", scenes: raw }
      : raw;
    if (story && typeof story === "object" && !Array.isArray(story)
        && !story.scenes && story.story && typeof story.story === "object") {
      story = story.story;
    }

    // Auto-wrap bare-object refAreas / refLines / highlighted into arrays.
    const autoWrapWarnings = [];
    if (Array.isArray(story?.scenes)) {
      story.scenes.forEach((scene, sIdx) => {
        if (!scene || typeof scene !== "object") return;
        for (const f of ["refAreas", "refLines"]) {
          const v = scene[f];
          if (v == null) continue;
          if (Array.isArray(v)) continue;
          if (typeof v === "object") {
            scene[f] = [v];
            autoWrapWarnings.push(`scenes[${sIdx}].${f}: auto-wrapped bare object as single-element array`);
          }
        }
        // highlighted: agent might emit a single string instead of an array.
        if (scene.highlighted != null && !Array.isArray(scene.highlighted)
            && typeof scene.highlighted === "string") {
          scene.highlighted = [scene.highlighted];
          autoWrapWarnings.push(`scenes[${sIdx}].highlighted: auto-wrapped bare string as single-element array`);
        }
      });
    }

    const { valid, errors, warnings } = validateScatterStory(story, opts);
    warnings.push(...autoWrapWarnings);
    return { story, valid, errors, warnings };
  } catch (e) {
    return { story: null, valid: false, errors: [`JSON parse error: ${e.message}`], warnings: [] };
  }
}

// ── validateScatterStory ───────────────────────────────────────────────────

const inRange01 = (v) => typeof v === "number" && isFinite(v) && v >= 0 && v <= 1;
const isFiniteNum = (v) => typeof v === "number" && isFinite(v);
const isStr = (v) => typeof v === "string";
const isPlainObj = (v) => v && typeof v === "object" && !Array.isArray(v);

function validateRefAreaScatter(a, i, errors, warnings) {
  const at = `refAreas[${i}]`;
  if (!isPlainObj(a)) { errors.push(`${at}: must be an object`); return; }
  if (!isStr(a.id) || !a.id) errors.push(`${at}.id: required, non-empty string`);
  if (a.fillOpacity != null && !inRange01(a.fillOpacity))
    errors.push(`${at}.fillOpacity: must be in [0, 1]`);
  for (const k of ["x1", "x2", "y1", "y2"]) {
    const v = a[k];
    if (v != null && !isFiniteNum(v) && v !== Infinity && v !== -Infinity)
      errors.push(`${at}.${k}: must be a finite number or ±Infinity`);
  }
}

function validateRefLineScatter(l, i, errors, warnings) {
  const at = `refLines[${i}]`;
  if (!isPlainObj(l)) { errors.push(`${at}: must be an object`); return; }
  if (!isStr(l.id) || !l.id) errors.push(`${at}.id: required, non-empty string`);
  const hasCoords = l.y != null || l.x != null || l.x1 != null || l.rule != null;
  if (!hasCoords) warnings.push(`${at}: no coordinate (x, y, x1, rule) — line will not render`);
}

function validateScene(s, i, errors, warnings, opts) {
  const at = `scenes[${i}]`;
  if (!isPlainObj(s)) { errors.push(`${at}: must be an object`); return; }

  if (s.data?.year != null && !isFiniteNum(s.data.year))
    errors.push(`${at}.data.year: must be a finite number`);
  if (s.year != null && !isFiniteNum(s.year))
    errors.push(`${at}.year: must be a finite number`);

  const year = s.data?.year ?? s.year;
  if (year != null && Array.isArray(opts.years) && opts.years.length
      && !opts.years.some((y) => Number(y) === Number(year)))
    warnings.push(`${at}.data.year: ${year} not in dataset.years — chart will be empty`);

  for (const k of ["xKey", "yKey", "rKey"]) {
    if (s[k] != null && !isStr(s[k])) errors.push(`${at}.${k}: must be a string`);
    if (s[k] && Array.isArray(opts.metrics) && opts.metrics.length
        && !opts.metrics.includes(s[k]))
      warnings.push(`${at}.${k}: "${s[k]}" not in dataset.metrics`);
  }

  if (s.highlighted != null) {
    if (!Array.isArray(s.highlighted))
      errors.push(`${at}.highlighted: must be an array of point ids (strings)`);
    else s.highlighted.forEach((id, hi) => {
      if (!isStr(id)) errors.push(`${at}.highlighted[${hi}]: must be a string`);
    });
  }

  if (s.refAreas != null) {
    if (!Array.isArray(s.refAreas)) errors.push(`${at}.refAreas: must be an array`);
    else s.refAreas.forEach((a, ai) => validateRefAreaScatter(a, ai, errors, warnings));
  }
  if (s.refLines != null) {
    if (!Array.isArray(s.refLines)) errors.push(`${at}.refLines: must be an array`);
    else s.refLines.forEach((l, li) => validateRefLineScatter(l, li, errors, warnings));
  }
}

export function validateScatterStory(story, opts = {}) {
  const errors = [];
  const warnings = [];
  if (!isPlainObj(story)) {
    errors.push("story: must be an object");
    return { valid: false, errors, warnings };
  }
  if (!Array.isArray(story.scenes) || story.scenes.length === 0) {
    errors.push("story.scenes: must be a non-empty array");
    return { valid: false, errors, warnings };
  }
  if (story.scenes.length < 4) {
    warnings.push("story.scenes: fewer than 4 scenes — the agent context recommends ≥ 4 for momentum");
  }
  story.scenes.forEach((sc, i) => validateScene(sc, i, errors, warnings, opts));
  return { valid: errors.length === 0, errors, warnings };
}
