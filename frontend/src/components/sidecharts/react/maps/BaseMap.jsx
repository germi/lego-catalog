import { useRef, forwardRef, useImperativeHandle } from "react";
import BaseCanvas from "../canvas/BaseCanvas.jsx";
import { RegionLayer } from "../layers/RegionLayer.jsx";

export const BaseMap = forwardRef(function BaseMap({
  // Canvas props
  adjustSize      = false,
  scale           = 0.95,
  projectionType  = "geoMercator",
  maxZoom         = 16,
  allowManualZoom = true,
  zoomScale       = 1,
  rotateMode      = false,
  northUp         = false,
  duration        = 750,
  // RegionLayer props
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
  superRegionStrokeWidth     = 2,
  selectedStrokeDasharray    = "none",
  highlighted                = null,
  highlightedStrokeWidth     = null,
  highlightedStrokeDasharray = "none",
  highlightOnlyWithData      = true,
  scope                      = "region",
  selectedSuperRegion        = null,
  fitBoundsToData            = false,
  extent                     = null,
  order                      = undefined,
  // Events
  onSelect,
  onHover,
  onSuperRegionClick,
  onDraw,
  onZoom,
  // Layout
  before,
  children,
  className,
  style,
}, ref) {
  const canvasRef      = useRef(null);
  const regionLayerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    resetZoom:                (...a) => canvasRef.current?.resetZoom(...a),
    zoomIn:                   (...a) => canvasRef.current?.zoomIn(...a),
    zoomOut:                  (...a) => canvasRef.current?.zoomOut(...a),
    zoomToFeature:            (...a) => regionLayerRef.current?.zoomToFeature(...a),
    zoomToBBox:               (...a) => regionLayerRef.current?.zoomToBBox(...a),
    zoomToFitBounds:          (...a) => regionLayerRef.current?.zoomToFitBounds(...a),
    zoomToFitData:            (...a) => regionLayerRef.current?.zoomToFitData(...a),
    zoomToSuperRegion:        (...a) => regionLayerRef.current?.zoomToSuperRegion(...a),
    zoomToCurrentSuperRegion: (...a) => regionLayerRef.current?.zoomToCurrentSuperRegion(...a),
    animateToProjection: () => {},
    get width()  { return canvasRef.current?.width; },
    get height() { return canvasRef.current?.height; },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BaseCanvas
      ref={canvasRef}
      adjustSize={adjustSize}
      scale={scale}
      projectionType={projectionType}
      maxZoom={maxZoom}
      allowManualZoom={allowManualZoom}
      zoomScale={zoomScale}
      rotateMode={rotateMode}
      northUp={northUp}
      duration={duration}
      onDraw={onDraw}
      onZoom={onZoom}
      className={className}
      style={style}
    >
      {before}
      <RegionLayer
        ref={regionLayerRef}
        topoData={topoData}
        topoObjectName={topoObjectName}
        removeFeatures={removeFeatures}
        removeFeaturesForBounds={removeFeaturesForBounds}
        superRegionMergeAccessor={superRegionMergeAccessor}
        featureAccessor={featureAccessor}
        data={data}
        dataAccessor={dataAccessor}
        color={color}
        highlightColor={highlightColor}
        noDataColor={noDataColor}
        strokeColor={strokeColor}
        strokeColorNoData={strokeColorNoData}
        showBorders={showBorders}
        borderColor={borderColor}
        showCompositionBorders={showCompositionBorders}
        compositionBorderColor={compositionBorderColor}
        strokeWidth={strokeWidth}
        superRegionStrokeWidth={superRegionStrokeWidth}
        selectedStrokeDasharray={selectedStrokeDasharray}
        highlighted={highlighted}
        highlightedStrokeWidth={highlightedStrokeWidth}
        highlightedStrokeDasharray={highlightedStrokeDasharray}
        highlightOnlyWithData={highlightOnlyWithData}
        duration={duration}
        scope={scope}
        selectedSuperRegion={selectedSuperRegion}
        fitBoundsToData={fitBoundsToData}
        extent={extent}
        order={order}
        onSelect={onSelect}
        onHover={onHover}
        onSuperRegionClick={onSuperRegionClick}
      />
      {children}
    </BaseCanvas>
  );
});

export default BaseMap;
