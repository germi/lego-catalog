import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { CanvasContext } from "../context.js";
import { VoronoiContext } from "../VoronoiContext.js";
import { createVoronoiCompute } from "../../core/voronoiCompute.js";
import { zoomDeltaString } from "../../core/voronoiLayout.js";
import {
  createVoronoiCellLayer,
  VORONOI_CELL_LAYER_DEFAULTS as D,
} from "../../core/voronoiCellLayer.js";

const IDENTITY = { k: 1, x: 0, y: 0 };
const SETTLE_MS = 120;

/**
 * VoronoiLayer — parent voronoi container.
 *
 * Computes the voronoi tessellation from `data` once per draw and exposes the
 * result through `VoronoiContext` so child voronoi layers (Hover / Label /
 * Marker) can render against it without re-computing. Also renders the cells
 * themselves (and centroids) when `showCells` / `showCentroids` is true.
 *
 * Interactive-zoom perf mirrors VoronoiLayer.vue (see its docs): in recompute
 * mode an interactive drag either rebuilds per frame (`zoomRecomputeMode:
 * "live"`, rAF-coalesced) or rides a cheap zoom delta and rebuilds once on
 * settle (`"settle"`). The delta is broadcast to children via an imperative
 * `voronoiGestureBus` in context (no per-frame re-render).
 */
