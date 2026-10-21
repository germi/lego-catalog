import { createContext } from "react";

export const CanvasContext = createContext({
  draw:           null,
  zoom:           null,
  /**
   * Always-current d3 zoom transform — updated from BOTH onDraw and onZoom
   * paths so a layer that mounts mid-interaction can read the live transform
   * without poking at d3.zoomTransform(svgEl).  Mirrors Vue's `liveTransform`.
   */
  liveTransform:  null,
  controls:       null,
  layerContainer: null,
});
