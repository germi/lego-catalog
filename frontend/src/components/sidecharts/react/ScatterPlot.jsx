import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import BaseCanvas from "./canvas/BaseCanvas.jsx";
import { ScatterLayer } from "./layers/ScatterLayer.jsx";
import { AxisLayer }    from "./layers/AxisLayer.jsx";
import { YAxisLayer }   from "./layers/YAxisLayer.jsx";
import { VoronoiLayer } from "./layers/VoronoiLayer.jsx";
import { VoronoiHoverLayer } from "./layers/VoronoiHoverLayer.jsx";
import { VoronoiLabelLayer } from "./layers/VoronoiLabelLayer.jsx";
import { MaskLayer } from "./layers/MaskLayer.jsx";
import { makeScaleProjector } from "../utils/projectors/scaleProjector.js";
import { idsToZoomDomain } from "../utils/idsToZoomDomain.js";
import { resolveInline, resolveSpacing } from "../utils/resolveInline.js";
import { SCATTER_PLOT_DEFAULTS as D } from "../presets/ScatterPlot.defaults.js";

/**
 * ScatterPlot — React port. Mirrors `vue/ScatterPlot.vue`.
 *
 * Composes a BaseCanvas with a ScatterLayer, both axis layers, and an optional
 * VoronoiLayer (with hover + labels) when `showHover`/`showLabels` is enabled.
 *
 * The `ref` exposes the canvas's programmatic zoom API
 * (`zoomToDomain`, `setTransform`, …) plus `redraw`, `svgEl`, `width`, `height`.
 *
 * Accessor props (`xAccessor`, `yAccessor`, …) must be **stable references**
 * (module-level consts, or memoized via `useCallback`). Inline arrow functions
 * in the parent JSX produce a new reference every render and would cause the
 * `scatterProjector` memo to invalidate on every parent state change.
 */
