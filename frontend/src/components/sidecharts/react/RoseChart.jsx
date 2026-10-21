import { useRef, useState, useMemo, forwardRef, useImperativeHandle } from "react";
import RoseCanvas from "./canvas/RoseCanvas.jsx";
import { SegmentLayer }      from "./layers/SegmentLayer.jsx";
import { RadialGridLayer }   from "./layers/RadialGridLayer.jsx";
import { RadialLabelLayer }  from "./layers/RadialLabelLayer.jsx";
import { ROSE_CHART_DEFAULTS as D } from "../presets/RoseChart.defaults.js";

// Stable references for the SegmentLayer radius accessors. Defined at module
// scope so every render of RoseChart passes the SAME function instance to its
// child SegmentLayers. If these were inlined in JSX, every render would
// create new closures; SegmentLayer's prop-change effect would see the
// reference changes and fire a spurious `core.rerender`, kicking off an
// 800ms arc transition that would overwrite any hover/highlight fill via
// the chained `.attr("fill", fill)`. Mirrors the Vue preset's stable
// `hitInnerRadiusFn` / `segInnerRadiusFn` / `segOuterRadiusFn`.
const hitInnerRadiusFn = (_, scale) => scale.range()[0];
const segInnerRadiusFn = (d, scale) => scale(d.stackOffset ?? 0);
const segOuterRadiusFn = (d, scale) => scale(d.value ?? 0);

export const RoseChart = forwardRef(function RoseChart({
  data              = [],
  duration          = D.duration,
  padAngle          = D.padAngle,
  padRadius         = D.padRadius,
  cornerRadius      = D.cornerRadius,
  labelsOutside     = D.labelsOutside,
  circularLabels    = D.circularLabels,
  highlighted       = D.highlighted,
  hoverBgColor      = D.hoverBgColor,
  showCursorPointer = D.showCursorPointer,
  bgColor           = D.bgColor,
  showLabels        = D.showLabels,
  showValues        = D.showValues,
  margin            = D.margin,
  startAngle        = D.startAngle,
  endAngle          = D.endAngle,
  max               = D.max,
  maxLabelWidth     = D.maxLabelWidth,
  innerRadius       = D.innerRadius,
  format            = D.format,
  strokeColor       = D.strokeColor,
  strokeWidth       = D.strokeWidth,
  lineLabelDistance = D.lineLabelDistance,
  paddingLineLabel  = D.paddingLineLabel,
  valueLabelColor   = D.valueLabelColor,
  fillOpacity       = D.fillOpacity,
  scaleType         = D.scaleType,
  stacked           = D.stacked,
  showGrid          = D.showGrid,
  gridColor         = D.gridColor,
  gridStrokeDasharray = D.gridStrokeDasharray,
  tickColor         = D.tickColor,
  onSelect,
  onHover,
  children,
  className,
  style,
}, ref) {
  const roseCanvasRef = useRef(null);
  const [hoveredId, setHoveredId] = useState(null);

  const series = useMemo(
    () => Object.entries(data[0]?.values ?? {}).map(([key, v]) => ({
      key,
      name:       v.name,
      color:      v.color,
      hoverColor: v.hoverColor ?? null,
    })),
    [data],
  );

  const processedData = useMemo(
    () => data.map((item, i) => ({ ...item, id: item.id ?? i + 1 })),
    [data],
  );

  const computedMax = useMemo(() => {
    if (max) return max;
    const raw = data;
    if (!raw.length || !raw[0]?.values) return 100;
    const seriesKeys = Object.keys(raw[0].values);
    let m = 0;
    for (const item of raw) {
      let offset = 0;
      for (const key of seriesKeys) {
        const v      = item.values[key];
        const actual = v?.value ?? 0;
        if (stacked) {
          m = Math.max(m, offset + actual, offset + (v?.max ?? actual));
          offset += actual;
        } else {
          m = Math.max(m, actual, v?.max ?? 0);
        }
      }
    }
    return m || 100;
  }, [data, max, stacked]);

  const effectiveHighlighted = hoveredId ?? highlighted;

  useImperativeHandle(ref, () => ({
    get width()      { return roseCanvasRef.current?.width; },
    get height()     { return roseCanvasRef.current?.height; },
    get computedMax(){ return computedMax; },
  }), [computedMax]);

  function rawItem(arcData) {
    return data.find((item, i) => (item.id ?? i + 1) === arcData.id) ?? arcData;
  }

  function onInteractiveSelect({ target, data: arcData }) {
    onSelect?.({ target, data: rawItem(arcData) });
  }

  function onInteractiveHover(payload) {
    setHoveredId(payload?.data?.id ?? null);
    if (!payload) { onHover?.(null); return; }
    let { target } = payload;
    if (series.length === 1 && roseCanvasRef.current?.svgEl) {
      const key = series[0].key;
      const el  = roseCanvasRef.current.svgEl.querySelector(`[id="arc-segs-${payload.data.id}__${key}"]`);
      if (el) target = el;
    }
    onHover?.({ target, data: rawItem(payload.data) });
  }

  return (
    <RoseCanvas
      ref={roseCanvasRef}
      duration={duration}
      highlighted={effectiveHighlighted}
      margin={margin}
      startAngle={startAngle}
      endAngle={endAngle}
      innerRadius={innerRadius}
      scaleType={scaleType}
      className={className}
      style={style}
    >
      {/* Interactive hit area — full radius, painted in bgColor */}
      <SegmentLayer
        data={processedData}
        max={computedMax}
        scaleType={scaleType}
        innerRadiusFn={hitInnerRadiusFn}
        interactive
        order={0}
        fillColor={bgColor}
        hoverColor={hoverBgColor}
        showCursorPointer={showCursorPointer}
        padAngle={padAngle}
        padRadius={padRadius}
        strokeWidth={strokeWidth}
        cornerRadius={cornerRadius}
        fillOpacity={fillOpacity}
        strokeOpacity={fillOpacity}
        onSelect={onInteractiveSelect}
        onHover={onInteractiveHover}
      />
      {showGrid && (
        <RadialGridLayer
          max={computedMax}
          scaleType={scaleType}
          order={1}
          gridColor={gridColor}
          gridStrokeDasharray={gridStrokeDasharray}
          tickColor={tickColor}
        />
      )}
      <SegmentLayer
        data={processedData}
        series={series}
        stacked={stacked}
        max={computedMax}
        scaleType={scaleType}
        order={2}
        layerId="segs"
        innerRadiusFn={segInnerRadiusFn}
        outerRadiusFn={segOuterRadiusFn}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        fillOpacity={fillOpacity}
        strokeOpacity={fillOpacity}
        cornerRadius={cornerRadius}
        padAngle={padAngle}
        padRadius={padRadius}
      />
      <RadialLabelLayer
        data={processedData}
        max={computedMax}
        scaleType={scaleType}
        order={3}
        format={format}
        circularLabels={circularLabels}
        lineLabelDistance={lineLabelDistance}
        paddingLineLabel={paddingLineLabel}
        showValues={showValues}
        valueLabelColor={valueLabelColor}
        labelsOutside={labelsOutside}
        showLabels={showLabels}
        maxLabelWidth={maxLabelWidth}
      />
      {children}
    </RoseCanvas>
  );
});

export default RoseChart;
