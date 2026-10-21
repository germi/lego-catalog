import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import BaseCanvas from "./canvas/BaseCanvas.jsx";
import { ChartContext } from "./ChartContext.js";
import { LineAxisLayer } from "./layers/LineAxisLayer.jsx";
import { YAxisLayer }    from "./layers/YAxisLayer.jsx";
import { AreaLayer }     from "./layers/AreaLayer.jsx";
import { EditChart } from "./EditChart.jsx";
import { useEditMode } from "./useEditMode.js";
import { useEditableProps } from "./useEditableProps.js";
import { computeFullYDomain } from "../core/_seriesCommon.js";
import { makeScaleProjector } from "../utils/projectors/scaleProjector.js";
import { resolveInline, resolveSpacing } from "../utils/resolveInline.js";
import { AREA_CHART_DEFAULTS as D, AREA_CHART_META } from "../presets/AreaChart.defaults.js";

// x-accessor matches `_seriesCommon.xValueFor`'s default — keeps the chart
// projector's x-scale aligned with what existing layers compute internally.
function makeXAccessor(scaleType, parseTime) {
  if (scaleType === "time") {
    const parse = parseTime ?? ((name) => new Date(String(name)));
    return (d) => parse(d.name);
  }
  return (d) => +d.name;
}

/**
 * AreaChart — React port. Mirrors `vue/AreaChart.vue`.
 *
 * Same chart-projector flow as `<LineChart>`: builds a `makeScaleProjector`
 * from the data + canvas-reported dimensions and hands it to `BaseCanvas` so
 * `AreaLayer` (and any slotted layers) share the chart's scales.
 *
 * In edit mode (`?mode=edit` or `window.__sidechartsEditMode = true`) a pencil
 * button reveals a modal that lets you tweak every prop in
 * `AREA_CHART_DEFAULTS` and copy the resulting overrides as JSON.
 */
