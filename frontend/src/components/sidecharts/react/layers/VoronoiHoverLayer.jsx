import { useContext, useEffect, useRef } from "react";
import { CanvasContext } from "../context.js";
import { VoronoiContext } from "../VoronoiContext.js";
import {
  createVoronoiHoverLayer,
  VORONOI_HOVER_LAYER_DEFAULTS as D,
} from "../../core/voronoiHoverLayer.js";

/**
 * VoronoiHoverLayer — transparent voronoi cells used for hover / click.
 * Must be a child of `<VoronoiLayer>` (reads the shared voronoi state).
 */
export function VoronoiHoverLayer({
  ghostRadius = D.ghostRadius,
  visible     = true,
  order,
  onHover,
  onClick,
}) {
  const { draw, zoom } = useContext(CanvasContext);
  const { voronoiDraw, setVoronoiHover, voronoiOrder, voronoiZoomMode, voronoiGestureBus } = useContext(VoronoiContext);

  const onHoverRef = useRef(onHover);
  const onClickRef = useRef(onClick);
  onHoverRef.current = onHover;
  onClickRef.current = onClick;

  const coreRef = useRef(null);
  if (!coreRef.current) {
    coreRef.current = createVoronoiHoverLayer({
      onHover:              (e)    => onHoverRef.current?.(e),
      onClick:              (d)    => onClickRef.current?.(d),
      onVoronoiHoverChange: (cell) => setVoronoiHover(cell),
    });
  }
  const core = coreRef.current;

  const props = () => ({ ghostRadius, visible, order, recomputeOnZoom: voronoiZoomMode ?? false });

  // Effective order: own prop > parent's cascaded order
  const effectiveOrder = order ?? voronoiOrder;

  useEffect(() => {
    if (draw) core.render(draw, props(), voronoiDraw);
  }, [draw]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (zoom) core.onZoom(zoom); }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live-gesture delta (settle mode): ride the transform instead of recomputing.
  useEffect(() => {
    if (!voronoiGestureBus) return;
    return voronoiGestureBus.subscribe((g) => core.applyGestureTransform?.(g));
  }, [voronoiGestureBus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { core.rerender(props(), voronoiDraw); }, [voronoiDraw]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { core.rerender(props(), voronoiDraw); }, [ghostRadius]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { core.setVisible(visible); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { core.setOrder(effectiveOrder); }, [effectiveOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => core.destroy(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default VoronoiHoverLayer;
