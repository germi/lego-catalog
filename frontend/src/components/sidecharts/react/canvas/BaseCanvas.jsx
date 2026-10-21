import { useRef, useState, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { CanvasContext } from "../context.js";
import { createBaseCanvas, BASE_CANVAS_DEFAULTS } from "../../core/baseCanvas.js";

export const BaseCanvas = forwardRef(function BaseCanvas({
  children,
  adjustSize      = BASE_CANVAS_DEFAULTS.adjustSize,
  scale           = BASE_CANVAS_DEFAULTS.scale,
  projectionType  = BASE_CANVAS_DEFAULTS.projectionType,
  maxZoom         = BASE_CANVAS_DEFAULTS.maxZoom,
  allowManualZoom = BASE_CANVAS_DEFAULTS.allowManualZoom,
  zoomScale       = BASE_CANVAS_DEFAULTS.zoomScale,
  rotateMode      = BASE_CANVAS_DEFAULTS.rotateMode,
  northUp         = BASE_CANVAS_DEFAULTS.northUp,
  duration        = BASE_CANVAS_DEFAULTS.duration,
  skipProjection  = BASE_CANVAS_DEFAULTS.skipProjection,
  forceSquare     = BASE_CANVAS_DEFAULTS.forceSquare,
  clampPan        = BASE_CANVAS_DEFAULTS.clampPan,
  clampPanInset   = BASE_CANVAS_DEFAULTS.clampPanInset,
  // Cartesian / XY props — opt-in.  Geo canvases leave these at their defaults.
  projector       = BASE_CANVAS_DEFAULTS.projector,
  margin          = BASE_CANVAS_DEFAULTS.margin,
  ease            = BASE_CANVAS_DEFAULTS.ease,
  zoomAxes        = BASE_CANVAS_DEFAULTS.zoomAxes,
  userZoomAxes    = BASE_CANVAS_DEFAULTS.userZoomAxes,
  onDraw,
  onZoom,
  onZoomStart,
  onZoomEnd,
  className,
  style,
}, ref) {
  const containerRef    = useRef(null);
  const svgRef          = useRef(null);
  const innerGroupRef   = useRef(null);
  const coreRef          = useRef(null);
  const pendingBoundsRef = useRef(null);
  const onDrawRef        = useRef(onDraw);
  const onZoomRef        = useRef(onZoom);
  const onZoomStartRef   = useRef(onZoomStart);
  const onZoomEndRef     = useRef(onZoomEnd);
  onDrawRef.current      = onDraw;
  onZoomRef.current      = onZoom;
  onZoomStartRef.current = onZoomStart;
  onZoomEndRef.current   = onZoomEnd;

  const [drawPayload,   setDrawPayload]   = useState(null);
  const [zoomTransform, setZoomTransform] = useState(null);
  const [liveTransform, setLiveTransform] = useState(null);
  const [width,  setWidth]  = useState(100);
  const [height, setHeight] = useState(100);

  const widthRef  = useRef(100);
  const heightRef = useRef(100);
  widthRef.current  = width;
  heightRef.current = height;

  useImperativeHandle(ref, () => ({
    resetZoom:    (...a) => coreRef.current?.resetZoom(...a),
    zoomIn:       (...a) => coreRef.current?.zoomIn(...a),
    zoomOut:      (...a) => coreRef.current?.zoomOut(...a),
    zoomToRect:   (...a) => coreRef.current?.zoomToRect(...a),
    zoomToScale:  (...a) => coreRef.current?.zoomToScale(...a),
    setTransform: (...a) => coreRef.current?.setTransform(...a),
    zoomToDomain: (...a) => coreRef.current?.zoomToDomain(...a),
    redraw:       (d)   => coreRef.current?.draw(d),
    get svgEl()  { return svgRef.current; },
    get width()  { return widthRef.current; },
    get height() { return heightRef.current; },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable controls proxy — getters always read from the live core instance.
  const controls = useRef({
    get projection()         { return coreRef.current?.projection; },
    get initialRotateScale() { return coreRef.current?.initialRotateScale; },
    get canRotate()          { return () => coreRef.current?.canRotate(); },
    get fitBounds() {
      return (fc) => {
        if (coreRef.current) coreRef.current.fitBounds(fc);
        else pendingBoundsRef.current = fc;
      };
    },
    get resetZoom()       { return (...a) => coreRef.current?.resetZoom(...a); },
    get zoomIn()          { return (...a) => coreRef.current?.zoomIn(...a); },
    get zoomOut()         { return (...a) => coreRef.current?.zoomOut(...a); },
    get zoomToRect()      { return (...a) => coreRef.current?.zoomToRect(...a); },
    get zoomToScale()     { return (...a) => coreRef.current?.zoomToScale(...a); },
    get setTransform()    { return (...a) => coreRef.current?.setTransform(...a); },
    get zoomToDomain()    { return (...a) => coreRef.current?.zoomToDomain(...a); },
    get animateRotation() { return (...a) => coreRef.current?.animateRotation(...a); },
  }).current;

  useEffect(() => {
    const core = createBaseCanvas(svgRef.current, containerRef.current, {
      adjustSize, scale, projectionType, maxZoom, allowManualZoom,
      zoomScale, rotateMode, northUp, duration, skipProjection, forceSquare,
      clampPan, clampPanInset,
      projector, margin, ease, zoomAxes, userZoomAxes,
      onDraw: (p) => {
        // Attach innerEl WITHOUT spreading — `{ ...p }` would invoke the
        // payload's live xScale / yScale / zoomTransform getters and freeze
        // them.  Mutate instead so the getters survive into the draw signal.
        p.innerEl = innerGroupRef.current;
        if (p.zoomTransform) setLiveTransform(p.zoomTransform);
        setDrawPayload(p);
        onDrawRef.current?.(p);
      },
      onZoom: (t) => {
        // Rich zoom signal: { transform, xScale, yScale }.  Refresh
        // liveTransform with the unwrapped transform so a layer reading
        // it gets the up-to-date value even during an interactive gesture.
        setLiveTransform(t?.transform ?? t);
        setZoomTransform(t);
        onZoomRef.current?.(t);
      },
      // Interactive-gesture lifecycle (wheel/drag start & end only).
      onZoomStart: (e) => onZoomStartRef.current?.(e),
      onZoomEnd:   (e) => onZoomEndRef.current?.(e),
      onResize: (w, h) => { setWidth(w); setHeight(h); },
    });
    coreRef.current = core;
    if (pendingBoundsRef.current) core.fitBounds(pendingBoundsRef.current);
    core.init();
    return () => core.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Prop-change watchers — forwarded to the core's setter functions.
  useEffect(() => { coreRef.current?.setProjectionType(projectionType); },  [projectionType]);
  useEffect(() => { coreRef.current?.setRotateMode(rotateMode); },           [rotateMode]);
  useEffect(() => { coreRef.current?.setAllowManualZoom(allowManualZoom); }, [allowManualZoom]);
  useEffect(() => { coreRef.current?.setClampPan(clampPan); },               [clampPan]);
  useEffect(() => { coreRef.current?.setClampPanInset(clampPanInset); },     [clampPanInset]);
  useEffect(() => { coreRef.current?.setProjector(projector); },             [projector]);
  useEffect(() => { coreRef.current?.setMargin(margin); },                   [margin]);
  useEffect(() => { coreRef.current?.setDuration(duration); },               [duration]);
  useEffect(() => { coreRef.current?.setEase(ease); },                       [ease]);
  useEffect(() => { coreRef.current?.setZoomAxes(zoomAxes); },               [zoomAxes]);
  useEffect(() => { coreRef.current?.setUserZoomAxes(userZoomAxes); },       [userZoomAxes]);

  const ctx = useMemo(
    () => ({ draw: drawPayload, zoom: zoomTransform, liveTransform, controls, layerContainer: null }),
    [drawPayload, zoomTransform, liveTransform, controls],
  );

  // Margin translate on the inner group — XY layers (`prefer: "inner"`) read
  // `payload.innerEl` as their parent so all of them inherit the same offset.
  const innerTransform = `translate(${margin?.left ?? 0},${margin?.top ?? 0})`;

  return (
    <CanvasContext.Provider value={ctx}>
      <div
        ref={containerRef}
        className={["ot-canvas", className].filter(Boolean).join(" ")}
        style={{ position: "relative", touchAction: "none", overscrollBehavior: "none", ...style }}
      >
        <svg ref={svgRef} width={width} height={height}>
          <defs />
          <g ref={innerGroupRef} transform={innerTransform} />
        </svg>
        {children}
      </div>
    </CanvasContext.Provider>
  );
});

export default BaseCanvas;
