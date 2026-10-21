import * as d3 from "d3";
import { makeTween, makeTextPositionTween, zeroedData } from "../utils/animation/roseTween";
import { computeEnterPhasing, survivingValuesChanged } from "../utils/animation/phaseTiming";
import { createLayer } from "./layer.js";

export const RADIAL_LABEL_LAYER_DEFAULTS = {
  data:               null,
  max:                null,
  scaleType:          null,
  labelKey:           "name",
  labelsOutside:      true,
  circularLabels:     false,
  lineLabelDistance:  20,
  paddingLineLabel:   40,
  radiusFn:           null,
  outerRadiusFn:      null,
  showLabels:         true,
  maxLabelWidth:      150,
  showValues:         true,
  valueKey:           "value",
  valueSeries:        null,
  format:             (d) => (+d).toFixed(0) + "%",
  minAngle:           0.3,
  textColor:          "#6b7280",
  valueLabelColor:    "#6b7280",
  fontSize:           "11px",
  valueFontSize:      "11px",
  // null = no explicit weight (CSS default). A highlighted item's label is always
  // forced bold regardless of this, taking priority over any configured weight.
  fontWeight:         null,
  valueFontWeight:    null,
  mode:               "radius",
  angleValue:         (d) => d.value,
  order:              undefined,
};

