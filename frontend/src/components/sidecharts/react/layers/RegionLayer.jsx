import { useContext, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { CanvasContext } from "../context.js";
import { createRegionLayer } from "../../core/regionLayer.js";

export const RegionLayer = forwardRef(function RegionLayer({
  topoData                   = null,
  topoObjectName             = null,
  removeFeatures             = [],
  removeFeaturesForBounds    = [],
  superRegionMergeAccessor   = null,
  featureAccessor            = (d) => d.id,
  data                       = {},
  dataAccessor               = (d) => d?.value,
  color                      = { min: "#DBEAFE", max: "#1E3A8A" },
  highlightColor             = "black",
  noDataColor                = "#DDDEDD",
  strokeColor                = "#fff",
  strokeColorNoData          = "#fff",
  showBorders                = false,
  borderColor                = "white",
  showCompositionBorders     = true,
  compositionBorderColor     = "#666",
  strokeWidth                = 1,
  strokeDasharray            = "none",
  superRegionStrokeWidth     = 2,
  selectedStrokeDasharray    = "none",
  highlighted                = null,
  highlightedStrokeWidth     = null,
  highlightedStrokeDasharray = "none",
  highlightOnlyWithData      = true,
  duration                   = 750,
  scope                      = "region",
  selectedSuperRegion        = null,
  fitBoundsToData            = false,
  extent                     = null,
  registerBounds             = true,
  order                      = undefined,
  onSelect,
  onHover,
  onSuperRegionClick,
}, ref) {
  const { draw, zoom, controls, layerContainer } = useContext(CanvasContext);

  const onSelectRef           = useRef(onSelect);
  const onHoverRef            = useRef(onHover);
  const onSuperRegionClickRef = useRef(onSuperRegionClick);
  onSelectRef.current           = onSelect;
  onHoverRef.current            = onHover;
  onSuperRegionClickRef.current = onSuperRegionClick;

  const coreRef = useRef(null);
  if (!coreRef.current) {
    coreRef.current = createRegionLayer({
      onSelect:           (e)  => onSelectRef.current?.(e),
      onHover:            (e)  => onHoverRef.current?.(e),
      onSuperRegionClick: (id) => onSuperRegionClickRef.current?.(id),
    });
  }
  const core = coreRef.current;

  const getProps = () => ({
    topoData, topoObjectName, removeFeatures, removeFeaturesForBounds,
    superRegionMergeAccessor, featureAccessor, data, dataAccessor,
    color, highlightColor, noDataColor, strokeColor, strokeColorNoData,
    showBorders, borderColor, showCompositionBorders, compositionBorderColor,
    strokeWidth, strokeDasharray, superRegionStrokeWidth, selectedStrokeDasharray,
    highlighted, highlightedStrokeWidth, highlightedStrokeDasharray,
    highlightOnlyWithData, duration, scope, selectedSuperRegion,
    fitBoundsToData, extent, registerBounds, order,
    controls, layerContainer,
  });

  useImperativeHandle(ref, () => ({
    zoomToFeature:            (f, d) => core.zoomToFeature(f, d),
    zoomToBBox:               (b, d) => core.zoomToBBox(b, d),
    zoomToFitBounds:          (d)    => core.zoomToFitBounds(d),
    zoomToFitData:            (d)    => core.zoomToFitData(d),
    zoomToSuperRegion:        (id, d) => core.zoomToSuperRegion(id, d),
    zoomToCurrentSuperRegion: (d)    => core.zoomToCurrentSuperRegion(d),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => core.destroy(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (draw) core.render(draw, getProps());
  }, [draw]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (zoom) core.onZoom(zoom);
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register bounds with canvas whenever bounds-relevant features change
  useEffect(() => {
    core.fitBoundsIfNeeded(getProps());
  }, [topoData, topoObjectName, removeFeatures, removeFeaturesForBounds, featureAccessor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Data fill updates (color only, no DOM restructuring)
  useEffect(() => {
    core.updateData(getProps());
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Geometry changes — full redraw
  useEffect(() => {
    core.rerender(getProps());
  }, [topoData, topoObjectName, removeFeatures, superRegionMergeAccessor, featureAccessor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    core.updateHighlight(getProps());
  }, [highlighted, strokeDasharray]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    core.updateSuperRegion(getProps());
  }, [selectedSuperRegion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    core.updateScope(getProps());
  }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    core.updateFitBoundsToData(getProps());
  }, [fitBoundsToData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    core.updateBorders(getProps());
  }, [showBorders, borderColor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    core.updateCompositionBorders(getProps());
  }, [showCompositionBorders, compositionBorderColor]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
});

export default RegionLayer;