export function VoronoiLayer({
  data            = [],
  showCells       = D.showCells,
  cellFill        = D.cellFill,
  cellFillOpacity = D.cellFillOpacity,
  cellStroke      = D.cellStroke,
  cellStrokeWidth = D.cellStrokeWidth,
  showCentroids   = D.showCentroids,
  centroidColor   = D.centroidColor,
  centroidRadius  = D.centroidRadius,
  // Zoom mode — true (default) = recompute through the live zoomed scales;
  // false = literal group-transform zoom. Mirrors VoronoiLayer.vue.
  recomputeOnZoom = true,
  // Interactive-zoom strategy when recomputeOnZoom is on: "live" (default,
  // rAF-coalesced per-frame recompute) or "settle" (delta-ride + one recompute
  // on release). Mirrors VoronoiLayer.vue.
  zoomRecomputeMode = "live",
  order,
  children,
}) {
  const { draw, zoom, layerContainer } = useContext(CanvasContext);

  const [voronoiDraw,  setVoronoiDraw]  = useState(null);
  const [voronoiHover, setVoronoiHover] = useState(null);

  const computeRef = useRef(null);
  if (!computeRef.current) computeRef.current = createVoronoiCompute();
  const cellRef = useRef(null);
  if (!cellRef.current) cellRef.current = createVoronoiCellLayer();

  // --- Gesture / settle state (refs so deferred callbacks read fresh values) ---
  const baseTRef           = useRef(IDENTITY); // transform at last recompute
  const latestZoomRef      = useRef(null);     // latest rich { transform, xScale, yScale }
  const projectorIsScaleRef = useRef(false);
  const settleTimerRef     = useRef(null);
  const zoomRafRef         = useRef(null);
  const dataRef            = useRef(data);
  dataRef.current = data;

  const cellProps = () => ({
    data,
    showCells,
    cellFill,
    cellFillOpacity,
    cellStroke,
    cellStrokeWidth,
    showCentroids,
    centroidColor,
    centroidRadius,
    recomputeOnZoom,
    zoomRecomputeMode,
    order,
    layerContainer,
  });
  const cellPropsRef = useRef(cellProps);
  cellPropsRef.current = cellProps;

  // Stable imperative bus: children subscribe their applyGestureTransform once;
  // the provider pushes the live zoom delta each frame without a re-render.
  const busRef = useRef(null);
  if (!busRef.current) {
    const subs = new Set();
    busRef.current = {
      subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
      emit(g) { subs.forEach((fn) => fn(g)); },
    };
  }

  // Ref-only helpers so a deferred settle / rAF callback never reads stale props.
  const cancelLive = () => {
    if (zoomRafRef.current) { cancelAnimationFrame(zoomRafRef.current); zoomRafRef.current = null; }
  };
  const clearGesture = () => {
    if (settleTimerRef.current) { clearTimeout(settleTimerRef.current); settleTimerRef.current = null; }
    cancelLive();
    busRef.current.emit(null);
    cellRef.current.applyGestureTransform?.(null);
  };
  const recomputeAt = (z) => {
    const state = computeRef.current.onZoom(z, dataRef.current);
    if (state) {
      state.renderDuration = 0;
      baseTRef.current = z.transform ?? IDENTITY;
      setVoronoiDraw(state);
      cellRef.current.rerender(cellPropsRef.current(), state);
      return true;
    }
    cellRef.current.onZoom(z);
    return false;
  };
  const settleGesture = () => {
    settleTimerRef.current = null;
    const z = latestZoomRef.current;
    if (!z) return;
    busRef.current.emit(null);
    if (recomputeAt(z)) cellRef.current.applyGestureTransform?.(null);
  };

  // Full render on canvas draw. The draw is the new delta baseline; any in-flight
  // gesture is superseded.
  useEffect(() => {
    if (!draw) return;
    const state = computeRef.current.onDraw(draw, data, { zoomed: recomputeOnZoom });
    setVoronoiDraw(state);
    cellRef.current.render(draw, cellProps(), state);
    baseTRef.current = draw.zoomTransform ?? IDENTITY;
    projectorIsScaleRef.current = draw.projector?.type === "scale";
    clearGesture();
  }, [draw]); // eslint-disable-line react-hooks/exhaustive-deps

  // Interactive zoom.
  useEffect(() => {
    if (!zoom) return;
    if (recomputeOnZoom && projectorIsScaleRef.current) {
      latestZoomRef.current = zoom;
      if (zoomRecomputeMode === "live") {
        // A — recompute per frame, rAF-coalesced (≤ once/frame).
        if (!zoomRafRef.current) {
          zoomRafRef.current = requestAnimationFrame(() => {
            zoomRafRef.current = null;
            recomputeAt(latestZoomRef.current);
          });
        }
      } else {
        // B — ride a cheap zoom delta during the gesture, recompute once on
        // settle. `k` lets the label/marker layers counter-scale their glyphs.
        const tf = zoom.transform ?? zoom;
        const gesture = { d: zoomDeltaString(tf, baseTRef.current), k: (tf.k ?? 1) / (baseTRef.current.k || 1) };
        busRef.current.emit(gesture);
        cellRef.current.applyGestureTransform?.(gesture);
        if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
        settleTimerRef.current = setTimeout(settleGesture, SETTLE_MS);
      }
      return;
    }
    // Literal mode (or geo): ride the group transform directly.
    cellRef.current.onZoom(zoom);
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Data change — recompute and rerender
  useEffect(() => {
    if (!draw) return;
    const state = computeRef.current.recompute(data);
    setVoronoiDraw(state);
    cellRef.current.rerender(cellProps(), state);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cell style props — rerender without recompute
  useEffect(() => {
    cellRef.current.rerender(cellProps(), voronoiDraw);
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    showCells, cellFill, cellFillOpacity, cellStroke, cellStrokeWidth,
    showCentroids, centroidColor, centroidRadius,
  ]);

  // Draw order + cleanup
  useEffect(() => { cellRef.current.setOrder(order); }, [order]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { clearGesture(); cellRef.current.destroy(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Context value for child voronoi layers. `voronoiGestureBus` is a stable ref
  // so adding it never causes extra re-renders.
  const ctx = useMemo(
    () => ({
      voronoiDraw, voronoiHover, setVoronoiHover, voronoiOrder: order,
      voronoiZoomMode: recomputeOnZoom, voronoiGestureBus: busRef.current,
    }),
    [voronoiDraw, voronoiHover, order, recomputeOnZoom],
  );

  return <VoronoiContext.Provider value={ctx}>{children}</VoronoiContext.Provider>;
}

export default VoronoiLayer;