export function createRadialLabelLayer() {
  const base         = createLayer({ className: "radial-label-layer" });
  const uid          = Math.random().toString(36).slice(2, 8);
  const pathIdPrefix = `label-path-${uid}`;

  let linesContainer     = null;
  let labelArcsContainer = null;
  let textsContainer     = null;
  let previousIds        = new Set();
  let previousData       = [];
  let previousLocalMax   = null;
  let lastProps          = null;

  function ensureGroups(props) {
    const rc = props.roseControls;
    if (!rc?.svgGroup || !rc?.svgEl) return false;
    if (textsContainer) return true;

    const g = base.ensureGroup({ svgEl: rc.svgEl }, rc.svgGroup.node());

    if (!props.circularLabels) {
      linesContainer = g.append("g").attr("class", "lines").attr("opacity", 1);
    }
    if (props.circularLabels) {
      labelArcsContainer = g
        .append("g")
        .attr("class", "label-arcs")
        .attr("font-family", "inherit")
        .attr("opacity", 0);
    }
    textsContainer = g
      .append("g")
      .attr("class", "labels fill-current")
      .attr("font-family", "inherit");

    return true;
  }

  // The value shown in the .value tspan (below the label) when showValues is on.
  // Multi-series data has no flat `.value` — pick a series from `datum.values`
  // (props.valueSeries, or the first series key if unset). Flat/legacy data
  // (no `.values` object) falls back to the plain valueKey lookup.
  function resolveDisplayValue(datum, props) {
    if (datum?.values && typeof datum.values === "object") {
      const key = props.valueSeries ?? Object.keys(datum.values)[0];
      return datum.values?.[key]?.value;
    }
    return datum?.[props.valueKey];
  }

  function computeLocalMax(props) {
    if (props.max !== null) return props.max;
    if (!props.data?.length) return 100;
    return d3.max(props.data, (d) => Math.max(d.value ?? 0, d.min ?? 0, d.max ?? 0)) || 100;
  }

  function buildLocalScale(props) {
    const rc        = props.roseControls;
    const localMax  = computeLocalMax(props);
    const innerR    = rc.innerRadius * rc.radius;
    const scaleType = props.scaleType ?? rc.scaleType;
    const factory   = scaleType === "linear" ? d3.scaleLinear : d3.scaleSqrt;
    return factory().domain([0, localMax]).range([innerR, rc.radius]);
  }

  function buildArcs(localMax, props) {
    if (!props.data) return [];
    const rc    = props.roseControls;
    const valueFn = props.mode === "angle" ? (d) => props.angleValue(d) : localMax;
    return d3
      .pie()
      .startAngle((rc.startAngle * Math.PI) / 180)
      .endAngle((rc.endAngle * Math.PI) / 180)
      .value(valueFn)
      .sort(null)(props.data);
  }

  function wrap(textSelection, maxWidth = 180) {
    textSelection.each(function () {
      const text  = d3.select(this);
      const words = text.text().split(/\s+/).reverse();
      let word, line = [], lineNumber = 0;
      const lineHeight = 1.1;
      const yAttr = text.attr("y");
      const dy    = parseFloat(text.attr("dy")) || 0;
      let tspan   = text.text(null).append("tspan")
        .attr("x", 0).attr("y", yAttr).attr("dy", dy + "em");
      while ((word = words.pop())) {
        line.push(word);
        tspan.text(line.join(" "));
        if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
          line.pop();
          tspan.text(line.join(" "));
          line  = [word];
          tspan = text.append("tspan")
            .attr("x", 0).attr("y", yAttr)
            .attr("dy", ++lineNumber * lineHeight + dy + "em")
            .text(word);
        }
      }
    });
  }

  function createLabelArcs(y, localMax, props) {
    const rc     = props.roseControls;
    const outerFn = props.radiusFn || props.outerRadiusFn || ((d, scale) => scale(d.value));
    const labelR  = rc.radius + rc.margin + 16;
    const labelRefArc = d3.arc().innerRadius(labelR).outerRadius(labelR);

    const getLabelArc = (padding = props.paddingLineLabel) => {
      const r = (d) => {
        const outerRadius = props.labelsOutside ? y(localMax) : outerFn(d.data, y);
        return outerRadius + padding;
      };
      return d3.arc().innerRadius(r).outerRadius(r);
    };

    return { labelRefArc, getLabelArc };
  }

  function drawLabelArcs(labelRefArc, arcs, phase1Dur, enterDelay, props) {
    if (!labelArcsContainer) return;
    const rc      = props.roseControls;
    const dur     = rc.duration;
    const isAngle = props.mode === "angle";
    const eDel    = enterDelay ?? (phase1Dur + dur);
    const labelArcTween = makeTween(labelRefArc);

    labelArcsContainer
      .selectAll("path")
      .data(arcs, (d) => d.data.id)
      .join(
        (enter) =>
          enter
            .append("path")
            .attr("fill", null)
            .attr("id", (d) => `${pathIdPrefix}-${d.data.id}`)
            .each(function (d) {
              this._current = isAngle
                ? { ...d, endAngle: d.startAngle }
                : { ...d, data: zeroedData(d.data) };
            })
            .attr("d", (d) =>
              isAngle
                ? labelRefArc({ ...d, endAngle: d.startAngle })
                : labelRefArc(d),
            )
            .call((path) =>
              path.transition().delay(eDel).duration(dur).attrTween("d", labelArcTween),
            ),
        (update) =>
          update.call((path) =>
            path.transition().delay(isAngle ? 0 : phase1Dur).duration(dur).attrTween("d", labelArcTween),
          ),
        (exit) =>
          exit.call((path) =>
            path
              .each((d) => (d.endAngle = d.startAngle))
              .transition().duration(dur).attrTween("d", labelArcTween)
              .remove(),
          ),
      );
  }

  function drawLines(getLabelArc, arcs, phase1Dur, enterDelay, props) {
    if (!linesContainer) return;
    const dur      = props.roseControls.duration;
    const distance = props.lineLabelDistance;
    const isAngle  = props.mode === "angle";
    const eDel     = enterDelay ?? (phase1Dur + dur);

    linesContainer
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1)
      .selectAll("line")
      .data(arcs, (d) => d.data.id)
      .join(
        (enter) =>
          enter
            .append("line")
            .attr("x1", (d) => isAngle ? getLabelArc(0).centroid({ ...d, endAngle: d.startAngle })[0] : 0)
            .attr("y1", (d) => isAngle ? getLabelArc(0).centroid({ ...d, endAngle: d.startAngle })[1] : 0)
            .attr("x2", (d) => isAngle ? getLabelArc(distance).centroid({ ...d, endAngle: d.startAngle })[0] : 0)
            .attr("y2", (d) => isAngle ? getLabelArc(distance).centroid({ ...d, endAngle: d.startAngle })[1] : 0)
            .attr("opacity", 0)
            .call((line) =>
              line.transition().delay(eDel).duration(dur)
                .attr("x1", (d) => getLabelArc(0).centroid(d)[0])
                .attr("y1", (d) => getLabelArc(0).centroid(d)[1])
                .attr("x2", (d) => getLabelArc(distance).centroid(d)[0])
                .attr("y2", (d) => getLabelArc(distance).centroid(d)[1])
                .attr("opacity", 1),
            ),
        (update) =>
          update.call((line) =>
            line.transition().delay(phase1Dur).duration(dur)
              .attr("x1", (d) => getLabelArc(0).centroid(d)[0])
              .attr("y1", (d) => getLabelArc(0).centroid(d)[1])
              .attr("x2", (d) => getLabelArc(distance).centroid(d)[0])
              .attr("y2", (d) => getLabelArc(distance).centroid(d)[1]),
          ),
        (exit) =>
          exit.each(function (d) {
            const el  = d3.select(this);
            el.interrupt();
            const cur = parseFloat(el.attr("opacity") ?? "1");
            if (cur <= 0) { el.remove(); return; }
            const dur2 = Math.round(dur * cur);
            if (isAngle) {
              const collapsed = { ...d, endAngle: d.startAngle };
              el.transition().duration(dur2)
                .attr("x1", getLabelArc(0).centroid(collapsed)[0])
                .attr("y1", getLabelArc(0).centroid(collapsed)[1])
                .attr("x2", getLabelArc(distance).centroid(collapsed)[0])
                .attr("y2", getLabelArc(distance).centroid(collapsed)[1])
                .attr("opacity", 0).remove();
            } else {
              el.transition().duration(dur2)
                .attr("x2", 0).attr("y2", 0).attr("opacity", 0).remove();
            }
          }),
      );
  }

  function drawLabels(getLabelArc, y, arcs, phase1Dur, enterDelay, props) {
    const rc        = props.roseControls;
    const dur       = rc.duration;
    const eDel      = enterDelay ?? (phase1Dur + dur);
    const outerFn   = props.radiusFn || props.outerRadiusFn || ((d, scale) => scale(d.value));

    const insideArc = d3.arc().innerRadius(() => 0).outerRadius((d) => outerFn(d.data, y));

    const labelOffset       = 12;
    const hasExplicitRadius = !!props.radiusFn;
    const centroidFn = (d) => {
      if (props.labelsOutside) return getLabelArc().centroid(d);
      if (hasExplicitRadius) {
        const midAngle = (d.startAngle + d.endAngle) / 2;
        const r = outerFn(d.data, y) + labelOffset;
        return [r * Math.sin(midAngle), -r * Math.cos(midAngle)];
      }
      return insideArc.centroid(d);
    };

    const textPositionTween = makeTextPositionTween(centroidFn);
    const displayLabel = (d) => d.endAngle - d.startAngle > props.minAngle;
    const { labelKey } = props;

    textsContainer
      .raise()
      .selectAll("text")
      .data(arcs, (d) => d.data.id)
      .join(
        (enter) => {
          if (props.circularLabels) {
            return enter
              .append("text")
              .append("textPath")
              .attr("xlink:href", (d) => `#${pathIdPrefix}-${d.data.id}`)
              .attr("text-anchor", "middle")
              .attr("startOffset", (d) => {
                const tolerance = Math.PI / 36;
                return Math.PI / 2 - tolerance <= d.startAngle &&
                  d.startAngle < (Math.PI * 3) / 2 - tolerance
                  ? "75%"
                  : "25%";
              })
              .attr("dy", 4)
              .attr("fill", (d) => d.data.textColor || props.textColor)
              .attr("opacity", 0)
              .each(function (d) {
                this._current = props.mode === "angle"
                  ? { ...d, endAngle: d.startAngle }
                  : { ...d, data: zeroedData(d.data) };
              })
              .call((text) =>
                text
                  .append("tspan")
                  .attr("class", "rose-label")
                  .text((d) => d.data[labelKey])
                  .style("display", props.showLabels ? null : "none")
                  .attr("dy", 4)
                  .attr("font-size", (d) => d.data.fontSize || props.fontSize)
                  .attr("font-weight", (d) =>
                    d.data.id === rc.highlighted ? "bold" : (d.data.fontWeight || props.fontWeight),
                  ),
              )
              .call((text) =>
                text.transition().delay(eDel).duration(dur)
                  .attr("opacity", 1)
                  .attrTween("transform", textPositionTween),
              );
          }

          return enter
            .append("text")
            .attr("class", "group")
            .attr("alignment-baseline", "central")
            .attr("cursor", "pointer")
            .attr("text-anchor", (d) =>
              props.labelsOutside
                ? getLabelArc().centroid(d)[0] > 0 ? "start" : "end"
                : "middle",
            )
            .attr("transform", (d) => `translate(${centroidFn(d)})`)
            .attr("fill", (d) => d.data.textColor || props.textColor)
            .attr("opacity", 0)
            .attr("font-weight", (d) =>
              d.data.id === rc.highlighted ? "bold" : (d.data.fontWeight || props.fontWeight),
            )
            .each(function (d) {
              this._current = props.mode === "angle"
                ? { ...d, endAngle: d.startAngle }
                : { ...d, data: zeroedData(d.data) };
            })
            .call((text) =>
              text
                .append("tspan")
                .attr("class", "rose-label")
                .attr("y", props.showValues ? "-0.4em" : null)
                .text((d) => d.data[labelKey])
                .style("display", props.showLabels ? null : "none")
                .attr("font-size", (d) => d.data.fontSize || props.fontSize),
            )
            .call((text) => wrap(text.selectAll("tspan.rose-label"), props.maxLabelWidth))
            .call((text) => {
              if (props.showValues) {
                text
                  .append("tspan")
                  .attr("class", "value")
                  .attr("x", 0).attr("dy", "1.1em")
                  .attr("fill", (d) => d.data.valueColor || props.valueLabelColor)
                  .attr("font-size", (d) => d.data.valueFontSize || props.valueFontSize)
                  .attr("font-weight", (d) => d.data.valueFontWeight || props.valueFontWeight)
                  .text(props.format(0))
                  .transition().delay(eDel).duration(dur)
                  .text((d) => props.format(resolveDisplayValue(d.data, props)))
                  .style("display", null);
              }
            })
            .call((text) =>
              text.transition().delay(eDel).duration(dur)
                .attrTween("transform", textPositionTween)
                .attr("opacity", (d) => (displayLabel(d) ? 1 : 0)),
            );
        },
        (update) =>
          update.call((text) => {
            if (props.circularLabels) {
              return text
                .transition().duration(rc.duration)
                .call((t) =>
                  t.select(".rose-label")
                    .text((d) => d.data[labelKey])
                    .attr("fill", (d) => d.data.textColor || props.textColor)
                    .attr("font-size", (d) => d.data.fontSize || props.fontSize)
                    .attr("font-weight", (d) =>
                      d.data.id === rc.highlighted ? "bold" : (d.data.fontWeight || props.fontWeight),
                    ),
                )
                .call((t) => t.select(".value").text((d) => props.format(resolveDisplayValue(d.data, props))));
            }
            text.select("tspan.rose-label")
              .text((d) => d.data[labelKey])
              .attr("font-size", (d) => d.data.fontSize || props.fontSize)
              .style("display", props.showLabels ? null : "none");
            wrap(text.selectAll("tspan.rose-label"), props.maxLabelWidth);
            text.attr("fill", (d) => d.data.textColor || props.textColor);
            // If an element entered while showValues was false it has no .value
            // tspan. Create it now so the transition below can populate it.
            if (props.showValues) {
              text.filter(function() { return d3.select(this).select(".value").empty(); })
                .append("tspan")
                .attr("class", "value")
                .attr("x", 0).attr("dy", "1.1em")
                .attr("fill", (d) => d.data.valueColor || props.valueLabelColor)
                .attr("font-size", (d) => d.data.valueFontSize || props.valueFontSize)
                .attr("font-weight", (d) => d.data.valueFontWeight || props.valueFontWeight)
                .text((d) => props.format(resolveDisplayValue(d.data, props)));
            }
            return text
              .transition().delay(phase1Dur).duration(dur)
              .attrTween("transform", textPositionTween)
              .attr("opacity", (d) => (displayLabel(d) ? 1 : 0))
              .attr("font-weight", (d) =>
                d.data.id === rc.highlighted ? "bold" : (d.data.fontWeight || props.fontWeight),
              )
              .attr("text-anchor", (d) =>
                props.labelsOutside
                  ? getLabelArc().centroid(d)[0] > 0 ? "start" : "end"
                  : "middle",
              )
              .call((t) =>
                t.select(".value")
                  .text((d) => props.format(resolveDisplayValue(d.data, props)))
                  .attr("fill", (d) => d.data.valueColor || props.valueLabelColor)
                  .attr("font-size", (d) => d.data.valueFontSize || props.valueFontSize)
                  .attr("font-weight", (d) => d.data.valueFontWeight || props.valueFontWeight),
              );
          }),
        (exit) =>
          exit.each(function (d) {
            const el  = d3.select(this);
            el.interrupt();
            const cur = parseFloat(el.attr("opacity") ?? "1");
            if (cur <= 0) { el.remove(); return; }
            const duration = Math.round(dur * cur);
            if (props.mode === "angle" && !props.circularLabels) {
              const target = { ...d, endAngle: d.startAngle };
              const interp = d3.interpolate(d, target);
              el.transition().duration(duration)
                .attrTween("transform", () => (t) => `translate(${centroidFn(interp(t))})`)
                .attr("opacity", 0).remove();
            } else {
              el.transition().duration(duration).attr("opacity", 0).remove();
            }
          }),
      );

    if (!props.labelsOutside) textsContainer.attr("transform", "translate(0,10)");
  }

  function render(payload, props) {
    if (!ensureGroups(props) || !props.data) return;
    lastProps = props;
    base.setOrder(props.order);

    const localMax = computeLocalMax(props);
    const y        = buildLocalScale(props);
    const arcs     = buildArcs(localMax, props);
    const { labelRefArc, getLabelArc } = createLabelArcs(y, localMax, props);

    const rc         = props.roseControls;
    const dur        = rc.duration;
    const currentIds = new Set(arcs.map((a) => a.data.id));
    const hasExits   = [...previousIds].some((id) => !currentIds.has(id));
    const hasEnters  = [...currentIds].some((id) => !previousIds.has(id));
    const isFirstDraw = previousIds.size === 0;
    const isAngle    = props.mode === "angle";

    // Angle (donut) mode: data-item changes don't need phasing.
    // Radius (rose) mode: route through the same computeEnterPhasing helper as
    // SegmentLayer so labels and arcs stay in lockstep — identical guards:
    //   hasSurvivors  → needsSlide gates phase-2 (slide wait)
    //   structuralChange masks hasExits/hasEnters so series-level changes without
    //   category change don't fire a phase-1 (radialLabelLayer uses category IDs
    //   so this is already true, but the explicit mask keeps intent clear)
    const hasSurvivors  = arcs.some((a) => previousIds.has(a.data.id));
    const structChange  = !isFirstDraw && (hasExits || hasEnters);
    const needsPhasing  = !isAngle && structChange;
    const needsSlide    = hasSurvivors && needsPhasing;
    const valuesChanged =
      localMax !== previousLocalMax || survivingValuesChanged(previousData, props.data);
    const { phase1Dur, enterDelay } = needsPhasing
      ? computeEnterPhasing({
          duration:      dur,
          hasExits,
          hasEnters,
          waitForPhase2: needsSlide,
          phase1OnSlide: true,
          valuesChanged,
        })
      : { phase1Dur: 0, enterDelay: 0 };
    previousIds = currentIds;
    previousData = props.data;
    previousLocalMax = localMax;

    drawLabelArcs(labelRefArc, arcs, phase1Dur, enterDelay, props);
    drawLines(getLabelArc, arcs, phase1Dur, enterDelay, props);
    drawLabels(getLabelArc, y, arcs, phase1Dur, enterDelay, props);
  }

  function destroy() {
    if (!base.group) return;
    const duration = lastProps?.roseControls?.duration ?? 300;
    const g = base.group;
    base.detach();
    g.transition().duration(duration).attr("opacity", 0).remove();
    textsContainer     = null;
    linesContainer     = null;
    labelArcsContainer = null;
  }

  return {
    render(payload, props) { render(payload, props); },
    rerender(props) { if (lastProps) render(null, props); },
    setOrder: (order) => base.setOrder(order),
    destroy,
  };
}
