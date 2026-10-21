import { useContext, useRef, useEffect } from "react";
import { CanvasContext } from "../context.js";
import { RoseContext } from "../RoseContext.js";
import { createRadialLabelLayer, RADIAL_LABEL_LAYER_DEFAULTS } from "../../core/radialLabelLayer.js";

export function RadialLabelLayer({
  data              = RADIAL_LABEL_LAYER_DEFAULTS.data,
  max               = RADIAL_LABEL_LAYER_DEFAULTS.max,
  scaleType         = RADIAL_LABEL_LAYER_DEFAULTS.scaleType,
  labelKey          = RADIAL_LABEL_LAYER_DEFAULTS.labelKey,
  labelsOutside     = RADIAL_LABEL_LAYER_DEFAULTS.labelsOutside,
  circularLabels    = RADIAL_LABEL_LAYER_DEFAULTS.circularLabels,
  lineLabelDistance = RADIAL_LABEL_LAYER_DEFAULTS.lineLabelDistance,
  paddingLineLabel  = RADIAL_LABEL_LAYER_DEFAULTS.paddingLineLabel,
  radiusFn          = RADIAL_LABEL_LAYER_DEFAULTS.radiusFn,
  outerRadiusFn     = RADIAL_LABEL_LAYER_DEFAULTS.outerRadiusFn,
  showLabels        = RADIAL_LABEL_LAYER_DEFAULTS.showLabels,
  maxLabelWidth     = RADIAL_LABEL_LAYER_DEFAULTS.maxLabelWidth,
  showValues        = RADIAL_LABEL_LAYER_DEFAULTS.showValues,
  valueKey          = RADIAL_LABEL_LAYER_DEFAULTS.valueKey,
  format            = RADIAL_LABEL_LAYER_DEFAULTS.format,
  minAngle          = RADIAL_LABEL_LAYER_DEFAULTS.minAngle,
  textColor         = RADIAL_LABEL_LAYER_DEFAULTS.textColor,
  valueLabelColor   = RADIAL_LABEL_LAYER_DEFAULTS.valueLabelColor,
  fontSize          = RADIAL_LABEL_LAYER_DEFAULTS.fontSize,
  valueFontSize     = RADIAL_LABEL_LAYER_DEFAULTS.valueFontSize,
  mode              = RADIAL_LABEL_LAYER_DEFAULTS.mode,
  angleValue        = RADIAL_LABEL_LAYER_DEFAULTS.angleValue,
  order             = RADIAL_LABEL_LAYER_DEFAULTS.order,
}) {
  const { draw } = useContext(CanvasContext);
  const { roseControls } = useContext(RoseContext);

  const coreRef = useRef(null);
  if (!coreRef.current) coreRef.current = createRadialLabelLayer();
  const core = coreRef.current;

  const props = () => ({
    data, max, scaleType, labelKey, labelsOutside, circularLabels,
    lineLabelDistance, paddingLineLabel, radiusFn, outerRadiusFn, showLabels,
    maxLabelWidth, showValues, valueKey, format, minAngle, textColor,
    valueLabelColor, fontSize, valueFontSize, mode, angleValue, order,
    roseControls,
  });

  useEffect(() => () => core.destroy(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (draw) core.render(draw, props());
  }, [draw]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    core.rerender(props());
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default RadialLabelLayer;
