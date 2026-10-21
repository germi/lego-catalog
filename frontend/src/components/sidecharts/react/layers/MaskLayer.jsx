import { useContext, useRef, useEffect, useState, useMemo } from "react";
import { CanvasContext } from "../context.js";
import { ChartContext }  from "../ChartContext.js";
import {
  createCartesianMaskLayer,
  CARTESIAN_MASK_DEFAULTS as D,
} from "../../core/cartesianMaskLayer.js";

/**
 * MaskLayer — clips its children to a `<clipPath><rect/></clipPath>`. Matches
 * `vue/layers/MaskLayer.vue`.
 *
 * Modes:
 *   • reveal window — `revealStart` / `revealEnd` (data-space x) animate a
 *     horizontal window; vertically the clip covers the full chart height.
 *   • box (`clipToPlot`) — also clips top/bottom to the plot area, so slotted
 *     layers can't spill into the axis / margin / padding zones.
 *
 * Children render into the mask's clipped `<g>`: we expose it as `layerContainer`
 * on a nested CanvasContext, and every layer prefers `layerContainer` over the
 * canvas innerEl (see core/layer.js `resolveParent`).
 */
export function MaskLayer({
  revealStart    = D.revealStart,
  revealEnd      = D.revealEnd,
  revealDuration = D.revealDuration,
  revealEase     = D.revealEase,
  margin         = null,
  padding        = null,
  clipToPlot     = D.clipToPlot,
  order,
  children,
}) {
  const canvasCtx = useContext(CanvasContext);
  const { draw, zoom, liveTransform, layerContainer: outerLayerContainer } = canvasCtx;
  const { chartContext } = useContext(ChartContext);

  const coreRef = useRef(null);
  if (!coreRef.current) coreRef.current = createCartesianMaskLayer();
  const core = coreRef.current;

  // The mask's clipped <g>, handed to children via context. State (not a ref) so
  // that once the core creates it, a re-render re-provides it to descendants.
  const [containerNode, setContainerNode] = useState(null);

  const props = () => ({
    revealStart, revealEnd, revealDuration, revealEase, clipToPlot,
    margin:  margin  ?? chartContext?.margin  ?? null,
    padding: padding ?? chartContext?.padding ?? null,
    outerLayerContainer,
  });

  useEffect(() => () => core.destroy(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw signal — render with first-frame zoom catch-up (mirrors Vue / AreaLayer).
  const zoomCaughtUpRef = useRef(false);
  useEffect(() => {
    if (!draw?.svgEl) return;
    let effective = draw;
    if (!zoomCaughtUpRef.current) {
      zoomCaughtUpRef.current = true;
      const live = liveTransform;
      const pt   = draw.zoomTransform;
      const alreadyCorrect = pt && live && pt.k === live.k && pt.x === live.x && pt.y === live.y;
      if (live && !alreadyCorrect && (live.k !== 1 || live.x !== 0 || live.y !== 0)) {
        effective = { ...draw, zoomTransform: live, xScale: undefined, yScale: undefined };
      }
    }
    core.render(effective, props());
    setContainerNode(core.getContainerNode());
  }, [draw]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (zoom) core.onZoom(zoom); }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Explicit reveal-window / box change — animate at revealDuration (independent
  // of any zoom tempo, which core.render() handles via the draw signal).
  useEffect(() => {
    if (draw?.svgEl) core.updateReveal(props());
  }, [revealStart, revealEnd, revealDuration, revealEase, margin, padding, clipToPlot]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { core.setOrder(order); }, [order]); // eslint-disable-line react-hooks/exhaustive-deps

  // Provide our clipped <g> as `layerContainer` for descendant layers.
  const childCtx = useMemo(
    () => ({ ...canvasCtx, layerContainer: containerNode }),
    [canvasCtx, containerNode],
  );

  return (
    <CanvasContext.Provider value={childCtx}>
      {children}
    </CanvasContext.Provider>
  );
}

export default MaskLayer;