export const ScatterPlot = forwardRef(function ScatterPlot({
  data            = [],
  margin          = D.margin,
  padding         = D.padding,

  // Accessors / scales
  xAccessor       = D.xAccessor,
  yAccessor       = D.yAccessor,
  xScaleType      = D.xScaleType,
  yScaleType      = D.yScaleType,
  nice            = D.nice,
  xDomain         = D.xDomain,
  yDomain         = D.yDomain,
  xScale          = D.xScale,
  yScale          = D.yScale,

  // Dots
  radius          = D.radius,
  rScaleType      = D.rScaleType,
  dotSize         = D.dotSize,
  dotOpacity      = D.dotOpacity,
  valueAccessor   = D.valueAccessor,
  color           = D.color,
  colorAccessor   = D.colorAccessor,
  fixedSize       = D.fixedSize,
  sortByRadius    = D.sortByRadius,

  // Stroke
  strokeColor     = D.strokeColor,
  strokeWidth     = D.strokeWidth,
  strokeOpacity   = D.strokeOpacity,
  hoverStrokeColor = D.hoverStrokeColor,

  // Interaction
  highlighted     = [],
  selected        = D.selected,
  highlightFill         = D.highlightFill,
  highlightFillOpacity  = D.highlightFillOpacity,
  highlightStrokeColor  = D.highlightStrokeColor,
  highlightStrokeWidth  = D.highlightStrokeWidth,
  highlightStrokeOpacity = D.highlightStrokeOpacity,
  dimFill         = D.dimFill,
  dimOpacity      = D.dimOpacity,
  dimStrokeColor  = D.dimStrokeColor,
  dimStrokeWidth  = D.dimStrokeWidth,
  dimStrokeOpacity = D.dimStrokeOpacity,

  // Axes
  showXAxis       = D.showXAxis,
  showYAxis       = D.showYAxis,
  xAxisSide       = D.xAxisSide,
  yAxisSide       = D.yAxisSide,
  xTickFormat     = D.xTickFormat,
  yTickFormat     = D.yTickFormat,
  xTicks          = D.xTicks,
  yTicks          = D.yTicks,
  xTickAngle      = D.xTickAngle,
  xTickFontSize   = D.xTickFontSize,
  xTickStagger    = D.xTickStagger,
  showGrid        = D.showGrid,
  gridColor       = D.gridColor,
  tickColor       = D.tickColor,
  tickTextColor   = D.tickTextColor,
  yTextTicksInside = D.yTextTicksInside,

  // Labels / hover / voronoi
  showLabels      = D.showLabels,
  showHover       = D.showHover,
  showCells       = D.showCells,
  cellStroke      = D.cellStroke,
  cellStrokeWidth = D.cellStrokeWidth,
  labelAccessor   = D.labelAccessor,
  useVoronoiHover = D.useVoronoiHover,
  recomputeOnZoom = D.recomputeOnZoom,
  zoomRecomputeMode = D.zoomRecomputeMode,
  labelOpacity         = D.labelOpacity,
  labelOpacityAccessor = D.labelOpacityAccessor,
  labelBgColor    = D.labelBgColor,
  labelBgOpacity  = D.labelBgOpacity,
  labelBgStroke   = D.labelBgStroke,
  labelBgStrokeWidth = D.labelBgStrokeWidth,
  labelTextColor  = D.labelTextColor,
  labelFontSize   = D.labelFontSize,
  labelFontWeight = D.labelFontWeight,
  labelFontFamily = D.labelFontFamily,
  labelCornerRadius = D.labelCornerRadius,
  labelPadding    = D.labelPadding,
  labelSeparation = D.labelSeparation,
  labelMinCellArea     = D.labelMinCellArea,
  labelSuppressOverlap = D.labelSuppressOverlap,
  labelForce           = D.labelForce,
  labelConnector       = D.labelConnector,
  labelConnectorColor  = D.labelConnectorColor,
  labelConnectorWidth  = D.labelConnectorWidth,

  // Zoom
  allowZoom       = D.allowZoom,
  maxZoom         = D.maxZoom,
  zoomAxes        = D.zoomAxes ?? "xy",
  userZoomAxes    = D.userZoomAxes ?? null,
  // Keep pan/zoom (incl. programmatic zoomToIds) inside the data borders.
  clampPan        = D.clampPan,
  clampPanInset   = D.clampPanInset,
  duration        = D.duration,
  rtl             = D.rtl,

  // Clip the dots + voronoi labels to the plot box (see defaults). `clipInset`
  // is a number (uniform px) or an object — the extra inset from the axis edge.
  clipToPlot      = D.clipToPlot,
  clipInset       = D.clipInset,

  onHover,
  onSelect,
  onZoom,
  children,
  className,
  style,
}, ref) {
  // ── Forward canvas ref API ───────────────────────────────────────────────
  const canvasRef     = useRef(null);
  const scatterRef    = useRef(null);
  // Latest data + accessors for zoomToIds, read at call time so the imperative
  // handle can keep [] deps (it otherwise only delegates to the stable canvasRef).
  const fitPropsRef = useRef(null);
  fitPropsRef.current = { data, xAccessor, yAccessor, zoomAxes, xScaleType, yScaleType };
  useImperativeHandle(ref, () => ({
    zoomToDomain: (...a) => canvasRef.current?.zoomToDomain(...a),
    // Fit a set of data points by id — mirrors ScatterPlot.vue's zoomToIds.
    zoomToIds: (ids, opts = {}) => {
      const p = fitPropsRef.current;
      const dom = idsToZoomDomain(p.data, ids, {
        xAccessor:       p.xAccessor,
        yAccessor:       p.yAccessor,
        idAccessor:      opts.idAccessor,
        scale:           opts.scale,
        axes:            opts.axes ?? p.zoomAxes ?? "xy",
        singlePointZoom: opts.singlePointZoom,
        minSpan:         opts.minSpan,
        // Auto-detect log axes so the minSpan floor is computed in log space
        // (a linear floor balloons / breaks at the low end of a log scale).
        xLog:            opts.xLog ?? (p.xScaleType === "log"),
        yLog:            opts.yLog ?? (p.yScaleType === "log"),
      });
      if (dom) canvasRef.current?.zoomToDomain(dom, opts.duration, opts.ease);
    },
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

  // ── Inner SVG dimensions reported by BaseCanvas via the draw payload ────
  const [innerWidth,  setInnerWidth]  = useState(0);
  const [innerHeight, setInnerHeight] = useState(0);
  const handleDraw = useCallback((payload) => {
    if (payload?.innerWidth  !== innerWidth)  setInnerWidth(payload.innerWidth);
    if (payload?.innerHeight !== innerHeight) setInnerHeight(payload.innerHeight);
  }, [innerWidth, innerHeight]);

  // ── Intercept voronoi hover and swap the target to the actual dot ────────
  // so consumers using Popper / floating-ui anchor to the visible dot rather
  // than the invisible ghost cell.
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  // True while the user is wheel/drag-zooming — suppress hover-with-data so a
  // tooltip doesn't reappear mid-gesture. A ref, not state (no re-render needed).
  const isGesturingRef = useRef(false);
  const handleVoronoiHover = useCallback((event) => {
    if (!event) { onHoverRef.current?.(null); return; }
    if (isGesturingRef.current) return;
    const dot = scatterRef.current?.getDotEl?.(event.data.id);
    onHoverRef.current?.(dot ? { ...event, target: dot } : event);
  }, []);
  // Non-voronoi hover: also suppressed mid-gesture.
  const handleScatterHover = useCallback((e) => {
    if (!isGesturingRef.current) onHoverRef.current?.(e);
  }, []);

  // Manual (wheel/drag) zoom: forward the transform AND drop any open tooltip —
  // its anchor moves every frame, so a held-open tooltip hangs mispositioned.
  // Programmatic zoom doesn't fire this.
  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;
  const handleZoom = useCallback((t) => {
    onZoomRef.current?.(t);
    onHoverRef.current?.(null);
  }, []);
  const handleZoomStart = useCallback(() => { isGesturingRef.current = true; }, []);
  const handleZoomEnd   = useCallback(() => { isGesturingRef.current = false; }, []);

  const resolvedMargin = useMemo(() => resolveSpacing(margin, rtl), [margin, rtl]);
  const resolvedPadding = useMemo(() => resolveSpacing(padding, rtl), [padding, rtl]);

  // Clip box inset (px per physical side). A number = uniform; an object is
  // RTL-resolved. Fed to the MaskLayer as its `padding` → box = SVG − margin − inset.
  const resolvedClipInset = useMemo(
    () => (typeof clipInset === "number"
      ? { top: clipInset, right: clipInset, bottom: clipInset, left: clipInset }
      : resolveSpacing(clipInset ?? {}, rtl)),
    [clipInset, rtl],
  );
  // Conditional clip wrapper: wrap `node` in a box-clipping MaskLayer when
  // `clipToPlot`, else return it as-is. Mirrors Vue's clipWrapper.
  const clip = (node, order) => (clipToPlot
    ? (
      <MaskLayer clipToPlot order={order} margin={resolvedMargin} padding={resolvedClipInset}>
        {node}
      </MaskLayer>
      )
    : node);
  const resolvedYSide  = resolveInline(yAxisSide, rtl);
  // clampPanInset hugs the DATA area (SVG minus the chart's own margins AND
  // padding) — derive it from both by default; an explicit clampPanInset prop
  // overrides.
  const resolvedClampPanInset = useMemo(
    () => clampPanInset ?? {
      x: (resolvedMargin.left ?? 0) + (resolvedMargin.right  ?? 0)
       + (resolvedPadding.left ?? 0) + (resolvedPadding.right ?? 0),
      y: (resolvedMargin.top  ?? 0) + (resolvedMargin.bottom ?? 0)
       + (resolvedPadding.top  ?? 0) + (resolvedPadding.bottom ?? 0),
    },
    [clampPanInset, resolvedMargin, resolvedPadding],
  );

  // ── Always-ready projector — recomputes only when its inputs change ─────
  const scatterProjector = useMemo(
    () => makeScaleProjector({
      data,
      width:  innerWidth,
      height: innerHeight,
      xAccessor,
      yAccessor,
      xScaleType,
      yScaleType,
      nice,
      xDomain: xDomain ?? undefined,
      yDomain: yDomain ?? undefined,
      xScale:  xScale  ?? undefined,
      yScale:  yScale  ?? undefined,
      rangePad: resolvedPadding,
      rtl,
    }),
    [data, innerWidth, innerHeight, xAccessor, yAccessor,
      xScaleType, yScaleType, nice, xDomain, yDomain, xScale, yScale, resolvedPadding, rtl],
  );

  return (
    <BaseCanvas
      ref={canvasRef}
      skipProjection
      projector={scatterProjector}
      margin={resolvedMargin}
      allowManualZoom={allowZoom}
      maxZoom={maxZoom}
      duration={duration}
      zoomAxes={zoomAxes}
      userZoomAxes={userZoomAxes}
      clampPan={clampPan}
      clampPanInset={resolvedClampPanInset}
      onDraw={handleDraw}
      onZoom={handleZoom}
      onZoomStart={handleZoomStart}
      onZoomEnd={handleZoomEnd}
      className={className}
      style={style}
    >
      {clip(
        <ScatterLayer
          ref={scatterRef}
          order={10}
          data={data}
          radius={radius}
          rScaleType={rScaleType}
          dotSize={dotSize}
          dotOpacity={dotOpacity}
          valueAccessor={valueAccessor}
          color={color}
          colorAccessor={colorAccessor}
          highlighted={highlighted}
          selected={selected}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          strokeOpacity={strokeOpacity}
          hoverStrokeColor={hoverStrokeColor}
          highlightFill={highlightFill}
          highlightFillOpacity={highlightFillOpacity}
          highlightStrokeColor={highlightStrokeColor}
          highlightStrokeWidth={highlightStrokeWidth}
          highlightStrokeOpacity={highlightStrokeOpacity}
          dimFill={dimFill}
          dimOpacity={dimOpacity}
          dimStrokeColor={dimStrokeColor}
          dimStrokeWidth={dimStrokeWidth}
          dimStrokeOpacity={dimStrokeOpacity}
          fixedSize={fixedSize}
          sortByRadius={sortByRadius}
          duration={duration}
          {...(useVoronoiHover ? {} : { onHover: handleScatterHover, onClick: onSelect })}
        />,
        10,
      )}

      {/* NB: the x-axis is deliberately NOT given `padding`. The projector
          already insets the x-scale range via `rangePad`, so ticks are placed
          from the scale alone. Passing padding here would double-count the
          horizontal inset AND push the axis line up by padding.bottom. With no
          padding the line sits at the bottom margin — mirroring the y-axis,
          whose line always sits at the left margin regardless of padding. The
          y-axis DOES need padding because it re-ranges the scale itself. */}
      {showXAxis && (
        <AxisLayer
          order={1}
          side={xAxisSide}
          tickFormat={xTickFormat}
          numTicks={xTicks}
          tickAngle={xTickAngle}
          tickFontSize={xTickFontSize}
          tickStagger={xTickStagger}
          tickColor={tickColor}
          tickTextColor={tickTextColor}
          showGrid={showGrid}
          gridColor={gridColor}
          margin={resolvedMargin}
          duration={duration}
        />
      )}

      {showYAxis && (
        <YAxisLayer
          order={2}
          side={resolvedYSide}
          tickFormat={yTickFormat}
          numTicks={yTicks}
          showGrid={showGrid}
          gridColor={gridColor}
          tickColor={tickColor}
          tickTextColor={tickTextColor}
          textTicksInside={yTextTicksInside}
          margin={resolvedMargin}
          padding={resolvedPadding}
          duration={duration}
          rtl={rtl}
        />
      )}

      {(showLabels || (showHover && useVoronoiHover)) && (
        <VoronoiLayer
          order={20}
          data={data}
          showCells={showCells}
          showCentroids={showCells}
          cellStroke={cellStroke}
          cellStrokeWidth={cellStrokeWidth}
          recomputeOnZoom={recomputeOnZoom}
          zoomRecomputeMode={zoomRecomputeMode}
        >
          {/* Labels get the same optional box clip as the dots (order 30, above
              the cells). The wrapper stays INSIDE VoronoiLayer so the label keeps
              the voronoi context, while the sibling hover layer stays unclipped. */}
          {showLabels && clip(
            <VoronoiLabelLayer
              text={labelAccessor}
              radius={radius}
              rScaleType={rScaleType}
              dotSize={dotSize}
              valueAccessor={valueAccessor}
              opacity={labelOpacity}
              opacityAccessor={labelOpacityAccessor}
              bgColor={labelBgColor}
              bgOpacity={labelBgOpacity}
              bgStroke={labelBgStroke}
              bgStrokeWidth={labelBgStrokeWidth}
              textColor={labelTextColor}
              fontSize={labelFontSize}
              fontWeight={labelFontWeight}
              fontFamily={labelFontFamily}
              cornerRadius={labelCornerRadius}
              padding={labelPadding}
              separation={labelSeparation}
              minCellArea={labelMinCellArea}
              suppressOverlap={labelSuppressOverlap}
              forceLabel={labelForce}
              connector={labelConnector}
              connectorColor={labelConnectorColor}
              connectorWidth={labelConnectorWidth}
            />,
            30,
          )}
          {useVoronoiHover && (
            <VoronoiHoverLayer
              onHover={handleVoronoiHover}
              onClick={onSelect}
            />
          )}
        </VoronoiLayer>
      )}

      {children}
    </BaseCanvas>
  );
});

export default ScatterPlot;
