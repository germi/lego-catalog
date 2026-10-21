import { useMemo } from "react";
import BaseCanvas from "./canvas/BaseCanvas.jsx";
import { AxisLayer }  from "./layers/AxisLayer.jsx";
import { YAxisLayer } from "./layers/YAxisLayer.jsx";
import { RibbonLayer } from "./layers/RibbonLayer.jsx";
import { RIBBON_CHART_DEFAULTS as D } from "../presets/RibbonChart.defaults.js";
import { resolveInline, resolveSpacing } from "../utils/resolveInline.js";

export function RibbonChart({
  data         = D.data,
  color        = D.color,
  rectStyle    = D.rectStyle,
  margin       = D.margin,
  padding      = D.padding,
  max          = D.max,
  scaleType    = D.scaleType,
  duration     = D.duration,
  ease         = D.ease,
  showXAxis    = D.showXAxis,
  showYAxis    = D.showYAxis,
  yTickValues  = D.yTickValues,
  xTickValues  = D.xTickValues,
  xTickAngle   = D.xTickAngle,
  xTickFontSize = D.xTickFontSize,
  xTickStagger = D.xTickStagger,
  xTickColor   = D.xTickColor,
  xTickTextColor = D.xTickTextColor,
  paddingInner = D.paddingInner,
  paddingOuter = D.paddingOuter,
  bgColor      = D.bgColor,
  format       = D.format,
  stacked      = D.stacked,
  yNumTicks    = D.yNumTicks,
  yTickSize    = D.yTickSize,
  yTickColor   = D.yTickColor,
  yTickTextColor   = D.yTickTextColor,
  yGridColor       = D.yGridColor,
  yGridDasharray   = D.yGridDasharray,
  yGridOpacity     = D.yGridOpacity,
  keys         = D.keys,
  useCurves    = D.useCurves,
  useLines     = D.useLines,
  linkOpacity  = D.linkOpacity,
  linkDimOpacity = D.linkDimOpacity,
  showLinks    = D.showLinks,
  highlighted  = D.highlighted,
  highlightFill          = D.highlightFill,
  highlightFillOpacity   = D.highlightFillOpacity,
  highlightStrokeColor   = D.highlightStrokeColor,
  highlightStrokeWidth   = D.highlightStrokeWidth,
  highlightStrokeOpacity = D.highlightStrokeOpacity,
  dimFill                = D.dimFill,
  dimOpacity             = D.dimOpacity,
  dimStrokeColor         = D.dimStrokeColor,
  dimStrokeWidth         = D.dimStrokeWidth,
  dimStrokeOpacity       = D.dimStrokeOpacity,
  allowZoom    = D.allowZoom,
  maxZoom      = D.maxZoom,
  zoomAxes     = D.zoomAxes,
  rtl          = D.rtl,
  yAxisSide    = D.yAxisSide,
  onSelect,
  onHover,
  children,
  className,
  style,
}) {
  const resolvedMargin  = useMemo(() => resolveSpacing(margin,  rtl), [margin,  rtl]);
  const resolvedPadding = useMemo(() => resolveSpacing(padding, rtl), [padding, rtl]);
  const resolvedYSide   = resolveInline(yAxisSide, rtl);
  const rtlData         = useMemo(() => rtl ? [...data].reverse() : data, [data, rtl]);

  const xTickFormat = useMemo(
    () => (d) => data.find((e) => e.id === d)?.name ?? d,
    [data],
  );

  const clampPanInset = useMemo(() => ({
    x: resolvedMargin.left + resolvedMargin.right + resolvedPadding.left + resolvedPadding.right,
    y: resolvedMargin.top  + resolvedMargin.bottom + resolvedPadding.top  + resolvedPadding.bottom,
  }), [resolvedMargin, resolvedPadding]);

  return (
    <BaseCanvas skipProjection duration={duration} zoomAxes={zoomAxes ?? "x"} allowManualZoom={allowZoom} maxZoom={maxZoom} clampPan={allowZoom} clampPanInset={clampPanInset} className={["ribbon-container", className].filter(Boolean).join(" ")} style={style}>
      {showYAxis && (
        <YAxisLayer
          order={1}
          side={resolvedYSide}
          showGrid
          data={rtlData}
          margin={resolvedMargin}
          padding={resolvedPadding}
          max={max}
          stacked={stacked}
          scaleType={scaleType}
          tickValues={yTickValues}
          tickFormat={format}
          numTicks={yNumTicks}
          tickSize={yTickSize}
          tickColor={yTickColor}
          tickTextColor={yTickTextColor}
          gridColor={yGridColor}
          gridDasharray={yGridDasharray}
          gridOpacity={yGridOpacity}
          ease={ease}
          duration={duration}
          rtl={rtl}
        />
      )}
      <RibbonLayer
        order={2}
        data={rtlData}
        scaleType={scaleType}
        color={color}
        rectStyle={rectStyle}
        margin={resolvedMargin}
        padding={resolvedPadding}
        max={max}
        duration={duration}
        ease={ease}
        paddingInner={paddingInner}
        paddingOuter={paddingOuter}
        bgColor={bgColor}
        format={format}
        stacked={stacked}
        keys={keys}
        useCurves={useCurves}
        useLines={useLines}
        linkOpacity={linkOpacity}
        linkDimOpacity={linkDimOpacity}
        showLinks={showLinks}
        highlighted={highlighted}
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
        onSelect={onSelect}
        onHover={onHover}
      />
      {showXAxis && (
        <AxisLayer
          order={3}
          side="bottom"
          phased
          data={rtlData}
          margin={resolvedMargin}
          padding={resolvedPadding}
          max={max}
          stacked={stacked}
          tickValues={xTickValues}
          tickFormat={xTickFormat}
          tickAngle={xTickAngle}
          tickFontSize={xTickFontSize}
          tickStagger={xTickStagger}
          tickColor={xTickColor}
          tickTextColor={xTickTextColor}
          paddingInner={paddingInner}
          paddingOuter={paddingOuter}
          ease={ease}
          duration={duration}
        />
      )}
      {children}
    </BaseCanvas>
  );
}

export default RibbonChart;
