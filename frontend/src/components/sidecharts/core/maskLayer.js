import * as d3 from "d3";

export function createMaskLayer() {
  let svgEl          = null;
  let containerGroup = null;
  let clipShape      = null;
  let lastProjection = null;
  let lastFeature    = null;
  let lastOrder      = undefined;
  const clipId       = `mask-${Math.random().toString(36).slice(2, 9)}`;

  function drawClipPath(projection) {
    if (!clipShape || !lastFeature) return;
    clipShape.attr("d", d3.geoPath(projection)(lastFeature));
  }

  function render(payload, feature) {
    lastFeature    = feature ?? null;
    lastProjection = payload.projection;
    svgEl          = payload.svgEl;
    const svg      = d3.select(svgEl);

    // <clipPath> lives directly in the SVG root (not inside <defs>) so that
    // BaseMap's selectAll("g").remove() cannot wipe the inner <path>.
    let clip = svg.select(`#${clipId}`);
    if (clip.empty()) {
      clip = svg.append("clipPath").attr("id", clipId);
      clip.append("path").attr("class", "mask-shape").attr("fill", "black");
    }
    clipShape = clip.select("path.mask-shape");

    if (!containerGroup || !svgEl.contains(containerGroup.node())) {
      containerGroup = svg
        .append("g")
        .attr("class", "mask-layer-container")
        .attr("clip-path", `url(#${clipId})`);
      // Re-apply order that may have been set before the group existed.
      if (lastOrder !== undefined) applyOrderToGroup(containerGroup.node());
    }

    drawClipPath(payload.projection);
    // Stamp the current zoom transform so the clip boundary matches child layers.
    clipShape.attr("transform", d3.zoomTransform(svgEl));
  }

  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich `{ transform, xScale, yScale }`.
    const transform = zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    if (clipShape) clipShape.attr("transform", transform);
  }

  function onFeatureChange(feature) {
    lastFeature = feature ?? null;
    if (lastProjection) drawClipPath(lastProjection);
  }

  function setVisible(visible, duration = 300) {
    containerGroup?.transition().duration(duration).attr("opacity", visible ? 1 : 0);
  }

  function destroy() {
    if (svgEl) d3.select(svgEl).select(`#${clipId}`).remove();
    containerGroup?.remove();
    containerGroup = null;
    clipShape      = null;
    svgEl          = null;
    lastProjection = null;
    lastFeature    = null;
    lastOrder      = undefined;
  }

  function getContainerNode() {
    return containerGroup?.node() ?? null;
  }

  function setOrder(order) {
    lastOrder = order;
    if (containerGroup) applyOrderToGroup(containerGroup.node());
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

  return { render, onZoom, onFeatureChange, setVisible, setOrder, destroy, getContainerNode };
}
