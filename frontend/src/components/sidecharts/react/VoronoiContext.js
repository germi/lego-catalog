import { createContext } from "react";

/**
 * Context provided by `<VoronoiLayer>` for its child voronoi layers
 * (VoronoiHoverLayer / VoronoiLabelLayer / VoronoiMarkerLayer) — mirrors
 * Vue's `voronoiDraw` / `voronoiHover` / `voronoiOrder` provides.
 *
 *   voronoiDraw    : the computed voronoi state (cells, centroids, …) or null
 *   voronoiHover   : the currently-hovered cell, or null
 *   setVoronoiHover: setter called by VoronoiHoverLayer when the hover changes
 *   voronoiOrder   : the parent's `order` prop, cascaded to children
 *   voronoiZoomMode: `recomputeOnZoom` cascaded (literal vs static positioning)
 *   voronoiGestureBus: stable imperative bus broadcasting the live zoom delta
 *                      ({ d, k } / null) during a "settle" drag; children
 *                      subscribe their applyGestureTransform
 */
export const VoronoiContext = createContext({
  voronoiDraw:       null,
  voronoiHover:      null,
  setVoronoiHover:   () => {},
  voronoiOrder:      undefined,
  voronoiZoomMode:   false,
  voronoiGestureBus: null,
});
