import { useRef, useState, useMemo, forwardRef, useImperativeHandle } from "react";
import RoseCanvas from "./canvas/RoseCanvas.jsx";
import { SegmentLayer }     from "./layers/SegmentLayer.jsx";
import { RadialLabelLayer } from "./layers/RadialLabelLayer.jsx";
import { DONUT_CHART_DEFAULTS as D } from "../presets/DonutChart.defaults.js";

export const DonutChart = forwardRef(function DonutChart({
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
  fillOpacity       = D.fillOpacity,
  scaleType         = D.scaleType,
  valueLabelColor   = D.valueLabelColor,
  textColor         = D.textColor,
  ringGap           = D.ringGap,
  groupBy           = D.groupBy,
  onSelect,
  onHover,
  children,
  className,
  style,
}, ref) {
  const roseCanvasRef = useRef(null);
  const [hoveredId, setHoveredId] = useState(null);

  // -- SERIES EXTRACTION --
  const rawSeries = useMemo(
    () => Object.entries(data[0]?.values ?? {}).map(([key, v]) => ({
      key,
      name:       v.name,
      color:      v.color,
      hoverColor: v.hoverColor ?? null,
    })),
    [data],
  );

  const baseData = useMemo(
    () => data.map((item, i) => ({ ...item, id: item.id ?? i + 1 })),
    [data],
  );

  // -- TRANSPOSITION --
  const isTransposed = groupBy === "category";

  const processedData = useMemo(() => {
    if (!isTransposed) return baseData;
    return rawSeries.map((s) => ({
      id:   s.key,
      name: s.name,
      values: Object.fromEntries(
        baseData.map((cat) => {
          const sv = cat.values?.[s.key] ?? {};
          return [
            String(cat.id),
            {
              id:         String(cat.id),
              name:       cat.name,
              value:      sv.value ?? 0,
              color:      sv.color ?? s.color ?? null,
              hoverColor: sv.hoverColor ?? s.hoverColor ?? null,
              order:      sv.order,
            },
          ];
        }),
      ),
    }));
  }, [isTransposed, baseData, rawSeries]);

  const series = useMemo(() => {
    if (!isTransposed) return rawSeries;
    return baseData.map((cat) => ({
      key:        String(cat.id),
      name:       cat.name,
      color:      null,
      hoverColor: null,
    }));
  }, [isTransposed, rawSeries, baseData]);

  // -- ANGLE VALUE --
  const totalAngleValue = (d) => {
    if (!d.values) return d.value ?? 0;
    return series.reduce((sum, s) => sum + (d.values[s.key]?.value ?? 0), 0);
  };

  // -- LABEL DATA --
  const labelData = processedData;

  const labelAngleValue = useMemo(() => {
    const last = series[series.length - 1];
    return (d) => {
      if (!d.values || !last) return d.value ?? 0;
      return d.values[last.key]?.value ?? 0;
    };
  }, [series]);

  // -- RING RADIUS FUNCTIONS --
  const ringCount = series.length || 1;

  const seriesRingInnerFn = useMemo(() => {
    const n   = ringCount;
    const gap = ringGap;
    return (d, scale) => {
      const [minR, maxR] = scale.range();
      const totalGap  = Math.max(0, n - 1) * gap;
      const ringWidth = (maxR - minR - totalGap) / n;
      return minR + d.ringIdx * (ringWidth + gap);
    };
  }, [ringCount, ringGap]);

  const seriesRingOuterFn = useMemo(() => {
    const n   = ringCount;
    const gap = ringGap;
    return (d, scale) => {
      const [minR, maxR] = scale.range();
      const totalGap  = Math.max(0, n - 1) * gap;
      const ringWidth = (maxR - minR - totalGap) / n;
      return minR + d.ringIdx * (ringWidth + gap) + ringWidth;
    };
  }, [ringCount, ringGap]);

  // -- INTERACTION --
  const effectiveHighlighted = hoveredId ?? highlighted;

  useImperativeHandle(ref, () => ({
    get width()  { return roseCanvasRef.current?.width; },
    get height() { return roseCanvasRef.current?.height; },
  }), []);

  function rawItem(arcData) {
    if (isTransposed) {
      const catId = arcData.seriesKey;
      return data.find((item, i) => String(item.id ?? i + 1) === String(catId)) ?? arcData;
    }
    const lookupId = arcData.categoryId ?? arcData.id;
    return data.find((item, i) => (item.id ?? i + 1) === lookupId) ?? arcData;
  }

  function onInteractiveSelect({ target, data: arcData }) {
    onSelect?.({ target, data: rawItem(arcData) });
  }

  function onInteractiveHover(payload) {
    if (!payload) {
      setHoveredId(null);
      onHover?.(null);
      return;
    }
    setHoveredId(payload.data?.categoryId ?? payload.data?.id ?? null);
    onHover?.({ target: payload.target, data: rawItem(payload.data) });
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
      {/* Interactive hit area — default mode only: full radius, proportional angles */}
      {!isTransposed && (
        <SegmentLayer
          data={processedData}
          mode="angle"
          angleValue={totalAngleValue}
          innerRadiusFn={(_, s) => s.range()[0]}
          outerRadiusFn={(_, s) => s.range()[1]}
          interactive
          order={0}
          fillColor={bgColor}
          hoverColor={hoverBgColor}
          showCursorPointer={showCursorPointer}
          padAngle={padAngle}
          padRadius={padRadius}
          strokeWidth={0}
          cornerRadius={cornerRadius}
          onSelect={onInteractiveSelect}
          onHover={onInteractiveHover}
        />
      )}
      <SegmentLayer
        data={processedData}
        series={series}
        mode="angle"
        innerRadiusFn={seriesRingInnerFn}
        outerRadiusFn={seriesRingOuterFn}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        fillOpacity={fillOpacity}
        cornerRadius={cornerRadius}
        padAngle={padAngle}
        padRadius={padRadius}
        order={2}
        layerId="segs"
        interactive={isTransposed}
        showCursorPointer={showCursorPointer}
        onSelect={onInteractiveSelect}
        onHover={onInteractiveHover}
      />
      <RadialLabelLayer
        data={labelData}
        mode="angle"
        angleValue={labelAngleValue}
        labelsOutside={labelsOutside}
        showLabels={showLabels}
        maxLabelWidth={maxLabelWidth}
        showValues={showValues}
        format={format}
        circularLabels={circularLabels}
        valueLabelColor={valueLabelColor}
        textColor={textColor}
        order={3}
      />
      {children}
    </RoseCanvas>
  );
});

export default DonutChart;
