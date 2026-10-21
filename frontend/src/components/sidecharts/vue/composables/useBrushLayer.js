import * as d3 from "d3";
import { ref, onUnmounted } from "vue";

/**
 * Map layer that draws a D3 brush overlay in screen (viewBox) space.
 *
 * The brush handles live in the SVG coordinate system, not the zoomed layer
 * group, so they always align with what the user sees regardless of zoom level.
 * Screen coordinates are converted to/from geographic coordinates via the
 * current projection and zoom transform.
 *
 * ─── Config ──────────────────────────────────────────────────────────────────
 *
 *   onBrush(bbox)    — called during drag and on release.
 *                      bbox is [[lon0, lat0], [lon1, lat1]] or null when cleared.
 *
 * ─── Returned ────────────────────────────────────────────────────────────────
 *
 *   onDraw         — wire to @draw
 *   onZoom         — wire to @zoom (tracks transform; does NOT move the brush)
 *   setVisible     — show/hide and enable/disable pointer events
 *   setSelection   — programmatically move the brush to a geographic bbox
 *                    (no-op while the user is dragging or during cooldown)
 *   clearSelection — remove the current selection
 *   isDragging     — reactive ref: true while user is actively brushing
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   const { onDraw, onZoom, setVisible, setSelection, clearSelection, isDragging } =
 *     useBrushLayer({ onBrush: (bbox) => console.log(bbox) })
 *
 *   <WorldMap @draw="onDraw" @zoom="onZoom" />
 *
 * ─── Coordinate spaces ───────────────────────────────────────────────────────
 *
 *   Screen  [sx, sy]  — viewBox coordinates (same as CSS pixels here since
 *                       width/height attrs match the viewBox)
 *   Proj    [px, py]  — pre-zoom projection space (what projection() returns)
 *   Geo     [lon,lat] — geographic coordinates
 *
 *   screen → geo:  projection.invert( transform.invert([sx, sy]) )
 *   geo → screen:  transform.apply( projection([lon, lat]) )
 */
export function useBrushLayer(opts = {}) {
  const { onBrush } = opts;

  let brushGroup       = null;
  let brush            = null;
  let currentProj      = null;
  let currentTransform = d3.zoomIdentity;

  // True while the user has the brush held. setSelection is a no-op during
  // this time so viewport updates don't fight the user's mouse.
  const isDragging = ref(false);

  // ── onDraw ─────────────────────────────────────────────────────────────────

  function onDraw({ projection, svgEl }) {
    currentProj      = projection;
    currentTransform = d3.zoomIdentity; // BaseMap resets zoom on every redraw

    const svgSel = d3.select(svgEl);
    const w = svgEl.viewBox.baseVal.width;
    const h = svgEl.viewBox.baseVal.height;

    // Append once, reuse across redraws.
    if (!brushGroup || !svgEl.contains(brushGroup.node())) {
      brushGroup = svgSel.append("g").attr("class", "brush-layer");
    }

    brush = d3.brush()
      .extent([[0, 0], [w, h]])
      .on("start", (event) => {
        if (!event.sourceEvent) return; // programmatic brush.move — ignore
        isDragging.value = true;
      })
      .on("brush end", handleBrushEnd);

    brushGroup.call(brush);
  }

  // ── onZoom ─────────────────────────────────────────────────────────────────
  // The brush group intentionally does NOT receive the zoom transform — it lives
  // in screen space. We only store the transform for coordinate conversion.

  function onZoom(transform) {
    currentTransform = transform;
  }

  // ── Brush event ────────────────────────────────────────────────────────────

  function handleBrushEnd(event) {
    // event.sourceEvent is null for programmatic brush.move — ignore those.
    if (!event.sourceEvent) return;

    if (event.type === "end") isDragging.value = false;

    if (!event.selection) {
      onBrush?.(null);
      return;
    }

    const [[x0, y0], [x1, y1]] = event.selection;
    const geo0 = currentProj.invert?.(currentTransform.invert([x0, y0]));
    const geo1 = currentProj.invert?.(currentTransform.invert([x1, y1]));
    if (!geo0 || !geo1 || !isFinite(geo0[0]) || !isFinite(geo1[0])) return;
    onBrush?.([geo0, geo1]);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function setVisible(visible) {
    if (!brushGroup) return;
    // Disable pointer events when hidden so the brush doesn't block other layers.
    brushGroup
      .attr("opacity", visible ? 1 : 0)
      .attr("pointer-events", visible ? "all" : "none");
  }

  function setSelection(geoBBox) {
    // Block while the user is actively dragging.
    if (isDragging.value) return;
    if (!brushGroup || !brush || !currentProj) return;

    if (!geoBBox) {
      brushGroup.call(brush.move, null);
    } else {
      const p0 = currentProj(geoBBox[0]);
      const p1 = currentProj(geoBBox[1]);
      if (p0 && p1) {
        const s0 = currentTransform.apply(p0);
        const s1 = currentTransform.apply(p1);
        brushGroup.call(brush.move, [
          [Math.min(s0[0], s1[0]), Math.min(s0[1], s1[1])],
          [Math.max(s0[0], s1[0]), Math.max(s0[1], s1[1])],
        ]);
      }
    }
  }

  function clearSelection() {
    setSelection(null);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  onUnmounted(() => {
    brushGroup?.remove();
    brushGroup = null;
    brush = null;
    currentProj = null;
  });

  return { onDraw, onZoom, setVisible, setSelection, clearSelection, isDragging };
}
