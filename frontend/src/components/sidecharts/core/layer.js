import * as d3 from "d3";

/**
 * Base factory for all chart layers.
 *
 * Manages one `<g>` element in the SVG and keeps it in sync with the
 * canvas's D3 zoom transform. Every concrete layer factory uses this
 * internally so group ownership and zoom-awareness are consistent.
 *
 * @param {object} [opts]
 * @param {string} [opts.className="layer"]   CSS class for the managed group.
 * @param {"inner"|"svg"} [opts.prefer="inner"]
 *   Natural coordinate space for this layer when no explicit container is
 *   provided. "inner" mounts under `payload.innerEl` (margin-offset group,
 *   used by XY layers). "svg" mounts under the SVG root (used by geo layers
 *   whose coordinates are already in absolute SVG space).
 *   `layerContainer` always wins if non-null.
 */
export function createLayer({ className = "layer", prefer = "inner" } = {}) {
  let layerGroup    = null;
  let lastTransform = d3.zoomIdentity;
  let lastOrder     = undefined;
  // When true, the group does NOT carry the canvas zoom transform — the layer
  // positions its content in already-zoomed coordinates itself (e.g. the voronoi
  // recompute mode, which re-projects through the live zoomed scales). Both
  // `ensureGroup` and `onZoom` skip the transform write while this is set.
  let staticGroup   = false;

  /**
   * Resolve which DOM node this layer's `<g>` should be appended to.
   * Precedence: explicit `layerContainer` → preferred fallback → svgEl root.
   */
  function resolveParent(payload, layerContainer) {
    if (layerContainer) return layerContainer;
    if (prefer === "inner") return payload.innerEl ?? payload.svgEl;
    return payload.svgEl;
  }

  /**
   * Call at the start of every render.
   * Creates the `<g>` if it doesn't yet exist (or was removed), then stamps
   * the current zoom transform so late-mounted layers start at the right offset.
   * If an order was previously set via setOrder(), it is re-applied to the
   * freshly created group so late-mounted layers still end up in the right position.
   *
   * @param {object} payload          Draw payload — must have at minimum `svgEl`.
   *                                  When the layer's natural space is "inner",
   *                                  `payload.innerEl` is used as the fallback.
   * @param {Element|null} [layerContainer]
   *                                  Explicit parent override (e.g. injected from
   *                                  a MaskLayer / VoronoiLayer ancestor).
   * @returns {d3.Selection} The managed group selection.
   */
  function ensureGroup(payload, layerContainer = null) {
    const svgEl = payload.svgEl;
    const parentEl = resolveParent(payload, layerContainer);
    const parent = d3.select(parentEl);
    const justCreated = !layerGroup || !svgEl.contains(layerGroup.node());
    if (justCreated) {
      layerGroup = parent.append("g").attr("class", className);
    }
    lastTransform = d3.zoomTransform(svgEl);
    layerGroup.attr("transform", staticGroup ? null : lastTransform);
    // Re-apply order on every render so late-mounted siblings are always
    // sorted correctly — mirrors the old applyOrder(props) in segmentLayer.
    if (lastOrder !== undefined) {
      setOrder(lastOrder);
    } else if (justCreated) {
      // A new (unordered) sibling just appeared at the end of the parent — that
      // would push any existing ordered siblings out of place. Re-sort them so
      // they stay on top regardless of mount order.
      resortOrdered(parent.node());
    }
    return layerGroup;
  }

  /** Call on every zoom/pan event to keep the group transform in sync. */
  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich `{ transform, xScale, yScale }`.
    const transform = zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    lastTransform = transform;
    if (layerGroup && !staticGroup) layerGroup.attr("transform", transform);
  }

  /**
   * Toggle "static group" mode — when on, the group stops carrying the zoom
   * transform (the layer positions content in already-zoomed coordinates). The
   * change is applied to the existing group immediately so a runtime toggle takes
   * effect without waiting for the next render.
   */
  function setStaticGroup(value) {
    staticGroup = !!value;
    if (layerGroup) layerGroup.attr("transform", staticGroup ? null : lastTransform);
  }

  /** Fade the layer in or out. */
  function setVisible(visible, duration = 300) {
    layerGroup?.transition().duration(duration).attr("opacity", visible ? 1 : 0);
  }

  /** Hard remove — use for non-animated teardown. */
  function destroy() {
    layerGroup?.remove();
    layerGroup = null;
    lastOrder  = undefined;
  }

  /**
   * Give up ownership without touching the DOM — use when the layer runs an
   * animated removal transition (the transition's own `.remove()` call handles
   * the DOM cleanup after the animation completes).
   */
  function detach() {
    layerGroup = null;
  }

  /**
   * Stamp a numeric draw order on this layer's group and re-sort all ordered
   * siblings so layers always stack in ascending `order` value regardless of
   * the order they were mounted.
   *
   * Layers without an explicit order are left untouched (they stay at their
   * natural DOM position below any ordered siblings).
   *
   * @param {number|undefined} order  Numeric order value, or `undefined` to opt out.
   */
  function setOrder(order) {
    lastOrder = order;
    if (order === undefined || !layerGroup) return;
    const node = layerGroup.node();
    node.dataset.order = order;
    resortOrdered(node.parentNode);
  }

  // Re-append every sibling that carries a `data-order` attribute in ascending
  // order, leaving unordered siblings in their natural DOM position. Always run
  // when a new sibling is added so ordered layers stay on top of late mounts.
  function resortOrdered(parentNode) {
    if (!parentNode) return;
    const ordered = [...parentNode.querySelectorAll(":scope > [data-order]")];
    if (!ordered.length) return;
    ordered.sort((a, b) => +a.dataset.order - +b.dataset.order);
    ordered.forEach((el) => parentNode.appendChild(el));
  }

  return {
    ensureGroup,
    onZoom,
    setVisible,
    setOrder,
    setStaticGroup,
    destroy,
    detach,
    get group()     { return layerGroup; },
    get transform() { return lastTransform; },
    get staticGroup() { return staticGroup; },
  };
}
