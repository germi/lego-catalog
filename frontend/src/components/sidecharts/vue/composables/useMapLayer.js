import * as d3 from "d3";
import { onUnmounted, inject } from "vue";

/**
 * Composable that provides an open door for drawing custom D3 layers on top of
 * BaseMap (or any wrapper like WorldMap) without touching BaseMap internals.
 *
 * Usage:
 *   const { onDraw, onZoom } = useMapLayer((g, projection) => {
 *     // draw whatever you want into the <g> using the D3 projection
 *   })
 *
 *   <WorldMap @draw="onDraw" @zoom="onZoom" />
 *
 * The layer <g> is appended once to the SVG and reused on subsequent draws.
 * Zoom/pan transforms are kept in sync via @zoom.
 * Call redraw() to re-run the draw function without waiting for a @draw event
 * (useful when reactive data changes independently of the map).
 * Call setVisible(bool, duration?) to fade the layer in or out.
 */
export function useMapLayer(drawFn) {
  // When nested inside a MaskLayer, it provides a shallowRef holding the
  // container <g> that child layers should append into instead of the SVG root.
  const layerContainerRef = inject("layerContainer", null);
  let layerGroup = null;
  let lastProjection = null;
  let lastTransform = d3.zoomIdentity;
  let lastOrder = undefined;

  function onDraw({ projection, svgEl, duration }) {
    lastProjection = projection;
    const containerEl = layerContainerRef?.value ?? null;
    const parent = containerEl ? d3.select(containerEl) : d3.select(svgEl);
    if (!layerGroup || !svgEl.contains(layerGroup.node())) {
      layerGroup = parent.append("g").attr("class", "map-layer");
      // Re-apply order that may have been set before the group existed.
      if (lastOrder !== undefined) applyOrderToGroup(layerGroup.node());
    }
    // Apply the current zoom transform immediately so layers mounted late
    // (e.g. via v-if while the map is already zoomed) start in the right position.
    lastTransform = d3.zoomTransform(svgEl);
    layerGroup.attr("transform", lastTransform);
    // Pass lastTransform as 4th arg so composables can sync their lastK on initial draw.
    drawFn(layerGroup, projection, duration, lastTransform);
  }

  function onZoom(zoomArg) {
    // The canvas zoom signal is now a rich { transform, xScale, yScale }
    // object; accept the legacy raw-transform shape too.
    const transform = zoomArg?.transform ?? zoomArg;
    lastTransform = transform;
    if (layerGroup) layerGroup.attr("transform", transform);
  }

  function redraw() {
    if (layerGroup && lastProjection) {
      drawFn(layerGroup, lastProjection, undefined, lastTransform);
    }
  }

  function setVisible(visible, duration = 300) {
    if (!layerGroup) return;
    layerGroup.transition().duration(duration).attr("opacity", visible ? 1 : 0);
  }

  function setOrder(order) {
    lastOrder = order;
    if (layerGroup) applyOrderToGroup(layerGroup.node());
  }

  function applyOrderToGroup(node) {
    node.dataset.order = lastOrder;
    const parent = node.parentNode;
    if (parent) {
      const ordered = [...parent.querySelectorAll(":scope > [data-order]")];
      ordered.sort((a, b) => +a.dataset.order - +b.dataset.order);
      ordered.forEach((el) => parent.appendChild(el));
    }
  }

  onUnmounted(() => {
    layerGroup?.remove();
    layerGroup = null;
    lastProjection = null;
  });

  return { onDraw, onZoom, redraw, setVisible, setOrder };
}
