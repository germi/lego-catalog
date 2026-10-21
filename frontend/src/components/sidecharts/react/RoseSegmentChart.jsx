import { useRef, useState, useMemo, forwardRef, useImperativeHandle } from "react";
import RoseCanvas from "./canvas/RoseCanvas.jsx";
import { SegmentLayer }     from "./layers/SegmentLayer.jsx";
import { RadialGridLayer }  from "./layers/RadialGridLayer.jsx";
import { RadialLabelLayer } from "./layers/RadialLabelLayer.jsx";
import { ROSE_SEGMENT_CHART_DEFAULTS as D } from "../presets/RoseSegmentChart.defaults.js";

export const RoseSegmentChart = forwardRef(function RoseSegmentChart({
  data                = [],
  duration            = D.duration,
  padAngle            = D.padAngle,
  padRadius           = D.padRadius,
  cornerRadius        = D.cornerRadius,
  labelsOutside       = D.labelsOutside,
  circularLabels      = D.circularLabels,
  highlighted         = D.highlighted,
  hoverBgColor        = D.hoverBgColor,
  showCursorPointer   = D.showCursorPointer,
  bgColor             = D.bgColor,
  showLabels          = D.showLabels,
  margin              = D.margin,
  startAngle          = D.startAngle,
  endAngle            = D.endAngle,
  max                 = D.max,
  maxLabelWidth       = D.maxLabelWidth,
  innerRadius         = D.innerRadius,
  bandOpacity         = D.bandOpacity,
  bandStrokeWidth     = D.bandStrokeWidth,
  mainLineStrokeWidth = D.mainLineStrokeWidth,
  showGrid            = D.showGrid,
  gridColor           = D.gridColor,
  gridStrokeDasharray = D.gridStrokeDasharray,
  tickColor           = D.tickColor,
  textColor           = D.textColor,
  minAngle            = D.minAngle,
  stacked             = D.stacked,
  scaleType           = D.scaleType,
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

  // Stack multi-series data; always uses stackBy="max" for bands.
  const processedData = useMemo(() => {
    const raw = data.map((item, i) => ({ ...item, id: item.id ?? i + 1 }));
    if (!raw.length || !raw[0]?.values) return raw;
    const seriesKeys = Object.keys(raw[0].values);
    return raw.map((item) => {
      let offset = 0;
      const newValues = {};
      for (const key of seriesKeys) {
        const v      = item.values[key];
        const actual = v.value ?? 0;
        if (stacked) {
          const advance = v.max ?? actual;
          newValues[key] = {
            ...v,
            stackOffset: offset,
            value:       offset + actual,
            min:         offset,
            max:         offset + (v.max ?? actual),
          };
          offset += advance;
        } else {
          newValues[key] = { ...v, stackOffset: 0 };
        }
      }
      return { ...item, values: newValues };
    });
  }, [data, stacked]);

  const computedMax = useMemo(() => {
    if (max) return max;
    let m = 0;
    for (const item of processedData) {
      for (const key in item.values ?? {}) {
        const v = item.values[key];
        m = Math.max(m, v.value ?? 0, v.min ?? 0, v.max ?? 0);
      }
    }
    return m || 100;
  }, [processedData, max]);

  const isSingleSeries      = series.length === 1;
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
    if (isSingleSeries && roseCanvasRef.current?.svgEl) {
      const key = series[0].key;
      const el  = roseCanvasRef.current.svgEl.querySelector(`[id="arc-lines-${payload.data.id}__${key}"]`);
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
      {/* Interactive hit area — full radius, transparent fill */}
      <SegmentLayer
        data={processedData}
        max={computedMax}
        scaleType={scaleType}
        innerRadiusFn={(_, s) => s.range()[0]}
        interactive
        order={0}
        fillColor={bgColor}
        hoverColor={hoverBgColor}
        showCursorPointer={showCursorPointer}
        padAngle={padAngle}
        padRadius={padRadius}
        strokeWidth={mainLineStrokeWidth}
        cornerRadius={cornerRadius}
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
      {/* Confidence bands (min–max) */}
      <SegmentLayer
        data={processedData}
        series={series}
        max={computedMax}
        scaleType={scaleType}
        order={2}
        innerRadiusFn={(d, scale) => scale(d.min ?? 0)}
        outerRadiusFn={(d, scale) => scale(d.max ?? 0)}
        strokeColor="transparent"
        strokeWidth={bandStrokeWidth}
        fillOpacity={bandOpacity}
        cornerRadius={cornerRadius}
        padAngle={padAngle}
        padRadius={padRadius}
      />
      {/* Value lines — stroked with data color */}
      <SegmentLayer
        data={processedData}
        series={series}
        max={computedMax}
        scaleType={scaleType}
        order={2}
        layerId="lines"
        innerRadiusFn={(d, scale) => scale(d.value ?? 0)}
        outerRadiusFn={(d, scale) => scale(d.value ?? 0)}
        strokeWidth={mainLineStrokeWidth}
        useDataColorAsStroke
        fillOpacity={0}
        cornerRadius={0}
        padAngle={padAngle}
        padRadius={padRadius}
      />
      <RadialLabelLayer
        data={processedData}
        max={computedMax}
        scaleType={scaleType}
        order={3}
        labelsOutside={labelsOutside}
        showLabels={showLabels}
        maxLabelWidth={maxLabelWidth}
        showValues={false}
        minAngle={minAngle}
        textColor={textColor}
        circularLabels={circularLabels}
      />
      {children}
    </RoseCanvas>
  );
});

export default RoseSegmentChart;
