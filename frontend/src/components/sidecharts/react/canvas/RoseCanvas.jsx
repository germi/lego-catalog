import { useRef, useCallback, useMemo, useEffect, forwardRef, useImperativeHandle } from "react";
import { RoseContext } from "../RoseContext.js";
import BaseCanvas from "./BaseCanvas.jsx";
import { createRoseCanvas, ROSE_CANVAS_DEFAULTS } from "../../core/roseCanvas.js";

export const RoseCanvas = forwardRef(function RoseCanvas({
  children,
  duration    = ROSE_CANVAS_DEFAULTS.duration,
  highlighted = ROSE_CANVAS_DEFAULTS.highlighted,
  margin      = ROSE_CANVAS_DEFAULTS.margin,
  startAngle  = ROSE_CANVAS_DEFAULTS.startAngle,
  endAngle    = ROSE_CANVAS_DEFAULTS.endAngle,
  innerRadius = ROSE_CANVAS_DEFAULTS.innerRadius,
  scaleType   = ROSE_CANVAS_DEFAULTS.scaleType,
  className,
  style,
}, ref) {
  const canvasRef   = useRef(null);
  const svgGroupRef = useRef(null);
  const svgElRef    = useRef(null);

  const coreRef = useRef(null);
  if (!coreRef.current) coreRef.current = createRoseCanvas();

  // Live prop refs so roseControls getters always read current values.
  const durationRef    = useRef(duration);
  const highlightedRef = useRef(highlighted);
  const marginRef      = useRef(margin);
  const startAngleRef  = useRef(startAngle);
  const endAngleRef    = useRef(endAngle);
  const innerRadiusRef = useRef(innerRadius);
  const scaleTypeRef   = useRef(scaleType);
  durationRef.current    = duration;
  highlightedRef.current = highlighted;
  marginRef.current      = margin;
  startAngleRef.current  = startAngle;
  endAngleRef.current    = endAngle;
  innerRadiusRef.current = innerRadius;
  scaleTypeRef.current   = scaleType;

  // Stable getter object — values are live because they read from refs.
  const roseControls = useRef({
    get radius()      {
      const w = canvasRef.current?.width  ?? 200;
      const h = canvasRef.current?.height ?? 200;
      return Math.min(w, h) / 2 - (marginRef.current ?? 5);
    },
    get duration()    { return durationRef.current; },
    get highlighted() { return highlightedRef.current; },
    get innerRadius() { return innerRadiusRef.current; },
    get margin()      { return marginRef.current; },
    get startAngle()  { return startAngleRef.current; },
    get endAngle()    { return endAngleRef.current; },
    get scaleType()   { return scaleTypeRef.current; },
    get svgGroup()    { return svgGroupRef.current; },
    get svgEl()       { return svgElRef.current; },
  }).current;

  useImperativeHandle(ref, () => ({
    get width()  { return canvasRef.current?.width; },
    get height() { return canvasRef.current?.height; },
    get svgEl()  { return svgElRef.current; },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onDraw = useCallback((payload) => {
    svgElRef.current    = payload.svgEl;
    svgGroupRef.current = coreRef.current.onDraw({
      svgEl:  payload.svgEl,
      width:  payload.width  ?? 200,
      height: payload.height ?? 200,
    });
  }, []);

  // Trigger instant redraw when layout geometry changes. Track previous deps
  // by value (not a "did mount" flag) so Strict Mode's setup → cleanup → setup
  // does not fire a redraw(0) on the second setup — that would override the
  // canvas's initial-draw duration with 0 and kill the enter animation.
  const prevGeomRef = useRef(null);
  useEffect(() => {
    const curr = [startAngle, endAngle, margin, innerRadius];
    const prev = prevGeomRef.current;
    prevGeomRef.current = curr;
    if (prev && curr.some((v, i) => v !== prev[i])) {
      canvasRef.current?.redraw(0);
    }
  }, [startAngle, endAngle, margin, innerRadius]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => coreRef.current?.destroy(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const roseCtx = useMemo(
    () => ({ roseControls, roseHighlighted: highlighted }),
    [highlighted, roseControls],
  );

  return (
    <RoseContext.Provider value={roseCtx}>
      <BaseCanvas
        ref={canvasRef}
        skipProjection
        forceSquare
        allowManualZoom={false}
        duration={duration}
        onDraw={onDraw}
        className={className}
        style={style}
      >
        {children}
      </BaseCanvas>
    </RoseContext.Provider>
  );
});

export default RoseCanvas;