export const AreaChart = forwardRef(function AreaChart(rawProps, ref) {
  // Fill missing keys with defaults so `useEditableProps` sees the full surface.
  const propsLike = {};
  for (const key of Object.keys(D)) {
    propsLike[key] = rawProps[key] !== undefined ? rawProps[key] : D[key];
  }

  // ── Editable props ───────────────────────────────────────────────────────
  const editMode = useEditMode();
  const { overrides, effective, setOverride, resetOverride, resetAll } =
    useEditableProps(propsLike, D);

  // Non-editable extras (handlers, children, layout) come from rawProps.
  const { onHover, onClick, onDraw, onZoom, children, className, style } = rawProps;

  // ── Forward canvas ref API ───────────────────────────────────────────────
  const canvasRef = useRef(null);
  useImperativeHandle(ref, () => ({
    zoomToDomain: (...a) => canvasRef.current?.zoomToDomain(...a),
    setTransform: (...a) => canvasRef.current?.setTransform(...a),
    zoomToRect:   (...a) => canvasRef.current?.zoomToRect(...a),
    zoomToScale:  (...a) => canvasRef.current?.zoomToScale(...a),
    resetZoom:    (...a) => canvasRef.current?.resetZoom(...a),
    zoomIn:       (...a) => canvasRef.current?.zoomIn(...a),
    zoomOut:      (...a) => canvasRef.current?.zoomOut(...a),
    redraw:       (d)    => canvasRef.current?.redraw(d),
    get svgEl()  { return canvasRef.current?.svgEl; },
    get width()  { return canvasRef.current?.width; },
    get height() { return canvasRef.current?.height; },
  }), []);

  // ── Stable formatters ────────────────────────────────────────────────────
  const xTickFormat = useCallback(
    (d) => effective.data.find((e) => e.id === d)?.name ?? d,
    [effective.data],
  );

  const resolvedMargin  = useMemo(() => resolveSpacing(effective.margin,  effective.rtl), [effective.margin,  effective.rtl]);
  const resolvedPadding = useMemo(() => resolveSpacing(effective.padding, effective.rtl), [effective.padding, effective.rtl]);
  const resolvedYSide   = resolveInline(effective.yAxisSide ?? "start", effective.rtl);

  const clampPanInset = useMemo(() => ({
    x: resolvedMargin.left + resolvedMargin.right + resolvedPadding.left + resolvedPadding.right,
    y: resolvedMargin.top  + resolvedMargin.bottom + resolvedPadding.top  + resolvedPadding.bottom,
  }), [resolvedMargin, resolvedPadding]);

  // ── Canvas dimensions reported by BaseCanvas via onDraw ──────────────────
  const [canvasWidth,  setCanvasWidth]  = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);

  const onDrawRef = useRef(onDraw);
  onDrawRef.current = onDraw;
  const handleDraw = useCallback((payload) => {
    if (payload?.width  !== canvasWidth)  setCanvasWidth(payload.width);
    if (payload?.height !== canvasHeight) setCanvasHeight(payload.height);
    onDrawRef.current?.(payload);
  }, [canvasWidth, canvasHeight]);

  // ── Y-domain unioned across all keys ─────────────────────────────────────
  const yDomain = useMemo(
    () => computeFullYDomain(effective.data, {
      max: effective.max, forceValues: effective.forceValues,
      stacked: effective.stacked, keys: effective.keys,
    }),
    [effective.data, effective.max, effective.forceValues, effective.stacked, effective.keys],
  );

  const xAccessor = useMemo(
    () => makeXAccessor(effective.xScaleType, effective.parseTime),
    [effective.xScaleType, effective.parseTime],
  );

  // ── Chart-level scale projector ──────────────────────────────────────────
  const chartProjector = useMemo(() => {
    if (!effective.data?.length) return null;
    const m = resolvedMargin;
    const p = resolvedPadding;
    const w = Math.max(0, canvasWidth  - m.left - m.right - p.left - p.right);
    const h = Math.max(0, canvasHeight - m.top  - m.bottom - p.top  - p.bottom);
    if (!w || !h) return null;

    const xs = effective.data.map(xAccessor).filter((v) => v != null && Number.isFinite(+v));
    if (!xs.length) return null;
    const xMin = xs.reduce((a, b) => (a < b ? a : b));
    const xMax = xs.reduce((a, b) => (a > b ? a : b));

    return makeScaleProjector({
      width:      w,
      height:     h,
      xAccessor,
      xScaleType: effective.xScaleType,
      yScaleType: effective.scaleType,
      xNice:      false,
      yNice:      true,
      xDomain:    [xMin, xMax],
      yDomain,
      rtl:        effective.rtl,
    });
  }, [effective.data, canvasWidth, canvasHeight, resolvedMargin, resolvedPadding,
      xAccessor, effective.xScaleType, effective.scaleType, yDomain, effective.rtl]);

  // ── Slot-layer context ───────────────────────────────────────────────────
  const [lineLayerPaths, setLineLayerPaths] = useState(null);
  const chartCtx = useMemo(
    () => ({
      chartContext:   { margin: resolvedMargin, padding: resolvedPadding },
      chartData:      effective.data,
      lineLayerPaths,
      setLineLayerPaths,
    }),
    [resolvedMargin, resolvedPadding, effective.data, lineLayerPaths],
  );

  return (
    <BaseCanvas
      ref={canvasRef}
      skipProjection
      duration={effective.duration}
      ease={effective.ease}
      allowManualZoom={effective.allowZoom}
      maxZoom={effective.maxZoom}
      clampPan={effective.allowZoom}
      clampPanInset={clampPanInset}
      projector={chartProjector}
      zoomAxes={effective.zoomAxes ?? "x"}
      userZoomAxes={effective.userZoomAxes}
      onDraw={handleDraw}
      onZoom={onZoom}
      className={["area-container", className].filter(Boolean).join(" ")}
      style={style}
    >
      <ChartContext.Provider value={chartCtx}>
        {effective.showYAxis && (
          <YAxisLayer
            order={-100}
            side={resolvedYSide}
            showGrid={effective.showYGrid}
            data={effective.data}
            margin={resolvedMargin}
            padding={resolvedPadding}
            max={effective.max}
            stacked={effective.stacked}
            scaleType={effective.scaleType}
            tickValues={effective.yTickValues}
            tickFormat={effective.format}
            numTicks={effective.yNumTicks}
            tickSize={effective.yTickSize}
            tickColor={effective.yTickColor}
            tickTextColor={effective.yTickTextColor}
            gridColor={effective.yGridColor}
            gridDasharray={effective.yGridDasharray}
            gridOpacity={effective.yGridOpacity}
            ease={effective.ease}
            duration={effective.duration}
            rtl={effective.rtl}
          />
        )}

        <AreaLayer
          order={10}
          data={effective.data}
          keys={effective.keys}
          color={effective.color}
          margin={resolvedMargin}
          padding={resolvedPadding}
          scaleType={effective.scaleType}
          xScaleType={effective.xScaleType}
          max={effective.max}
          forceValues={effective.forceValues}
          stacked={effective.stacked}
          curve={effective.curve}
          opacity={effective.opacity}
          strokeWidth={effective.strokeWidth}
          strokeColor={effective.strokeColor}
          strokeOpacity={effective.strokeOpacity}
          upperKey={effective.upperKey}
          lowerKey={effective.lowerKey}
          duration={effective.duration}
          ease={effective.ease}
          highlighted={effective.highlighted}
          defaultColor={effective.defaultColor}
          onHover={onHover}
          onClick={onClick}
        />

        {effective.showXAxis && (
          <LineAxisLayer
            order={-90}
            side="bottom"
            showGrid={effective.showXGrid}
            data={effective.data}
            margin={resolvedMargin}
            padding={resolvedPadding}
            xScaleType={effective.xScaleType}
            tickValues={effective.xTickValues}
            tickFormat={xTickFormat}
            gridColor={effective.xGridColor}
            gridDasharray={effective.xGridDasharray}
            gridOpacity={effective.xGridOpacity}
            ease={effective.ease}
            duration={effective.duration}
          />
        )}

        {editMode && (
          <EditChart
            effective={effective}
            defaults={D}
            meta={AREA_CHART_META}
            overrides={overrides}
            onSet={setOverride}
            onReset={resetOverride}
            onResetAll={resetAll}
          />
        )}

        {children}
      </ChartContext.Provider>
    </BaseCanvas>
  );
});

export default AreaChart;
