import * as d3 from "d3";
import { shallowRef, computed } from "vue";

/**
 * Reactive zoom-state bridge for parent or sibling components that need to
 * read or drive a chart's zoom without being inside its slot tree.
 *
 * Usage:
 *
 *   const chart = ref(null)
 *   const zoom  = useChartZoom(chart)
 *
 *   // Wire to the chart's emits in the template:
 *   //   <LineChart ref="chart" @zoom="zoom.onZoom" @draw="zoom.onDraw" … />
 *
 *   // Read reactive current domain:
 *   //   zoom.xDomain.value  → [min, max] | null
 *   //   zoom.yDomain.value  → [min, max] | null
 *
 *   // Drive programmatic zoom:
 *   //   zoom.zoomToDomain({ x: [2010, 2020] }, 700)
 *   //   zoom.reset(500)
 *
 * @param {import("vue").Ref} chartRef  - templateRef pointing at a component
 *   that exposes BaseCanvas's zoom methods (LineChart, AreaChart, ScatterPlot,
 *   any map wrapper, or BaseCanvas itself).
 */
export function useChartZoom(chartRef) {
  // The raw d3.ZoomTransform, updated on every @zoom emit.
  const transform = shallowRef(d3.zoomIdentity);

  // The projector from the last @draw payload — gives us the base (unzoomed)
  // x/y scales so we can convert the transform back to data-space domains.
  const projector = shallowRef(null);

  // --- Derived domains ---

  /**
   * Current visible x domain [min, max] in data space, or null when no
   * projector with a raw xScale is available.
   */
  const xDomain = computed(() => {
    const xScale = projector.value?.raw?.xScale;
    if (!xScale || !transform.value) return null;
    try {
      const zoomed = transform.value.rescaleX(xScale);
      const [r0, r1] = xScale.range();
      return [zoomed.invert(r0), zoomed.invert(r1)];
    } catch {
      return null;
    }
  });

  /**
   * Current visible y domain [min, max] in data space, or null when no
   * projector with a raw yScale is available.
   *
   * Note: y scales are typically inverted (range goes from bottom-px to 0),
   * so we return [smallerValue, largerValue] regardless of range direction.
   */
  const yDomain = computed(() => {
    const yScale = projector.value?.raw?.yScale;
    if (!yScale || !transform.value) return null;
    try {
      const zoomed = transform.value.rescaleY(yScale);
      const [r0, r1] = yScale.range();
      const v0 = zoomed.invert(r0);
      const v1 = zoomed.invert(r1);
      // Always return [min, max] regardless of scale direction.
      return v0 <= v1 ? [v0, v1] : [v1, v0];
    } catch {
      return null;
    }
  });

  // --- Handlers to wire to the chart's @zoom / @draw emits ---

  function onZoom(t) {
    transform.value = t ?? d3.zoomIdentity;
  }

  function onDraw(payload) {
    if (payload?.projector) projector.value = payload.projector;
    // The draw payload carries the live zoom transform too. Pull it so
    // `xDomain` / `yDomain` track programmatic zooms (zoomToDomain) — those
    // suppress the @zoom event under the unified-zoom contract, but still
    // fire a draw with the new transform. Without this update, an initial
    // `zoomToDomain` called on first draw would never reach the consumer
    // (a minimap brush, a label, …) until the user did an interactive zoom.
    if (payload?.zoomTransform) transform.value = payload.zoomTransform;
  }

  // --- Programmatic control delegates ---

  function zoomToDomain(opts, duration, ease) {
    chartRef.value?.zoomToDomain(opts, duration, ease);
  }

  // Fit a set of data points by id (delegates to the preset's zoomToIds, which
  // knows the chart's data + accessors). e.g. zoom.zoomToIds(ids, { scale: 0.9 }).
  function zoomToIds(ids, opts) {
    chartRef.value?.zoomToIds?.(ids, opts);
  }

  function setTransform(t, duration, ease) {
    chartRef.value?.setTransform(t, duration, ease);
  }

  function reset(duration, ease) {
    chartRef.value?.resetZoom(duration, ease);
  }

  function zoomIn(duration, ease) {
    chartRef.value?.zoomIn(duration, ease);
  }

  function zoomOut(duration, ease) {
    chartRef.value?.zoomOut(duration, ease);
  }

  return {
    // State
    transform,
    projector,
    xDomain,
    yDomain,
    // Handlers (wire to @zoom / @draw on the chart element)
    onZoom,
    onDraw,
    // Control
    zoomToDomain,
    zoomToIds,
    setTransform,
    reset,
    zoomIn,
    zoomOut,
  };
}
