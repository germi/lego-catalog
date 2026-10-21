import * as d3 from "d3";
import * as topojson from "topojson-client";
import { resolveFill } from "../fill/resolveFill";
import { createLayer } from "./layer.js";
import { safeId } from "../utils/safeId.js";

export function createRegionLayer({ onHover, onSelect, onSuperRegionClick } = {}) {
  const base = createLayer({ className: "map-layer" });

  // ── Region sub-groups ───────────────────────────────────────────────────────
  let regionsG             = null;
  let bordersG             = null;
  let superRegionsG        = null;
  let compositionBordersG  = null;

  // ── Render state ────────────────────────────────────────────────────────────
  let currentPath       = null;
  let currentProjection = null;
  let lastSvgEl         = null;
  let lastK             = 1;
  let lastProps         = null;

  // ── Feature collection helpers ──────────────────────────────────────────────

  function getAllFeatures(props) {
    const { topoData, topoObjectName } = props;
    if (!topoData) return { type: "FeatureCollection", features: [] };
    if (topoData.type === "FeatureCollection") return topoData;
    return topojson.feature(topoData, topoData.objects[topoObjectName]);
  }

  function getFeatureCollection(props) {
    const all = getAllFeatures(props);
    return {
      type: "FeatureCollection",
      features: all.features.filter(
        (d) => !props.removeFeatures.includes(props.featureAccessor(d)),
      ),
    };
  }

  function getFeatureCollectionForBounds(props) {
    const fc = getFeatureCollection(props);
    return {
      type: "FeatureCollection",
      features: fc.features.filter(
        (d) => !props.removeFeaturesForBounds.includes(props.featureAccessor(d)),
      ),
    };
  }

  function getFeatureCollectionForFitData(props) {
    const fc = getFeatureCollectionForBounds(props);
    const dataKeys = Object.keys(props.data);
    if (!dataKeys.length) return fc;
    return {
      type: "FeatureCollection",
      features: fc.features.filter((d) =>
        dataKeys.includes(String(props.featureAccessor(d))),
      ),
    };
  }

  function getSuperRegionFeatures(props) {
    const { topoData, topoObjectName, superRegionMergeAccessor } = props;
    if (!superRegionMergeAccessor || topoData?.type !== "Topology") return [];
    const geometries = topoData.objects[topoObjectName].geometries;
    const ids = new Set(geometries.map(superRegionMergeAccessor));
    return [...ids].map((id) => {
      const geometry = topojson.merge(
        topoData,
        geometries.filter((d) => superRegionMergeAccessor(d) == id),
      );
      geometry.id = id;
      return geometry;
    });
  }

  // ── Color / fill ────────────────────────────────────────────────────────────

  function getColorScale(props) {
    const { color, data, dataAccessor, extent } = props;
    if (typeof color === "function") return color;
    const domain = extent || d3.extent(Object.values(data), dataAccessor);
    const interpolator = d3.interpolateRgb(color.min, color.max);
    const scale = d3.scaleLinear().domain(domain);
    return d3.scaleSequential((d) => interpolator(scale(d)));
  }

  function registerTextures(svgEl, props) {
    const { data, noDataColor } = props;
    const seen = new Set();
    for (const entry of Object.values(data)) {
      const t = typeof entry?.color?.url === "function" ? entry.color : null;
      if (t && !seen.has(t)) { seen.add(t); t.register(svgEl); }
    }
    if (noDataColor?.register) noDataColor.register(svgEl);
  }

  function getFill(d, props) {
    const { featureAccessor, data, dataAccessor, noDataColor } = props;
    const code  = featureAccessor(d);
    const entry = data[code];
    if (entry?.color)
      return typeof entry.color?.url === "function" ? entry.color.url() : entry.color;
    const value = dataAccessor(entry);
    if (value === undefined || value === null) return resolveFill(noDataColor, lastSvgEl);
    return getColorScale(props)(value);
  }

  function getStroke(d, props) {
    const { featureAccessor, highlighted, highlightColor, data, dataAccessor,
            strokeColor, strokeColorNoData } = props;
    if (highlighted === featureAccessor(d)) return highlightColor;
    const entry = data[featureAccessor(d)];
    if (entry?.strokeColor) return entry.strokeColor;
    const value = dataAccessor(entry);
    return value === undefined || value === null ? strokeColorNoData : strokeColor;
  }

  function getStrokeWidth(d, k, props) {
    const { featureAccessor, highlighted, highlightedStrokeWidth, strokeWidth, data } = props;
    const code = featureAccessor(d);
    if (highlightedStrokeWidth && highlighted === code) return highlightedStrokeWidth / k;
    const entry = data[code];
    return (entry?.strokeWidth ?? strokeWidth) / k;
  }

  function getSuperRegionStroke(d, props) {
    const { selectedSuperRegion, highlightColor, strokeColor } = props;
    return selectedSuperRegion === d.id ? highlightColor : strokeColor;
  }

  // ── Sub-group setup ──────────────────────────────────────────────────────────

  function ensureSubGroups(outerG) {
    if (regionsG && outerG.node().contains(regionsG.node())) return;
    outerG.selectAll("*").remove();
    regionsG            = outerG.append("g").attr("class", "map-regions");
    bordersG            = outerG.append("g").attr("class", "map-borders");
    superRegionsG       = outerG.append("g").attr("class", "map-super-regions");
    compositionBordersG = outerG.append("g").attr("class", "map-composition-borders");
  }

  // ── Draw helpers (each reads current lastProps via closure for event handlers) ─

  function drawRegions(k, props) {
    if (!regionsG || !currentPath) return;
    const { featureAccessor, data, dataAccessor, strokeDasharray,
            highlightOnlyWithData, highlightColor, scope } = props;
    regionsG
      .selectAll("path")
      .data(getFeatureCollection(props).features, (d) => featureAccessor(d))
      .join("path")
      .attr("id",             (d) => `region-${safeId(featureAccessor(d))}`)
      .attr("class",          "region")
      .attr("d",              currentPath)
      .attr("stroke-width",   (d) => getStrokeWidth(d, k, props))
      .attr("stroke-dasharray", strokeDasharray)
      .on("mouseover", function (event, d) {
        const p     = lastProps;
        const id    = p.featureAccessor(d);
        const value = p.dataAccessor(p.data[id]);
        const hasData = value !== null && value !== undefined;
        if (!p.highlightOnlyWithData || hasData)
          d3.select(this).attr("stroke", p.highlightColor).raise();
        onHover?.({
          target: event.target,
          data: { id, value, data: p.data[id], region: d.properties },
        });
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke", (d) => getStroke(d, lastProps)).lower();
        highlight(lastProps);
        onHover?.(null);
      })
      .on("click", (event, d) => {
        const p  = lastProps;
        const id = p.featureAccessor(d);
        onSelect?.({
          target: event.target,
          data: { id, value: p.dataAccessor(p.data[id]), data: p.data[id], region: d.properties },
        });
      })
      .attr("visibility", () => scope === "superRegion" ? "hidden" : "visible");
  }

  function drawSuperRegions(k, props) {
    const features = getSuperRegionFeatures(props);
    if (!superRegionsG || !features.length) return;
    const { superRegionStrokeWidth, highlightColor, scope, selectedSuperRegion } = props;
    superRegionsG
      .selectAll("path")
      .data(features)
      .join("path")
      .attr("id",             (d) => `super-region-${d.id}`)
      .attr("class",          "super-region")
      .attr("d",              currentPath)
      .attr("stroke-width",   superRegionStrokeWidth / k)
      .attr("stroke-linejoin", "round")
      .attr("cursor",         "pointer")
      .on("mouseover", function (e, d) {
        d3.select(this).attr("stroke", lastProps.highlightColor).raise();
        highlight(lastProps);
        onHover?.({ target: e.target, data: { id: d.id } });
      })
      .on("mouseout", function () {
        highlight(lastProps);
        onHover?.(null);
      })
      .on("click", (event, d) => {
        onSelect?.({ target: event.target, data: { id: d.id } });
      })
      .attr("visibility", (d) => {
        if (scope === "superRegion") return "visible";
        if (selectedSuperRegion === d.id) return "visible";
        return "hidden";
      });
  }

  function drawBorders(k, props) {
    if (!bordersG) return;
    const { showBorders, topoData, topoObjectName, borderColor, strokeWidth } = props;
    if (!showBorders || topoData?.type !== "Topology") {
      bordersG.selectAll("path").remove();
      return;
    }
    const mesh = topojson.mesh(topoData, topoData.objects[topoObjectName], (a, b) => a !== b);
    bordersG
      .selectAll("path.border")
      .data([mesh])
      .join("path")
      .attr("class",          "border")
      .attr("d",              currentPath)
      .attr("fill",           "none")
      .attr("stroke",         borderColor)
      .attr("stroke-width",   strokeWidth / k)
      .attr("pointer-events", "none");
  }

  function drawCompositionBorders(k, proj, props) {
    if (!compositionBordersG) return;
    const { showCompositionBorders, compositionBorderColor, strokeWidth } = props;
    if (!showCompositionBorders || !proj?.getCompositionBorders) {
      compositionBordersG.selectAll("path").remove();
      return;
    }
    compositionBordersG
      .selectAll("path.composition-border")
      .data([proj.getCompositionBorders()])
      .join("path")
      .attr("class",          "composition-border")
      .attr("d",              currentPath)
      .attr("fill",           "none")
      .attr("stroke",         compositionBorderColor)
      .attr("stroke-width",   strokeWidth / k)
      .attr("pointer-events", "none");
  }

  function raiseRegionsWithData(props) {
    if (!regionsG) return;
    const { featureAccessor, data, dataAccessor } = props;
    regionsG
      .selectAll("path")
      .filter((d) => {
        const value = dataAccessor(data[featureAccessor(d)]);
        return value !== null && value !== undefined;
      })
      .raise();
  }

  function update(props) {
    if (!regionsG) return;
    const { featureAccessor, data, dataAccessor, duration } = props;
    regionsG
      .selectAll("path")
      .transition()
      .duration(duration)
      .attr("fill",   (d) => getFill(d, props))
      .attr("stroke", (d) => getStroke(d, props))
      .attr("cursor", (d) => {
        const value = dataAccessor(data[featureAccessor(d)]);
        return value !== undefined && value !== null ? "pointer" : "default";
      });
    raiseRegionsWithData(props);
  }

  function highlight(props) {
    if (!regionsG || !superRegionsG) return;
    const {
      featureAccessor, highlighted, highlightedStrokeWidth, strokeWidth,
      highlightedStrokeDasharray, strokeDasharray, superRegionStrokeWidth,
      selectedSuperRegion, selectedStrokeDasharray, scope,
    } = props;
    regionsG
      .selectAll("path")
      .attr("stroke",       (d) => getStroke(d, props))
      .attr("stroke-width", (d) => getStrokeWidth(d, lastK, props))
      .attr("stroke-dasharray", (d) =>
        highlighted === featureAccessor(d) ? highlightedStrokeDasharray : strokeDasharray,
      );
    raiseRegionsWithData(props);
    regionsG.select(`#region-${safeId(highlighted)}`).raise();
    superRegionsG
      .selectAll("path")
      .attr("stroke",       (d) => getSuperRegionStroke(d, props))
      .attr("stroke-width", superRegionStrokeWidth / lastK)
      .attr("stroke-dasharray", (d) =>
        selectedSuperRegion === d.id ? selectedStrokeDasharray : "none",
      )
      .attr("fill", "none")
      .attr("visibility", (d) => {
        if (scope === "superRegion") return "visible";
        if (selectedSuperRegion === d.id) return "visible";
        return "hidden";
      });
  }

  // ── Zoom helpers ─────────────────────────────────────────────────────────────

  function rotateToFeature(feature, duration, props) {
    const controls = props.controls;
    const proj = controls?.projection;
    if (!proj) return;
    const centroid = d3.geoCentroid(feature);
    if (!centroid || !isFinite(centroid[0]) || !isFinite(centroid[1])) return;
    const targetRotation = [-centroid[0], -centroid[1], 0];
    const fitScale = controls.initialRotateScale ?? proj.scale();
    const savedRotation  = proj.rotate();
    const savedScale     = proj.scale();
    const savedTranslate = proj.translate();
    proj.rotate(targetRotation).scale(1).translate([0, 0]);
    const b = d3.geoPath().projection(proj).bounds(feature);
    proj.rotate(savedRotation).scale(savedScale).translate(savedTranslate);
    const dx = b[1][0] - b[0][0], dy = b[1][1] - b[0][1];
    if (!dx && !dy) return;
    const w = controls.width.value, h = controls.height.value;
    const targetScale = Math.min(
      controls.maxZoom * fitScale,
      controls.scale / Math.max(dx / w, dy / h),
    );
    controls.animateRotation(targetRotation, targetScale, duration);
  }

  function zoomToFeature(feature, duration) {
    const props = lastProps;
    if (!props) return;
    const dur = duration ?? props.duration;
    const controls = props.controls;
    if (controls?.canRotate()) { rotateToFeature(feature, dur, props); return; }
    if (!currentPath) return;
    controls?.zoomToRect(currentPath.bounds(feature), dur);
  }

  function zoomToBBox([[lon0, lat0], [lon1, lat1]], duration) {
    const props = lastProps;
    if (!props) return;
    const dur = duration ?? props.duration;
    const controls = props.controls;
    if (controls?.canRotate()) {
      rotateToFeature({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [[lon0, lat0], [lon1, lat1], [lon0, lat1], [lon1, lat0]],
        },
      }, dur, props);
      return;
    }
    if (!currentProjection) return;
    const p0 = currentProjection([lon0, lat0]);
    const p1 = currentProjection([lon1, lat1]);
    if (!p0 || !p1) return;
    controls?.zoomToRect(
      [[Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1])],
       [Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1])]],
      dur,
    );
  }

  function zoomToFitBounds(duration) {
    const props = lastProps;
    if (!props) return;
    const fc = getFeatureCollectionForBounds(props);
    if (fc?.features?.length) zoomToFeature(fc, duration);
  }

  function zoomToFitData(duration) {
    if (!lastProps) return;
    const fc = getFeatureCollectionForFitData(lastProps);
    if (fc.features.length) zoomToFeature(fc, duration);
  }

  function zoomToSuperRegion(id, duration) {
    if (!lastProps) return;
    const feature = getSuperRegionFeatures(lastProps).find((d) => d.id == id);
    if (feature) {
      onSuperRegionClick?.(id);
      zoomToFeature(feature, duration);
    }
  }

  function zoomToCurrentSuperRegion(duration) {
    if (!lastProps) return;
    const { selectedSuperRegion } = lastProps;
    if (selectedSuperRegion) zoomToSuperRegion(selectedSuperRegion, duration);
  }

  // ── Core draw orchestrator ───────────────────────────────────────────────────

  function drawAll(g, projection, drawDuration, transform, props) {
    ensureSubGroups(g);

    const { order, fitBoundsToData, selectedSuperRegion, data, controls } = props;
    if (order !== undefined) {
      const node = g.node();
      node.dataset.order = order;
      const parent = node.parentNode;
      if (parent) {
        const ordered = [...parent.querySelectorAll(":scope > [data-order]")];
        ordered.sort((a, b) => +a.dataset.order - +b.dataset.order);
        ordered.forEach((el) => parent.appendChild(el));
      }
    }

    currentProjection = projection;
    currentPath = d3.geoPath().projection(projection);
    lastK = transform.k;

    drawRegions(transform.k, props);
    drawBorders(transform.k, props);
    drawSuperRegions(transform.k, props);
    drawCompositionBorders(transform.k, projection, props);
    if (lastSvgEl) registerTextures(lastSvgEl, props);
    update(props);
    highlight(props);

    if (drawDuration !== 0) {
      if (fitBoundsToData && Object.keys(data).length) zoomToFitData();
      if (selectedSuperRegion) zoomToSuperRegion(selectedSuperRegion);
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  function render(payload, props) {
    lastProps = props;
    lastSvgEl = payload.svgEl;

    const g = base.ensureGroup(payload, props.layerContainer?.value ?? null);
    drawAll(g, payload.projection, payload.duration, base.transform, props);
  }

  function rerender(props) {
    lastProps = props;
    if (!base.group || !currentPath) return;
    drawRegions(lastK, props);
    drawBorders(lastK, props);
    drawSuperRegions(lastK, props);
    drawCompositionBorders(lastK, currentProjection, props);
    update(props);
    highlight(props);
  }

  function updateData(props) {
    lastProps = props;
    if (lastSvgEl) registerTextures(lastSvgEl, props);
    update(props);
    if (props.fitBoundsToData) zoomToFitData();
  }

  function updateHighlight(props) {
    lastProps = props;
    highlight(props);
  }

  function updateSuperRegion(props) {
    lastProps = props;
    highlight(props);
    if (props.selectedSuperRegion) zoomToSuperRegion(props.selectedSuperRegion);
  }

  function updateBorders(props) {
    lastProps = props;
    if (!currentPath) return;
    drawBorders(lastK, props);
  }

  function updateCompositionBorders(props) {
    lastProps = props;
    if (!currentPath) return;
    drawCompositionBorders(lastK, currentProjection, props);
  }

  function updateScope(props) {
    lastProps = props;
    if (!currentPath) return;
    drawRegions(lastK, props);
    highlight(props);
  }

  function updateFitBoundsToData(props) {
    lastProps = props;
    if (props.fitBoundsToData) {
      zoomToFitData();
    } else if (props.selectedSuperRegion) {
      zoomToSuperRegion(props.selectedSuperRegion);
    } else {
      props.controls?.resetZoom();
    }
  }

  // Called when featureCollectionForBounds changes — registers bounds with canvas.
  function fitBoundsIfNeeded(props) {
    lastProps = props;
    const fc = getFeatureCollectionForBounds(props);
    if (fc?.features?.length && props.registerBounds) {
      props.controls?.fitBounds(fc);
    }
  }

  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich `{ transform, xScale, yScale }`.
    const transform = zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    base.onZoom(transform);
    lastK = transform.k;
    if (!lastProps) return;
    const { strokeWidth, superRegionStrokeWidth } = lastProps;
    if (regionsG)
      regionsG.selectAll("path").attr("stroke-width", (d) => getStrokeWidth(d, transform.k, lastProps));
    if (bordersG)
      bordersG.selectAll("path").attr("stroke-width", strokeWidth / transform.k);
    if (superRegionsG)
      superRegionsG.selectAll("path").attr("stroke-width", superRegionStrokeWidth / transform.k);
    if (compositionBordersG)
      compositionBordersG.selectAll("path").attr("stroke-width", strokeWidth / transform.k);
  }

  function destroy() {
    base.destroy();
    regionsG             = null;
    bordersG             = null;
    superRegionsG        = null;
    compositionBordersG  = null;
    currentPath          = null;
    currentProjection    = null;
    lastSvgEl            = null;
    lastProps            = null;
  }

  return {
    render,
    rerender,
    updateData,
    updateHighlight,
    updateSuperRegion,
    updateBorders,
    updateCompositionBorders,
    updateScope,
    updateFitBoundsToData,
    fitBoundsIfNeeded,
    onZoom,
    zoomToFeature,
    zoomToBBox,
    zoomToFitBounds,
    zoomToFitData,
    zoomToSuperRegion,
    zoomToCurrentSuperRegion,
    setOrder: (order) => base.setOrder(order),
    destroy,
  };
}
