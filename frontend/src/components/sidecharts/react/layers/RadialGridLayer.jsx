import { useContext, useRef, useEffect } from "react";
import { CanvasContext } from "../context.js";
import { RoseContext } from "../RoseContext.js";
import { createRadialGridLayer, RADIAL_GRID_LAYER_DEFAULTS } from "../../core/radialGridLayer.js";

export function RadialGridLayer({
  max                  = RADIAL_GRID_LAYER_DEFAULTS.max,
  scaleType            = RADIAL_GRID_LAYER_DEFAULTS.scaleType,
  gridColor            = RADIAL_GRID_LAYER_DEFAULTS.gridColor,
  gridStrokeDasharray  = RADIAL_GRID_LAYER_DEFAULTS.gridStrokeDasharray,
  tickColor            = RADIAL_GRID_LAYER_DEFAULTS.tickColor,
  tickCount            = RADIAL_GRID_LAYER_DEFAULTS.tickCount,
  order                = RADIAL_GRID_LAYER_DEFAULTS.order,
}) {
  const { draw } = useContext(CanvasContext);
  const { roseControls } = useContext(RoseContext);

  const coreRef = useRef(null);
  if (!coreRef.current) coreRef.current = createRadialGridLayer();
  const core = coreRef.current;

  const props = () => ({
    max, scaleType, gridColor, gridStrokeDasharray, tickColor, tickCount, order,
    roseControls,
  });

  useEffect(() => () => core.destroy(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (draw) core.render(draw, props());
  }, [draw]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    core.rerender(props());
  }, [max, scaleType]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default RadialGridLayer;
