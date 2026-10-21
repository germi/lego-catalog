import * as d3 from "d3";

export const BRUSH_LAYER_DEFAULTS = {
  mode:        "x",    // "x" | "y" | "xy"
  selectionX:  null,   // [min, max] in data space | null  (x-axis selection)
  selectionY:  null,   // [min, max] in data space | null  (y-axis selection)
  snapValues:  null,   // flat array of data-space x values to snap to on brush end
  snapToData:  false,
  showHandles: true,
  fill:        "rgba(99,102,241,0.15)",
  stroke:      "#6366f1",
  strokeWidth: 1,
  strokeDasharray: null, // SVG stroke-dasharray (e.g. "4 2") for the selection rect
  // When true, the brush's full-canvas overlay rect (used to click-drag a
  // new selection) becomes pointer-transparent.  The visible selection rect
  // and edge handles stay interactive so existing selections can still be
  // moved/resized, but the underlying chart receives hover/click events on
  // the unselected area.  Useful when the brush coexists with a LineLayer
  // hover overlay.
  disableOverlay: false,
  margin:      null,   // null → inherit from chartContext / payload
  padding:     null,
};

export function createBrushLayer() {
  let brushGroup    = null;
  let brushBehavior = null;
  let lastPayload   = null;
  let lastProps     = null;
  let lastProjector = null;   // tracks projector identity across renders so
                              // we know when a scale/data change happened
  let lastTransform = d3.zoomIdentity;
  // Last `payload.zoomTransform` seen by render() — used to decide whether
  // a programmatic zoom landed since the previous draw, which is what we
  // animate the brush rect over (rather than per-frame onZoom, which is
  // suppressed for programmatic zoom under the unified-zoom plan).
  let _lastDrawTransform = null;
  let lastOrder     = undefined;
  // Prevents the brush "brush" / "end" events that fire when we call
  // brush.move() programmatically from being forwarded to the consumer.
  let _external     = false;
  // True between "start" and "end" while the user is actively dragging the
  // brush.  External state echoes (parent chart zoom → :selection-x prop
  // change → rerender / onZoom calls) skip brush.move() in this state so
  // they don't fight the user's interaction.  Needed for live drag → zoom
  // bidirectional binding (minimap pattern).
  let _userDragging = false;

  // ─── Coordinate helpers ────────────────────────────────────────────────────

  /**
   * The margin+padding offset that maps a 0-relative plot-area coordinate
   * (what the projector's xScale/yScale produce) to an SVG screen coordinate.
   *
   * xScale(d) → plot-relative px → + off.left  → SVG px
   * yScale(d) → plot-relative px → + off.top   → SVG px
   */
  function plotOffset(payload, props) {
    const m = props?.margin  ?? payload?.margin ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const p = props?.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
    return {
      left:   (m.left   ?? 0) + (p.left   ?? 0),
      top:    (m.top    ?? 0) + (p.top    ?? 0),
      right:  (m.right  ?? 0) + (p.right  ?? 0),
      bottom: (m.bottom ?? 0) + (p.bottom ?? 0),
    };
  }

  /**
   * The brush extent [[x0,y0],[x1,y1]] in SVG screen coords — covers the full
   * plot area so the user can brush anywhere within the chart.
   */
  function brushExtent(payload, props) {
    const off = plotOffset(payload, props);
    return [
      [off.left,                      off.top],
      [payload.width  - off.right,    payload.height - off.bottom],
    ];
  }

  /**
   * Get the zoomed x/y scales for the current frame.
   * xScale(d) still returns plot-relative px (0…plotWidth); the zoom
   * transform stretches/translates that range.
   */
  function getScales(payload, transform) {
    const raw = payload?.projector?.raw;
    if (!raw?.xScale && !raw?.yScale) return { x: null, y: null };
    const t        = transform && transform !== d3.zoomIdentity ? transform : null;
    const zoomAxes = payload?.zoomAxes ?? "xy";
    const wantX    = zoomAxes === "xy" || zoomAxes === "x";
    const wantY    = zoomAxes === "xy" || zoomAxes === "y";
    return {
      x: raw.xScale ? (t && wantX ? t.rescaleX(raw.xScale) : raw.xScale) : null,
      y: raw.yScale ? (t && wantY ? t.rescaleY(raw.yScale) : raw.yScale) : null,
    };
  }

  // data value → SVG screen px
  function toScreenX(val, scales, off) {
    return scales.x != null ? off.left + scales.x(val) : null;
  }
  function toScreenY(val, scales, off) {
    return scales.y != null ? off.top  + scales.y(val) : null;
  }

  // SVG screen px → data value
  function toDataX(px, scales, off) {
    return scales.x?.invert ? scales.x.invert(px - off.left) : null;
  }
  function toDataY(py, scales, off) {
    return scales.y?.invert ? scales.y.invert(py - off.top)  : null;
  }

  function snapNearest(val, snapValues) {
    if (!snapValues?.length || val == null) return val;
    return snapValues.reduce((best, v) =>
      Math.abs(v - val) < Math.abs(best - val) ? v : best
    );
  }

  /**
   * Convert a data-space [min, max] pair → screen-space [px0, px1].
   * Returns null if scale or values are unavailable.
   */
  function dataPairToScreen(pair, toScreenFn, scales, off) {
    if (!pair) return null;
    const s0 = toScreenFn(pair[0], scales, off);
    const s1 = toScreenFn(pair[1], scales, off);
    if (s0 == null || s1 == null) return null;
    return [Math.min(s0, s1), Math.max(s0, s1)];
  }

  /**
   * Compute the screen-space brush selection from the current data-space
   * selectionX / selectionY props and the (zoomed) scales.
   * Returns the value expected by brush.move(): [x0,x1] for brushX,
   * [y0,y1] for brushY, or [[x0,y0],[x1,y1]] for brush2D.
   */
  function dataSelectionToScreen(props, scales, off, payload) {
    const mode = props.mode ?? "x";
    if (mode === "x") {
      return dataPairToScreen(props.selectionX, toScreenX, scales, off);
    }
    if (mode === "y") {
      return dataPairToScreen(props.selectionY, toScreenY, scales, off);
    }
    // "xy" — 2D brush: [[x0,y0],[x1,y1]]
    const xSel = dataPairToScreen(props.selectionX, toScreenX, scales, off);
    const ySel = dataPairToScreen(props.selectionY, toScreenY, scales, off);
    if (!xSel && !ySel) return null;
    const ext = brushExtent(payload, props);
    return [
      [xSel ? xSel[0] : ext[0][0],  ySel ? ySel[0] : ext[0][1]],
      [xSel ? xSel[1] : ext[1][0],  ySel ? ySel[1] : ext[1][1]],
    ];
  }

  /**
   * Convert a d3-brush screen selection back to { x: [min,max]|null, y: [min,max]|null }
   * in data space.  Handles all three brush modes.
   */
  function screenSelectionToData(brushSel, mode, scales, off, props) {
    if (!brushSel) return { x: null, y: null };

    let x = null;
    let y = null;

    if (mode === "x") {
      const d0 = toDataX(brushSel[0], scales, off);
      const d1 = toDataX(brushSel[1], scales, off);
      if (d0 != null && d1 != null) x = [Math.min(d0, d1), Math.max(d0, d1)];
    } else if (mode === "y") {
      const d0 = toDataY(brushSel[0], scales, off);
      const d1 = toDataY(brushSel[1], scales, off);
      if (d0 != null && d1 != null) y = [Math.min(d0, d1), Math.max(d0, d1)];
    } else {
      const x0 = toDataX(brushSel[0][0], scales, off);
      const x1 = toDataX(brushSel[1][0], scales, off);
      const y0 = toDataY(brushSel[0][1], scales, off);
      const y1 = toDataY(brushSel[1][1], scales, off);
      if (x0 != null && x1 != null) x = [Math.min(x0, x1), Math.max(x0, x1)];
      if (y0 != null && y1 != null) y = [Math.min(y0, y1), Math.max(y0, y1)];
    }

    // Snap x endpoints to the nearest provided data values
    if (props.snapToData && props.snapValues?.length && x) {
      x = [snapNearest(x[0], props.snapValues), snapNearest(x[1], props.snapValues)];
      if (x[0] === x[1]) x = null; // collapsed selection → clear
    }

    return { x, y };
  }

  // ─── Brush event handlers ──────────────────────────────────────────────────

  function onBrushEvent(event) {
    if (_external || !lastPayload || !lastProps) return;
    const mode   = lastProps.mode ?? "x";
    const off    = plotOffset(lastPayload, lastProps);
    const scales = getScales(lastPayload, lastTransform);
    const data   = screenSelectionToData(event.selection, mode, scales, off, lastProps);
    applyStyle();
    lastProps.onBrush?.(data);
  }

  function onBrushEnd(event) {
    if (_external || !lastPayload || !lastProps) return;
    const mode   = lastProps.mode ?? "x";
    const off    = plotOffset(lastPayload, lastProps);
    const scales = getScales(lastPayload, lastTransform);

    if (!event.selection) {
      lastProps.onSelect?.({ x: null, y: null });
      return;
    }

    const data = screenSelectionToData(event.selection, mode, scales, off, lastProps);

    // Snap: re-apply the snapped position visually
    if (lastProps.snapToData && lastProps.snapValues?.length && data.x) {
      const snappedScreen = dataSelectionToScreen(
        { ...lastProps, selectionX: data.x, selectionY: data.y },
        scales, off, lastPayload,
      );
      _external = true;
      brushGroup.call(brushBehavior.move, snappedScreen);
      _external = false;
    }

    applyStyle();
    lastProps.onSelect?.(data);
  }

  // ─── Internal setup ────────────────────────────────────────────────────────

  function applyStyle() {
    if (!brushGroup || !lastProps) return;
    brushGroup.select(".selection")
      .attr("fill",             lastProps.fill            ?? "rgba(99,102,241,0.15)")
      .attr("stroke",           lastProps.stroke          ?? "#6366f1")
      .attr("stroke-width",     lastProps.strokeWidth     ?? 1)
      .attr("stroke-dasharray", lastProps.strokeDasharray ?? null);
    if (lastProps.showHandles === false) {
      brushGroup.selectAll(".handle").attr("display", "none");
    } else {
      brushGroup.selectAll(".handle").attr("display", null);
    }
    // The full-canvas overlay rect is d3-brush's "click here to start a new
    // selection" target.  Setting pointer-events:none on it lets mouse
    // events flow through to whatever chart overlay sits underneath while
    // keeping the selection rect + handles (which live on their own
    // sub-elements with their own listeners) fully interactive.
    brushGroup.select(".overlay")
      .attr("pointer-events", lastProps.disableOverlay ? "none" : null);
  }

  let lastMode = null;

  /**
   * (Re)create the d3 brush with the correct mode and extent, then re-apply
   * the current data-space selection.  Called on every render so that canvas
   * resize updates the extent automatically.
   *
   * `moveDuration` controls how brush.move runs the rect from its current
   * screen position to the target one.  0 (default) is instant; >0 wraps the
   * call in a D3 transition so the rect tweens smoothly — used by render()
   * when the chart's projector has just swapped, so the brush slides in
   * lockstep with the lines instead of snapping to the new scale.
   *
   * The brush behaviour itself is only (re)created when the mode changes or
   * on first mount.  Re-creating it on every render would reset d3-brush's
   * internal __brush state on the group and break the smooth tween — the
   * new behaviour starts from "no selection" rather than from the current
   * on-screen rect.
   */
  function setupBrush(payload, props, scales, off, moveDuration = 0) {
    const ext  = brushExtent(payload, props);
    const mode = props.mode ?? "x";
    const needsRebuild = !brushBehavior || mode !== lastMode;

    if (needsRebuild) {
      const factory = mode === "x" ? d3.brushX : mode === "y" ? d3.brushY : d3.brush;
      brushBehavior = factory()
        .extent(ext)
        .on("start", (event) => { if (event.sourceEvent) _userDragging = true; })
        .on("brush", onBrushEvent)
        .on("end",   (event) => { _userDragging = false; onBrushEnd(event); });
      brushGroup.call(brushBehavior);
      lastMode = mode;
    } else {
      // Same brush instance — just refresh the extent (canvas resize, etc.)
      // and keep the existing __brush state intact so transitions can tween
      // from the rect's current screen position.
      brushBehavior.extent(ext);
    }
    applyStyle();

    const screenSel = dataSelectionToScreen(props, scales, off, payload);
    _external = true;
    if (moveDuration > 0) {
      brushGroup.transition("brush-move").duration(moveDuration)
        .call(brushBehavior.move, screenSel)
        .on("end interrupt", () => { _external = false; });
    } else {
      brushGroup.call(brushBehavior.move, screenSel);
      _external = false;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  function render(payload, props) {
    if (!payload?.svgEl) return;
    if (!brushGroup) {
      brushGroup = d3.select(payload.svgEl).append("g").attr("class", "brush-layer");
    }
    lastPayload = payload;
    lastProps   = props;
    // Sync transform from the canvas's draw payload (programmatic zoom
    // doesn't fire onZoom anymore — the transform travels with draw).
    if (payload.zoomTransform) lastTransform = payload.zoomTransform;

    const scales = getScales(payload, lastTransform);
    const off    = plotOffset(payload, props);

    // Trigger an animated brush.move on either:
    //   1. A projector swap (dataset / domain change → 3-phase
    //      choreography in the line layer), OR
    //   2. A zoom transform change (programmatic zoom fires a draw with
    //      the new transform; we want the brush rect to glide to its new
    //      screen position over `duration` like everything else does).
    // First render and pure resize-with-same-projector still snap.
    const projectorChanged =
      lastProjector !== null && payload.projector !== lastProjector;
    const transformChanged =
      _lastDrawTransform &&
      (payload.zoomTransform?.k !== _lastDrawTransform.k ||
       payload.zoomTransform?.x !== _lastDrawTransform.x ||
       payload.zoomTransform?.y !== _lastDrawTransform.y);
    const moveDuration = (projectorChanged || transformChanged) && !_userDragging
      ? (payload.duration ?? 0)
      : 0;
    lastProjector = payload.projector;
    _lastDrawTransform = payload.zoomTransform ?? null;

    setupBrush(payload, props, scales, off, moveDuration);

    if (props.order !== undefined) {
      lastOrder = props.order;
      applyOrderToGroup(brushGroup.node());
    }
  }

  function rerender(duration, props) {
    if (!lastPayload || !brushGroup || !brushBehavior) return;
    lastProps = props;
    // While the user is dragging, the brush is the source of truth — don't
    // let external state echoes (parent chart zoom updating :selection-x)
    // call brush.move() and fight the user's gesture.
    if (_userDragging) { applyStyle(); return; }
    const scales     = getScales(lastPayload, lastTransform);
    const off        = plotOffset(lastPayload, props);
    const screenSel  = dataSelectionToScreen(props, scales, off, lastPayload);
    _external = true;
    brushGroup.call(brushBehavior.move, screenSel);
    _external = false;
    applyStyle();
  }

  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich `{ transform, xScale, yScale }`.
    const transform = zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    lastTransform = transform ?? d3.zoomIdentity;
    if (!lastPayload || !lastProps || !brushBehavior) return;
    // Same rationale as rerender — don't reposition the brush while the
    // user is dragging it.
    if (_userDragging) return;
    const scales    = getScales(lastPayload, lastTransform);
    const off       = plotOffset(lastPayload, lastProps);
    const screenSel = dataSelectionToScreen(lastProps, scales, off, lastPayload);
    _external = true;
    brushGroup.call(brushBehavior.move, screenSel);
    _external = false;
  }

  function setOrder(order) {
    lastOrder = order;
    if (brushGroup) applyOrderToGroup(brushGroup.node());
  }

  function destroy() {
    brushGroup?.remove();
    brushGroup    = null;
    brushBehavior = null;
    lastPayload   = null;
    lastProps     = null;
    lastTransform = d3.zoomIdentity;
    lastOrder     = undefined;
  }

  function applyOrderToGroup(node) {
    if (!node) return;
    node.dataset.order = lastOrder;
    const parent = node.parentNode;
    if (parent) {
      const ordered = [...parent.querySelectorAll(":scope > [data-order]")];
      ordered.sort((a, b) => +a.dataset.order - +b.dataset.order);
      ordered.forEach((el) => parent.appendChild(el));
    }
  }

  return { render, rerender, onZoom, setOrder, destroy };
}
